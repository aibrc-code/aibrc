// SPDX-License-Identifier: MIT
// Integer reference for the frozen AIBTCInscription R1 T/C interface.

export const UINT256_MAX = (1n << 256n) - 1n;
export const VERSION = 1n;
export const PLATFORM_FEE_BPS = 50n;
export const MIN_USER_GROSS_SATS = 1_000n;
export const BUYBACK_TRIGGER_SATS = 1_000n;
export const INSCRIPTION_ADDRESS = '0xed976e7b95d099c60318ef848c73d584ee5eb08a';
export const INSCRIPTION_TEXT_SHA256 = '0x3c0b91af6cbfce5ea8eb8c6d1174c117ff34233695f480f5e6c9b3db7ddaa73b';
export const BUILD_MANIFEST_SHA256 = 'd89dc0b21bf43a91b1dce2e406b15986b5a93d543e2df6af5d1545cbb739d845';
export const RUNTIME_CODE_HASH = '0xced45195c6414fda019589fd5959999a2e5ef58e986643b6e2dc620b672cd1e3';

export class R1Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'R1Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new R1Error(code, message);
}

function uint256(value, name) {
  if (typeof value !== 'bigint' || value < 0n || value > UINT256_MAX) {
    fail('InvalidUint256', `${name} must be a bigint between 0 and 2^256 - 1`);
  }
}

function boolean(value) {
  if (typeof value !== 'boolean') {
    fail('InvalidBoolean', 'postAtTradeStart must be a boolean');
  }
}

function validTax(T) {
  return T <= 500n && T % 10n === 0n;
}

export function isValidRule(T, C) {
  uint256(T, 'T');
  uint256(C, 'C');
  return validTax(T) && (C === 0n || C === 10_000n) && (T !== 0n || C === 0n);
}

export function ceilBps(amount, bps) {
  uint256(amount, 'amount');
  uint256(bps, 'bps');
  if (bps > 10_000n) fail('InvalidBasisPoints', 'bps must not exceed 10000');
  // BigInt intermediates are unbounded; the result is bounded by amount.
  return (amount * bps + 9_999n) / 10_000n;
}

function fees(base, T, postAtTradeStart) {
  if (!validTax(T)) fail('InvalidTax', 'T must be 0 or a multiple of 10 through 500');
  const platformFee = ceilBps(base, PLATFORM_FEE_BPS);
  const totalFee = ceilBps(base, PLATFORM_FEE_BPS + (postAtTradeStart ? T : 0n));
  return { platformFee, ruleFee: totalFee - platformFee, totalFee };
}

export function quoteUserBuy(requestedTotal, executedTotal, T, postAtTradeStart) {
  uint256(requestedTotal, 'requestedTotal');
  uint256(executedTotal, 'executedTotal');
  uint256(T, 'T');
  boolean(postAtTradeStart);
  if (requestedTotal < MIN_USER_GROSS_SATS) fail('MinimumGross', 'requestedTotal must be at least 1000 sats');
  if (executedTotal === 0n || executedTotal > requestedTotal ||
      (postAtTradeStart && executedTotal !== requestedTotal)) {
    fail('InvalidBuy', 'executedTotal must be positive, within the request, and equal to it after graduation');
  }
  const result = fees(executedTotal, T, postAtTradeStart);
  const principal = executedTotal - result.totalFee;
  if (principal === 0n) fail('InvalidBuy', 'BUY principal must be positive');
  return { ...result, principal, totalDebit: executedTotal };
}

export function quoteUserSell(G, T, postAtTradeStart) {
  uint256(G, 'G');
  uint256(T, 'T');
  boolean(postAtTradeStart);
  if (G < MIN_USER_GROSS_SATS) fail('MinimumGross', 'G must be at least 1000 sats');
  const result = fees(G, T, postAtTradeStart);
  return { ...result, net: G - result.totalFee };
}

export function routeRuleFee(ruleFee, C) {
  uint256(ruleFee, 'ruleFee');
  uint256(C, 'C');
  if (C !== 0n && C !== 10_000n) fail('InvalidDestination', 'C must be 0 or 10000');
  return C === 10_000n
    ? { creatorAmount: ruleFee, buybackAmount: 0n }
    : { creatorAmount: 0n, buybackAmount: ruleFee };
}

export function planBuyback(V, N) {
  uint256(V, 'V');
  uint256(N, 'N');
  if (V < BUYBACK_TRIGGER_SATS) {
    return { shouldExecute: false, spend: 0n, nextSequence: 0n, platformFee: 0n, ruleFee: 0n };
  }
  if (N === UINT256_MAX) fail('ArithmeticOverflow', 'N + 1 exceeds uint256');
  return { shouldExecute: true, spend: V, nextSequence: N + 1n, platformFee: 0n, ruleFee: 0n };
}
