// SPDX-License-Identifier: MIT
import { quoteUserBuy, quoteUserSell, routeRuleFee, planBuyback } from './index.mjs';

const requestedTotal = 100_000n;
const executedTotal = 100_000n;
const T = 100n;
const C = 0n;
const postAtTradeStart = true;
const buy = quoteUserBuy(requestedTotal, executedTotal, T, postAtTradeStart);

const result = {
  inputs: { requestedTotal, executedTotal, T, C, postAtTradeStart },
  buy,
  sell: quoteUserSell(100_000n, T, postAtTradeStart),
  ruleFeeRoute: routeRuleFee(buy.ruleFee, C),
  buybackPlan: {
    suppliedAvailableBalance: 1_000n,
    suppliedEventSequence: 42n,
    ...planBuyback(1_000n, 42n),
  },
  roundingBoundary: {
    base: 1_201n,
    T: 10n,
    postAtTradeStart: true,
    ...quoteUserSell(1_201n, 10n, true),
  },
};

console.log(JSON.stringify(result, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
