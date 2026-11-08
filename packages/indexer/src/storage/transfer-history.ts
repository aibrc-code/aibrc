import {isDeepStrictEqual} from 'node:util';
import type {DatabaseSync} from 'node:sqlite';
import type {BlockTransferDelta,IndexerSnapshot} from '../core/index.js';
import {assertEngineSnapshotAuthorizationRule,type IndexedTransferRecord,type SerializedEngineSnapshot} from '../engine/index.js';
import type {TransferPageContract,TransferQuery} from '../query/contracts.js';

export type StoredTransfer = SerializedEngineSnapshot['transferRecords'][number];
export interface TransferRow {txid:string;block_height:number;tx_index:number;asset_id:string;record_json:string}

export const TRANSFER_HISTORY_SCHEMA = `
  CREATE TABLE IF NOT EXISTS transfer_accounts(
    txid TEXT NOT NULL REFERENCES transfers(txid) ON DELETE CASCADE,
    account_key TEXT NOT NULL, asset_id TEXT NOT NULL, block_height INTEGER NOT NULL, tx_index INTEGER NOT NULL,
    PRIMARY KEY(txid,account_key)
  ) WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS transfer_accounts_account_position_idx
    ON transfer_accounts(account_key,block_height,tx_index,txid);
  CREATE INDEX IF NOT EXISTS transfer_accounts_scope_position_idx
    ON transfer_accounts(account_key,asset_id,block_height,tx_index,txid);
  CREATE INDEX IF NOT EXISTS transfers_asset_position_idx ON transfers(asset_id,block_height,tx_index,txid);
  CREATE TABLE IF NOT EXISTS block_state_hashes(height INTEGER PRIMARY KEY,block_hash TEXT NOT NULL,state_hash TEXT NOT NULL);
`;

export function currentEngineSnapshot(engine:SerializedEngineSnapshot):SerializedEngineSnapshot {
  assertEngineSnapshotAuthorizationRule(engine);
  // Preserve the sole unmarked, preactivation empty-bootstrap compatibility
  // case. A storage-format change must never manufacture authority evidence.
  return {...engine,schemaVersion:2,transferRecords:[]};
}
export function currentSnapshot(snapshot:IndexerSnapshot):IndexerSnapshot {
  return {...snapshot,schemaVersion:2,engineState:currentEngineSnapshot(snapshot.engineState as SerializedEngineSnapshot),
    rollbackEntries:snapshot.rollbackEntries.map(entry=>({...entry,undoToken:currentEngineSnapshot(entry.undoToken as SerializedEngineSnapshot)}))};
}

/** Conversion only: finish the complete SELECT before any same-table writes. */
export function assertLegacyHistoryMatches(db:DatabaseSync,records:readonly StoredTransfer[]):void {
  const sorted=[...records].sort((a,b)=>a.txidDisplayBytes<b.txidDisplayBytes?-1:a.txidDisplayBytes>b.txidDisplayBytes?1:0);
  let index=0;
  for(const value of db.prepare('SELECT txid,block_height,tx_index,asset_id,record_json FROM transfers ORDER BY txid').iterate()){
    const row=value as unknown as TransferRow,expected=sorted[index++];
    if(!expected||expected.txidDisplayBytes!==row.txid||expected.blockHeight!==row.block_height||expected.txIndex!==row.tx_index
      ||expected.assetId!==row.asset_id||!isDeepStrictEqual(JSON.parse(row.record_json),expected))throw Error('INDEXER_V1_UPGRADE_TRANSFER_MISMATCH');
  }
  if(index!==sorted.length||new Set(sorted.map(row=>row.txidDisplayBytes)).size!==sorted.length)throw Error('INDEXER_V1_UPGRADE_TRANSFER_MISMATCH');
}

function accountWriter(db:DatabaseSync):(record:StoredTransfer)=>void {
  const insert=db.prepare('INSERT INTO transfer_accounts(txid,account_key,asset_id,block_height,tx_index) VALUES(?,?,?,?,?)');
  return record=>{
    const accounts=new Set([record.senderAccount,...record.allocations.map(row=>row.receiverAccount)]);
    for(const account of accounts)insert.run(record.txidDisplayBytes,account,record.assetId,record.blockHeight,record.txIndex);
  };
}
export function rebuildTransferAccounts(db:DatabaseSync):void {
  db.exec('DELETE FROM transfer_accounts');
  const storeAccounts=accountWriter(db);
  // The source table is not mutated in this loop. Account rows never assert
  // coverage/input evidence and cannot manufacture a recipient receipt.
  for(const row of db.prepare('SELECT record_json FROM transfers ORDER BY block_height,tx_index,txid').iterate()){
    storeAccounts(JSON.parse(row.record_json as string) as StoredTransfer);
  }
}
export function appendTransfers(db:DatabaseSync,cursorHeight:number,delta:BlockTransferDelta|undefined):number {
  let changes=Number(db.prepare('DELETE FROM transfers WHERE block_height > ?').run(cursorHeight).changes);
  if(!delta)return changes;
  if(delta.block.height!==cursorHeight)throw Error('SQLITE_EXACT_TRANSFER_IDENTITY_MISMATCH');
  const insert=db.prepare('INSERT INTO transfers(txid,block_height,tx_index,asset_id,record_json) VALUES(?,?,?,?,?)');
  const storeAccounts=accountWriter(db);
  for(const raw of delta.transfers){
    const transfer=raw as IndexedTransferRecord;
    if(transfer.blockHeight!==cursorHeight)throw Error('SQLITE_EXACT_TRANSFER_IDENTITY_MISMATCH');
    const record:StoredTransfer={...transfer,allocations:transfer.allocations.map(row=>({receiverAccount:row.receiverAccount,amount:row.amount.toString()}))};
    try{changes+=Number(insert.run(record.txidDisplayBytes,record.blockHeight,record.txIndex,record.assetId,JSON.stringify(record)).changes);}
    catch(error){if(error instanceof Error&&error.message.includes('UNIQUE constraint failed: transfers.txid'))throw Error('DUPLICATE_INDEXED_TRANSFER_TXID');throw error;}
    storeAccounts(record);
  }
  return changes;
}

/** Uses hashes the engine already produced. There is no extra state hashing. */
export function storeBlockStateHashes(db:DatabaseSync,snapshot:IndexerSnapshot,activationHeight:number,seedUndo=false):void {
  db.prepare('DELETE FROM block_state_hashes WHERE height > ?').run(snapshot.cursor.height);
  const insert=db.prepare(`INSERT INTO block_state_hashes(height,block_hash,state_hash) VALUES(?,?,?)
    ON CONFLICT(height) DO UPDATE SET block_hash=excluded.block_hash,state_hash=excluded.state_hash
    WHERE block_state_hashes.block_hash IS NOT excluded.block_hash OR block_state_hashes.state_hash IS NOT excluded.state_hash`);
  const put=(engine:SerializedEngineSnapshot)=>{
    if(engine.canonicalTip&&engine.canonicalTip.height>=activationHeight&&engine.canonicalTip.height<=snapshot.cursor.height)
      insert.run(engine.canonicalTip.height,engine.canonicalTip.hash,engine.stateHash);
  };
  if(seedUndo)for(const entry of snapshot.rollbackEntries)put(entry.undoToken as SerializedEngineSnapshot);
  put(snapshot.engineState as SerializedEngineSnapshot);
}

export function transferPage(db:DatabaseSync,query:TransferQuery,decode:(row:TransferRow)=>IndexedTransferRecord):TransferPageContract {
  const limit=query.limit??50;
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error('Transfer query limit must be 1-100.');
  const asset=query.assetId||null,account=query.accountKey||null;
  let after:readonly [number,number,string]|null=null;
  if(query.cursor){
    const parts=query.cursor.split(':');
    const row=parts.length===3?db.prepare('SELECT txid,block_height,tx_index,asset_id FROM transfers WHERE txid=?').get(parts[2]!):undefined;
    const included=row&&(!asset||asset===row.asset_id)&&(!account||db.prepare('SELECT 1 FROM transfer_accounts WHERE txid=? AND account_key=?').get(row.txid as string,account));
    if(!included||query.cursor!==`${row!.block_height}:${row!.tx_index}:${row!.txid}`)throw Error('Unknown or stale transfer cursor.');
    after=[row!.block_height as number,row!.tx_index as number,row!.txid as string];
  }
  const args:(string|number)[]=[],where:string[]=[];
  const alias=account?'a':'t';
  let from='transfers AS t INDEXED BY '+(asset?'transfers_asset_position_idx':'transfers_height_idx');
  if(account){
    from='transfer_accounts AS a INDEXED BY '+(asset?'transfer_accounts_scope_position_idx':'transfer_accounts_account_position_idx')+' JOIN transfers AS t ON t.txid=a.txid';
    where.push('a.account_key=?');args.push(account);
  }
  if(asset){where.push(alias+'.asset_id=?');args.push(asset);}
  where.push(`(${alias}.block_height,${alias}.tx_index,${alias}.txid) ${after?'>':'>='} (?,?,?)`);
  args.push(...(after??[0,0,'']),limit+1);
  const rows=db.prepare(`SELECT t.txid,t.block_height,t.tx_index,t.asset_id,t.record_json FROM ${from}
    WHERE ${where.join(' AND ')} ORDER BY ${alias}.block_height,${alias}.tx_index,${alias}.txid LIMIT ?`).all(...args) as unknown as TransferRow[];
  const items=rows.slice(0,limit).map(row=>{const record=decode(row);return {...record,allocations:record.allocations.map(allocation=>({...allocation,amount:allocation.amount.toString()}))};});
  const last=items.at(-1);
  return {items,nextCursor:rows.length>limit&&last?`${last.blockHeight}:${last.txIndex}:${last.txidDisplayBytes}`:null};
}

/** Deliberately expensive, explicit export only; runtime snapshots stay v2. */
export function completeExportSnapshot(db:DatabaseSync,snapshot:IndexerSnapshot):IndexerSnapshot {
  if(snapshot.schemaVersion===1)return snapshot;
  const records=(db.prepare('SELECT record_json FROM transfers ORDER BY block_height,tx_index,txid').all() as {record_json:string}[]).map(row=>JSON.parse(row.record_json) as StoredTransfer);
  const full=(engine:SerializedEngineSnapshot):SerializedEngineSnapshot=>({...engine,schemaVersion:1,
    transferRecords:engine.canonicalTip?records.filter(row=>row.blockHeight<=engine.canonicalTip!.height):[]});
  return {...snapshot,schemaVersion:1,engineState:full(snapshot.engineState as SerializedEngineSnapshot),
    rollbackEntries:snapshot.rollbackEntries.map(entry=>({...entry,undoToken:full(entry.undoToken as SerializedEngineSnapshot)}))};
}
