/** Pure identity portion of the exact transfer-success proof guard.
 * Callers pin their own protocol rule, network, age policy and observation time.
 * This establishes neither transaction inclusion nor any amount/record proof.
 */
export function matchesStrictQueryProofIdentity(value: unknown, expected: Readonly<{
  network: string; maxAgeSeconds: number; now: number; authorizationRuleId: string;
}>): boolean {
  const proof = object(value), status = object(proof.status), identity = object(proof.replicaIdentity);
  const tip = object(proof.canonicalTip), statusTip = object(status.canonicalTip);
  const heartbeat = typeof status.lastHeartbeatAt === "string" ? Date.parse(status.lastHeartbeatAt) : NaN;
  return Number.isFinite(expected.now)
    && Number.isFinite(expected.maxAgeSeconds) && expected.maxAgeSeconds >= 1 && expected.maxAgeSeconds <= 3600
    && status.status === "READY" && status.network === expected.network && status.sourceStatus === "READY"
    && status.availability === "READY" && status.freshness === "FRESH"
    && Number.isFinite(heartbeat) && heartbeat <= expected.now + 1000 && expected.now - heartbeat <= expected.maxAgeSeconds * 1000
    && hex(status.stateHash) && status.replicaStateHash === status.stateHash
    && integer(tip.height) && hex(tip.hash) && tip.height === statusTip.height && tip.hash === statusTip.hash && status.lastVerifiedHeight === tip.height
    && status.replicaHeight === tip.height && status.replicaBlockHash === tip.hash
    && identity.network === expected.network && integer(identity.activationHeight) && identity.activationHeight <= tip.height
    && /^[0-9a-f]{40}$/.test(String(identity.sourceRevision)) && hex(identity.protocolManifestSha256) && hex(identity.databaseSha256)
    && proof.authorizationRuleId === expected.authorizationRuleId;
}

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function integer(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function hex(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{64}$/.test(value); }
