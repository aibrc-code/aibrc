// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import {
  UINT256_MAX, VERSION, PLATFORM_FEE_BPS, MIN_USER_GROSS_SATS, BUYBACK_TRIGGER_SATS,
  R1Error, ceilBps, isValidRule, quoteUserBuy, quoteUserSell, routeRuleFee, planBuyback,
} from './index.mjs';
import { checkArtifacts, readVectors, checkVector, checkVectors } from './check-vectors.mjs';

const vectors = readVectors();
for (const vector of vectors.cases) {
  test(`frozen vector: ${vector.id}`, () => checkVector(vector));
}

test('release identity, compiler context and all frozen file digests are bound', () => {
  assert.deepEqual(checkArtifacts(), { files: 17, sha256Files: 16 });
  assert.deepEqual(checkVectors(), { cases: 68, results: 50, rejected: 18 });
  assert.equal(VERSION, 1n);
  assert.equal(PLATFORM_FEE_BPS, 50n);
  assert.equal(MIN_USER_GROSS_SATS, 1_000n);
  assert.equal(BUYBACK_TRIGGER_SATS, 1_000n);
});

test('the checker rejects a changed original file', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'aibrc-r1-artifact-'));
  try {
    const artifacts = join(temporary, 'artifacts');
    cpSync(new URL('./artifacts/', import.meta.url), artifacts, { recursive: true });
    const text = join(artifacts, 'inscription.en.txt');
    writeFileSync(text, Buffer.concat([readFileSync(text), Buffer.from('\n')]));
    assert.throws(() => checkArtifacts(pathToFileURL(`${artifacts}/`)), /SHA-256: inscription.en.txt/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('100000 sats, T100/C0: the supplied total includes both fees', () => {
  const buy = quoteUserBuy(100_000n, 100_000n, 100n, true);
  assert.deepEqual(buy, {
    platformFee: 500n, ruleFee: 1_000n, totalFee: 1_500n,
    principal: 98_500n, totalDebit: 100_000n,
  });
  assert.deepEqual(routeRuleFee(buy.ruleFee, 0n), { creatorAmount: 0n, buybackAmount: 1_000n });
  assert.deepEqual(quoteUserSell(100_000n, 100n, true), {
    platformFee: 500n, ruleFee: 1_000n, totalFee: 1_500n, net: 98_500n,
  });
  assert.deepEqual(quoteUserBuy(100_000n, 100_000n, 100n, false), {
    platformFee: 500n, ruleFee: 0n, totalFee: 500n,
    principal: 99_500n, totalDebit: 100_000n,
  });
});

test('rounding the total once permits the rule fee to decrease by one sat', () => {
  const earlier = quoteUserSell(1_200n, 10n, true);
  const following = quoteUserSell(1_201n, 10n, true);
  assert.deepEqual(earlier, { platformFee: 6n, ruleFee: 2n, totalFee: 8n, net: 1_192n });
  assert.deepEqual(following, { platformFee: 7n, ruleFee: 1n, totalFee: 8n, net: 1_193n });
  assert.equal(ceilBps(1_201n, 10n), 2n);
  assert.notEqual(following.ruleFee, ceilBps(1_201n, 10n));
});

function generator(seed) {
  let state = seed;
  return () => {
    state = (state * 6_364_136_223_846_793_005n + 1_442_695_040_888_963_407n) & UINT256_MAX;
    return state;
  };
}

// A ceiling is checked by its defining interval, without repeating its formula.
function assertCeiling(value, numerator) {
  assert.ok(value * 10_000n >= numerator);
  assert.ok(value === 0n || (value - 1n) * 10_000n < numerator);
}

test('ceilBps satisfies its exact interval over pinned edges and 128 generated pairs', () => {
  const amounts = [0n, 1n, 999n, 1_000n, 1_001n, 9_999n, 10_000n, UINT256_MAX - 1n, UINT256_MAX];
  const rates = [0n, 1n, 50n, 60n, 150n, 550n, 9_999n, 10_000n];
  const next = generator(0xa1b7c001n);
  const pairs = amounts.flatMap((amount) => rates.map((bps) => [amount, bps]));
  for (let index = 0; index < 128; index++) pairs.push([next(), next() % 10_001n]);
  for (const [amount, bps] of pairs) {
    const result = ceilBps(amount, bps);
    assertCeiling(result, amount * bps);
    assert.ok(result >= 0n && result <= amount);
  }
  assert.equal(ceilBps(UINT256_MAX, 10_000n), UINT256_MAX);
  assert.throws(() => ceilBps(UINT256_MAX, 10_001n), { code: 'InvalidBasisPoints' });
});

test('all 51 taxes conserve integers across both stages and full-width amounts', () => {
  const next = generator(0xa1b7c002n);
  for (let index = 0; index <= 50; index++) {
    const T = BigInt(index) * 10n;
    const amounts = [1_000n + BigInt(index), 1_200n, 1_201n, UINT256_MAX,
      1_000n + next() % (UINT256_MAX - 1_000n)];
    for (const amount of amounts) {
      for (const post of [false, true]) {
        const buy = quoteUserBuy(amount, amount, T, post);
        const sell = quoteUserSell(amount, T, post);
        assert.equal(buy.principal + buy.platformFee + buy.ruleFee, amount);
        assert.equal(sell.net + sell.totalFee, amount);
        assert.equal(buy.totalDebit, amount);
        assert.equal(buy.totalFee, buy.platformFee + buy.ruleFee);
        assert.equal(sell.totalFee, buy.totalFee);
        assert.equal(sell.net, buy.principal);
        assert.ok(buy.ruleFee >= 0n && buy.totalFee <= amount);
        assertCeiling(buy.platformFee, amount * 50n);
        assertCeiling(buy.totalFee, amount * (50n + (post ? T : 0n)));
        if (!post || T === 0n) assert.equal(buy.ruleFee, 0n);
        if (amount < UINT256_MAX) assert.ok(quoteUserSell(amount + 1n, T, post).net >= sell.net);
        for (const C of [0n, 10_000n]) {
          const route = routeRuleFee(buy.ruleFee, C);
          assert.equal(route.creatorAmount + route.buybackAmount, buy.ruleFee);
          assert.equal(C === 0n ? route.creatorAmount : route.buybackAmount, 0n);
        }
      }
    }
  }
});

test('current T/C rules accept exactly the fixed tax and destination combinations', () => {
  for (let T = 0n; T <= 500n; T++) {
    assert.equal(isValidRule(T, 0n), T % 10n === 0n);
    assert.equal(isValidRule(T, 10_000n), T !== 0n && T % 10n === 0n);
    assert.equal(isValidRule(T, 5_000n), false);
  }
  for (const T of [501n, 510n, UINT256_MAX]) assert.equal(isValidRule(T, 0n), false);
  for (const T of [1n, 9n, 11n, 501n, UINT256_MAX]) {
    assert.throws(() => quoteUserBuy(1_000n, 1_000n, T, false), { code: 'InvalidTax' });
    assert.throws(() => quoteUserSell(1_000n, T, true), { code: 'InvalidTax' });
  }
  for (const C of [1n, 5_000n, 10_001n, UINT256_MAX]) {
    assert.throws(() => routeRuleFee(0n, C), { code: 'InvalidDestination' });
  }
  assert.deepEqual(routeRuleFee(UINT256_MAX, 10_000n), { creatorAmount: UINT256_MAX, buybackAmount: 0n });
});

test('BUY and SELL boundaries follow the frozen rejection order', () => {
  assert.throws(() => quoteUserBuy(999n, 0n, 1n, false), { code: 'MinimumGross' });
  assert.throws(() => quoteUserBuy(1_000n, 0n, 1n, false), { code: 'InvalidBuy' });
  assert.throws(() => quoteUserSell(999n, 1n, false), { code: 'MinimumGross' });
  for (const args of [[1_000n, 0n, 0n, false], [1_000n, 1n, 0n, false],
    [1_000n, 1_001n, 0n, false], [1_001n, 1_000n, 10n, true]]) {
    assert.throws(() => quoteUserBuy(...args), { code: 'InvalidBuy' });
  }
  const partial = { platformFee: 1n, ruleFee: 0n, totalFee: 1n, principal: 1n, totalDebit: 2n };
  assert.deepEqual(quoteUserBuy(1_000n, 2n, 10n, false), partial);
  assert.deepEqual(quoteUserBuy(UINT256_MAX, 2n, 500n, false), partial);
  assert.deepEqual(quoteUserSell(1_000n, 10n, true), { platformFee: 5n, ruleFee: 1n, totalFee: 6n, net: 994n });
});

test('every integer argument rejects coercion, negative values and uint256 overflow', () => {
  const calls = [
    [isValidRule, [10n, 0n], [0, 1]],
    [ceilBps, [1_000n, 50n], [0, 1]],
    [quoteUserBuy, [1_000n, 1_000n, 10n, true], [0, 1, 2]],
    [quoteUserSell, [1_000n, 10n, true], [0, 1]],
    [routeRuleFee, [1n, 0n], [0, 1]],
    [planBuyback, [1_000n, 42n], [0, 1]],
  ];
  const invalid = [-1n, UINT256_MAX + 1n, 1, 1.5, '1', true, false,
    undefined, null, NaN, Infinity, {}, [], Object(1n)];
  for (const [fn, args, positions] of calls) {
    for (const position of positions) for (const value of invalid) {
      const altered = [...args];
      altered[position] = value;
      assert.throws(() => fn(...altered), { code: 'InvalidUint256' }, `${fn.name} argument ${position}`);
    }
    assert.throws(() => fn(), R1Error);
  }
});

test('stage inputs are booleans with no truthy-value coercion', () => {
  for (const value of [0n, 1n, 0, 1, 'true', 'false', undefined, null, {}, [], new Boolean(true)]) {
    assert.throws(() => quoteUserBuy(1_000n, 1_000n, 10n, value), { code: 'InvalidBoolean' });
    assert.throws(() => quoteUserSell(1_000n, 10n, value), { code: 'InvalidBoolean' });
  }
});

test('buyback planning spends the supplied balance and checks N + 1 only when needed', () => {
  for (const V of [0n, 1n, 999n]) for (const N of [0n, UINT256_MAX - 1n, UINT256_MAX]) {
    assert.deepEqual(planBuyback(V, N), {
      shouldExecute: false, spend: 0n, nextSequence: 0n, platformFee: 0n, ruleFee: 0n,
    });
  }
  const next = generator(0xa1b7c003n);
  const balances = [1_000n, 50_000n, UINT256_MAX];
  for (let index = 0; index < 64; index++) balances.push(1_000n + next() % (UINT256_MAX - 999n));
  for (const V of balances) {
    for (const N of [0n, 42n, UINT256_MAX - 1n]) {
      const result = planBuyback(V, N);
      assert.equal(result.shouldExecute, true);
      assert.equal(result.spend, V);
      assert.equal(result.nextSequence - N, 1n);
      assert.equal(result.platformFee + result.ruleFee, 0n);
    }
    assert.throws(() => planBuyback(V, UINT256_MAX), { code: 'ArithmeticOverflow' });
  }
});
