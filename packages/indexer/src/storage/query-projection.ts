import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { RollbackJournalEntry } from "../core/types.js";
import type { OfflineTransactionMetadata, SerializedEngineSnapshot } from "../engine/types.js";
import { decodeBitcoinTransaction } from "@aibrc/protocol/decoder";
import { decodeDeployStructure, decodeTransfer, deriveAccountKey, extractAibrcPayloadsFromOutputs, INPUT_AUTHORIZATION_RULE_ID } from "@aibrc/protocol";
import type { BlockOutcomeContract, RecipientTransferContract } from "../query/contracts.js";

export const QUERY_PROJECTION_VERSION = "2";
export const QUERY_PROJECTION_SCHEMA = `
  CREATE TABLE IF NOT EXISTS query_blocks(height INTEGER PRIMARY KEY, hash TEXT NOT NULL, transaction_count INTEGER NOT NULL,
    marked_transaction_count INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS query_outcomes(block_height INTEGER NOT NULL REFERENCES query_blocks(height) ON DELETE CASCADE,
    tx_index INTEGER NOT NULL, txid TEXT NOT NULL, record_json TEXT NOT NULL, input_evidence_hash TEXT NOT NULL DEFAULT '', PRIMARY KEY(block_height, tx_index));
  CREATE INDEX IF NOT EXISTS query_outcomes_txid_idx ON query_outcomes(txid);
  CREATE TABLE IF NOT EXISTS recipient_transfers(block_height INTEGER NOT NULL REFERENCES query_blocks(height) ON DELETE CASCADE,
    tx_index INTEGER NOT NULL, allocation_index INTEGER NOT NULL, asset_id TEXT NOT NULL, recipient_account TEXT NOT NULL,
    record_json TEXT NOT NULL, PRIMARY KEY(block_height, tx_index, allocation_index));
  CREATE INDEX IF NOT EXISTS recipient_transfer_scope_idx ON recipient_transfers(asset_id, recipient_account, block_height, tx_index, allocation_index);
  CREATE INDEX IF NOT EXISTS transfers_height_idx ON transfers(block_height, tx_index, txid);
`;

/** Shape migration only: old rows remain unavailable until save rebuilds positive v2 evidence. */
export function ensureQueryProjectionColumns(db: DatabaseSync): void {
  const hasColumn = (table: string, column: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((row) => row.name === column);
  if (!hasColumn("query_blocks", "marked_transaction_count")) db.exec("ALTER TABLE query_blocks ADD COLUMN marked_transaction_count INTEGER NOT NULL DEFAULT 0");
  if (!hasColumn("query_outcomes", "input_evidence_hash")) db.exec("ALTER TABLE query_outcomes ADD COLUMN input_evidence_hash TEXT NOT NULL DEFAULT ''");
}

/** Separate stored commitment catches contradictory/tampered JSON without retaining raw transactions. */
export function queryOutcomeEvidenceHash(record: BlockOutcomeContract): string {
  return createHash("sha256").update(JSON.stringify([record.blockHeight, record.blockHash, record.txIndex, record.txidDisplayBytes, record.result,
    record.recognizedMarkerCount, record.inputCount,
    record.inputEvidence, record.inputOutpoints, record.authorizationEvidence, record.authInputIndex, record.authInputOutpoint])).digest("hex");
}

function rawEvidence(transaction: RollbackJournalEntry["block"]["transactions"][number], metadata: OfflineTransactionMetadata) {
  if (!transaction.rawHex) return null;
  try {
    const decoded = decodeBitcoinTransaction(transaction.rawHex);
    const extraction = extractAibrcPayloadsFromOutputs(decoded.outputs);
    // The real raw-block adapter omits resolved input context for malformed-only
    // markers (no payload). Txid + all outputs still positively bind raw inputs;
    // this exception cannot select an authority or accept valid-payload mismatches.
    const malformedWithoutResolvedInputs = extraction.malformedMarkerCount > 0 && extraction.payloads.length === 0
      && metadata.bitcoinTransactionContext.inputs.length === 0;
    // Metadata has prevout scripts/sighashes, not outpoints. Computed raw txid
    // binds every original outpoint; input count and all outputs bind its context.
    if (decoded.txidDisplayBytes !== transaction.txid || decoded.txidDisplayBytes !== metadata.txidDisplayBytes
      || (decoded.inputs.length !== metadata.bitcoinTransactionContext.inputs.length && !malformedWithoutResolvedInputs)
      || decoded.outputs.length !== metadata.bitcoinTransactionContext.outputs.length
      || !decoded.outputs.every((output, index) => output.scriptPubKeyHex === metadata.bitcoinTransactionContext.outputs[index]!.scriptPubKeyHex
        && output.valueSats === BigInt(metadata.bitcoinTransactionContext.outputs[index]!.valueSats))) return null;
    return decoded;
  } catch { return null; }
}

/** Derived query state only; retains neither raw blocks nor extra undo tokens. */
export function syncQueryProjection(db: DatabaseSync, engine: SerializedEngineSnapshot, entries: readonly RollbackJournalEntry[], cursorHeight: number): void {
  db.prepare("DELETE FROM query_blocks WHERE height > ?").run(cursorHeight);
  const activation = db.prepare("SELECT value FROM metadata WHERE key='activation_height'").get() as {value:string}|undefined;
  if (!activation || !/^(0|[1-9][0-9]*)$/.test(activation.value) || !Number.isSafeInteger(Number(activation.value))) throw new Error("SQLITE_QUERY_ACTIVATION_MISSING");
  const activationHeight = Number(activation.value);
  const prior = db.prepare("SELECT value FROM metadata WHERE key='query_complete_through_height'").get() as { value: string } | undefined;
  let completeThrough = prior && /^(0|[1-9][0-9]*)$/.test(prior.value) && Number.isSafeInteger(Number(prior.value))
    ? Math.min(Number(prior.value), cursorHeight) : activationHeight - 1;
  // Only consecutive blocks positively validated by this writer extend the
  // prefix. Missing older evidence never becomes complete because READY is set.
  const markComplete = (height: number) => { if (height === completeThrough + 1) completeThrough = height; };
  const sorted = [...entries].sort((a, b) => a.block.height - b.block.height);
  for (let i = 0; i < sorted.length; i += 1) {
    const entry = sorted[i]!;
    const block = entry.block;
    const existing = db.prepare("SELECT hash FROM query_blocks WHERE height = ?").get(block.height) as { hash:string } | undefined;
    if ((!existing || existing.hash !== block.hash) && block.height <= completeThrough) completeThrough = block.height - 1;
    const after = (sorted[i + 1]?.undoToken ?? engine) as SerializedEngineSnapshot;
    if (after.canonicalTip?.height !== block.height || after.canonicalTip.hash !== block.hash
      || after.inputAuthorizationRuleId !== INPUT_AUTHORIZATION_RULE_ID) continue;
    // Only the previously positively validated prefix may reuse immutable rows.
    // A mere metadata key (including activation-1 from an earlier upgrade save)
    // is not evidence: rows beyond the prefix are fully rebuilt and revalidated.
    if (existing?.hash === block.hash && block.height <= completeThrough) continue;
    db.prepare("DELETE FROM query_blocks WHERE height = ?").run(block.height);
    const outcomes = after.lastBlockOutcomes;
    if (!Array.isArray(outcomes) || outcomes.length !== block.transactions.length) continue;
    const outcomesByIndex = new Map(outcomes.map((outcome) => [outcome.txIndex, outcome]));
    if (outcomesByIndex.size !== outcomes.length || new Set(block.transactions.map((tx) => tx.txid)).size !== block.transactions.length) continue;
    const marked: Array<{ transaction: typeof block.transactions[number]; metadata: OfflineTransactionMetadata; recognizedMarkerCount: number }> = [];
    let complete = true;
    for (const [index, transaction] of block.transactions.entries()) {
      const metadata = transaction.metadata as Partial<OfflineTransactionMetadata> | undefined;
      const outcome = outcomesByIndex.get(index);
      if (!metadata || metadata.inputAuthorizationRuleId !== INPUT_AUTHORIZATION_RULE_ID
        || metadata.txIndex !== index || metadata.txidDisplayBytes !== transaction.txid
        || metadata.payloadSource?.kind !== "CANONICAL_OUTPUT_EXTRACTION" || !metadata.bitcoinTransactionContext
        || !outcome || outcome.txidDisplayBytes !== transaction.txid
        || (outcome.result.status !== "APPLIED" && outcome.result.status !== "NO_OP")) { complete = false; break; }
      const extraction = extractAibrcPayloadsFromOutputs(metadata.bitcoinTransactionContext.outputs);
      if (extraction.recognizedMarkerCount > 0) marked.push({ transaction, metadata: metadata as OfflineTransactionMetadata, recognizedMarkerCount: extraction.recognizedMarkerCount });
    }
    if (!complete) continue;
    // Validate the FULL original 0..N-1 processing chain before filtering rows.
    // Persisted marked tx indexes can be sparse; unmarked transactions have no row.
    db.prepare("INSERT INTO query_blocks(height, hash, transaction_count, marked_transaction_count) VALUES(?, ?, ?, ?)")
      .run(block.height, block.hash, block.transactions.length, marked.length);
    const outcomeInsert = db.prepare("INSERT INTO query_outcomes(block_height, tx_index, txid, record_json, input_evidence_hash) VALUES(?, ?, ?, ?, ?)");
    const allocationInsert = db.prepare("INSERT INTO recipient_transfers(block_height, tx_index, allocation_index, asset_id, recipient_account, record_json) VALUES(?, ?, ?, ?, ?, ?)");
    for (const { transaction, metadata, recognizedMarkerCount } of marked) {
      const outcome = outcomesByIndex.get(metadata.txIndex)!;
      const decoded = rawEvidence(transaction, metadata);
      let authInputIndex: number | null = null;
      let authInputOutpoint: BlockOutcomeContract["authInputOutpoint"] = null;
      const extraction = decoded ? extractAibrcPayloadsFromOutputs(decoded.outputs) : null;
      // Duplicate/malformed/undecodable instructions cannot choose an authority.
      // Their verified raw inputs are still useful positive conflict evidence.
      if (decoded && extraction?.recognizedMarkerCount === 1 && extraction.payloads.length === 1) {
        try { authInputIndex = decodeTransfer(extraction.payloads[0]!).authInputIndex; }
        catch { try { authInputIndex = decodeDeployStructure(extraction.payloads[0]!).deployAuthInputIndex; } catch { /* Unknown authority. */ } }
        const input = authInputIndex === null ? undefined : decoded.inputs[authInputIndex];
        if (input) authInputOutpoint = { txidDisplayBytes: input.txidDisplayBytes, vout: input.vout };
        else authInputIndex = null;
      }
      const record: BlockOutcomeContract = { blockHeight: block.height, blockHash: block.hash,
        txidDisplayBytes: outcome.txidDisplayBytes, txIndex: outcome.txIndex, recognizedMarkerCount,
        inputCount: decoded?.inputs.length ?? null,
        inputOutpoints: decoded ? decoded.inputs.map((input) => ({ txidDisplayBytes: input.txidDisplayBytes, vout: input.vout })) : null,
        inputEvidence: decoded ? "COMPLETE" : "UNKNOWN", authInputIndex, authInputOutpoint,
        authorizationEvidence: authInputOutpoint ? "COMPLETE" : "UNKNOWN",
        result: { ...outcome.result, status: outcome.result.status as "APPLIED" | "NO_OP" } };
      outcomeInsert.run(block.height, outcome.txIndex, outcome.txidDisplayBytes, JSON.stringify(record), queryOutcomeEvidenceHash(record));
      if (outcome.result.status !== "APPLIED") continue;
      const transferRow = db.prepare("SELECT record_json FROM transfers WHERE txid = ? AND block_height = ? AND tx_index = ?")
        .get(outcome.txidDisplayBytes, block.height, outcome.txIndex) as { record_json: string } | undefined;
      if (!transferRow) {
        // APPLIED DEPLOY legitimately has no transfer projection. Classify from
        // canonical metadata even when raw identity evidence is unavailable.
        const payloads = extractAibrcPayloadsFromOutputs(metadata.bitcoinTransactionContext.outputs).payloads;
        let isTransfer = false;
        try { if (payloads.length === 1) { decodeTransfer(payloads[0]!); isTransfer = true; } } catch { /* May be DEPLOY. */ }
        if (isTransfer) throw new Error("SQLITE_QUERY_APPLIED_TRANSFER_MISSING");
        try { if (payloads.length !== 1) throw new Error(); decodeDeployStructure(payloads[0]!); }
        catch { throw new Error("SQLITE_QUERY_APPLIED_INSTRUCTION_UNKNOWN"); }
        continue;
      }
      const transfer = JSON.parse(transferRow.record_json) as SerializedEngineSnapshot["transferRecords"][number];
      if (transfer.assetId !== outcome.result.assetId) throw new Error("SQLITE_QUERY_TRANSFER_ASSET_MISMATCH");
      let receiptAuthIndex: number | null = null;
      let receiptAuthOutpoint: RecipientTransferContract["authInputOutpoint"] = null;
      if (decoded && authInputOutpoint && extraction?.payloads.length === 1) {
        try {
          const instruction = decodeTransfer(extraction.payloads[0]!);
          const contextInput = metadata.bitcoinTransactionContext.inputs[instruction.authInputIndex];
          const locator = db.prepare("SELECT asset_id FROM locators WHERE locator_key = ?")
            .get(`${instruction.assetLocator.blockHeight}:${instruction.assetLocator.txIndex}`) as { asset_id: string } | undefined;
          if (!contextInput || locator?.asset_id !== transfer.assetId
            || deriveAccountKey(contextInput.prevoutScriptPubKeyHex) !== transfer.senderAccount
            || instruction.allocations.length !== transfer.allocations.length
            || !instruction.allocations.every((allocation, index) => {
              const output = decoded.outputs[allocation.receiverOutputIndex];
              return output && deriveAccountKey(output.scriptPubKeyHex) === transfer.allocations[index]!.receiverAccount
                && allocation.amount.toString() === transfer.allocations[index]!.amount;
            })) throw new Error();
          receiptAuthIndex = instruction.authInputIndex;
          receiptAuthOutpoint = authInputOutpoint;
        } catch { /* Applied effect without exact raw identity is not a receipt. */ }
      }
      transfer.allocations.forEach((allocation, allocationIndex) => {
        const allocationRecord: Omit<RecipientTransferContract, "inputCount" | "inputOutpoints" | "inputEvidence"> = {
          txidDisplayBytes: transfer.txidDisplayBytes, blockHeight: block.height, blockHash: block.hash,
          txIndex: transfer.txIndex, allocationIndex, assetId: transfer.assetId, senderAccount: transfer.senderAccount,
          recipientAccount: allocation.receiverAccount, amount: allocation.amount,
          authInputIndex: receiptAuthIndex, authInputOutpoint: receiptAuthOutpoint, identityEvidence: receiptAuthOutpoint ? "COMPLETE" : "UNKNOWN",
        };
        allocationInsert.run(block.height, transfer.txIndex, allocationIndex, transfer.assetId, allocation.receiverAccount, JSON.stringify(allocationRecord));
      });
    }
    markComplete(block.height);
  }
  db.prepare("INSERT INTO metadata(key,value) VALUES('query_complete_through_height',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(completeThrough.toString());
}
