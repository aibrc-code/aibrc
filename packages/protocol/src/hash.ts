import { Buffer } from "buffer";
import { sha256 } from "@noble/hashes/sha256";

/** Identical SHA-256 bytes in Node and browsers; no network or crypto key access. */
export function sha256Bytes(...parts: readonly Uint8Array[]): Buffer {
  const hash = sha256.create();
  for (const part of parts) hash.update(part);
  return Buffer.from(hash.digest());
}
