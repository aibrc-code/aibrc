import { INPUT_AUTHORIZATION_RULE_ID } from "@aibrc/protocol";
import { matchesStrictQueryProofIdentity } from "./query-proof-identity.js";
import type { IndexerStatusContract, QueryTip } from "./contracts.js";

export interface QueryProofReplicaIdentity {
  readonly network: "signet" | "mainnet" | "regtest";
  readonly activationHeight: number;
  readonly sourceRevision: string;
  readonly protocolManifestSha256: string;
  readonly databaseSha256: string;
}

/** A held replica's proof identity, separate from query rows and coverage. */
export interface QueryProofContextContract {
  readonly status: IndexerStatusContract & Readonly<{
    network: string;
    sourceStatus: string;
    availability: string;
    freshness: string;
    lastHeartbeatAt: string;
    replicaHeight: number;
    replicaBlockHash: string;
    replicaStateHash: string;
  }>;
  readonly canonicalTip: QueryTip;
  readonly replicaIdentity: QueryProofReplicaIdentity;
  readonly authorizationRuleId: string;
}

/** Pure identity portion of the existing exact transfer-success proof guard.
 * The caller supplies its own clock and expected network/age policy. This is
 * not a record, amount, inclusion, or settlement proof.
 */
export function isStrictQueryProofIdentity(value: unknown, expected: Readonly<{
  network: string; maxAgeSeconds: number; now: number;
}>): boolean {
  return matchesStrictQueryProofIdentity(value, { ...expected, authorizationRuleId: INPUT_AUTHORIZATION_RULE_ID });
}
