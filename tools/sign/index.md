# Transfer

Send an AIBRC asset from your Bitcoin wallet. Enter the asset, amount and recipient, review the instruction, then approve the transaction in UniSat or OKX Wallet.

Your wallet keeps your keys and handles coin selection, the network fee, signing and broadcasting. This reference tool prepares the AIBRC instruction and reads back the original transaction.

## Send an asset

<div class="aibrc-sign-tool" data-aibrc-sign-tool>
  <p class="sign-version">Protocol 0.25.0 · Sign v1</p>
  <label for="sign-wallet">Wallet</label><select id="sign-wallet" aria-describedby="sign-connected"></select>
  <button id="sign-connect" type="button">Connect wallet</button><p id="sign-connected" class="mono"></p>
  <label for="sign-asset">Deploy transaction ID</label><input id="sign-asset" type="text" spellcheck="false" autocomplete="off" maxlength="80">
  <label class="sign-inline"><input id="sign-manual" type="checkbox"> Advanced: use height:txIndex instead</label>
  <label for="sign-amount">Amount (tokens)</label><input id="sign-amount" type="text" inputmode="decimal" autocomplete="off" maxlength="48" placeholder="1000">
  <small>Up to 8 decimal places. The review shows the exact base-unit amount.</small>
  <label for="sign-recipient">Recipient address</label><input id="sign-recipient" type="text" spellcheck="false" autocomplete="off" maxlength="90" placeholder="bc1q… or bc1p…">
  <button id="sign-review" type="button">Review transfer</button>
  <section id="sign-confirmation" hidden><h3>Review before signing</h3><pre id="sign-summary"></pre><button id="sign-send" type="button">Send with wallet</button></section>
  <section class="result"><p id="sign-status" role="status" aria-live="polite">Choose a wallet and connect when ready.</p><p id="sign-transaction" class="mono"></p><a id="sign-explorer" target="_blank" rel="noopener noreferrer" hidden>View the original Bitcoin transaction</a></section>
  <div class="actions"><button id="sign-retry" type="button" hidden>Check transaction</button><button id="sign-reset" type="button">New draft</button></div>
</div>

<script type="module" src="./sign.js"></script>

## How to use it

1. **Connect a wallet.** Use Bitcoin mainnet with a Native SegWit P2WPKH (`bc1q`) or Taproot P2TR (`bc1p`) address. Not every `bc1q` script is supported.
2. **Identify the asset.** Paste its confirmed deployment transaction ID. The tool finds its block height and transaction position. The advanced option accepts that `height:txIndex` directly.
3. **Enter and review.** Amounts are tokens, with up to eight decimal places. Check the recipient, exact amount and decoded instruction.
4. **Approve in your wallet.** The transaction sends **546 BTC sats to the recipient**, carries the AIBRC instruction in `OP_RETURN`, and pays the network fee selected in your wallet. Those BTC amounts are separate from the token amount.
5. **Follow the original transaction.** The page shows its txid and checks its structure and Bitcoin confirmation. **Check transaction** and **Refresh confirmation** only read that txid; they never send another payment.

```text
Asset + amount + recipient
  → Review the AIBRC instruction
  → Approve and send in your wallet
  → Read the original Bitcoin transaction
  → Bitcoin confirmation
  → AIBRC indexer applies the protocol rules
```

Bitcoin confirmation and a matching instruction are distinct from an applied asset transfer. An AIBRC indexer also checks the asset, authorization and sender balance. If the data service is slow, keep the original txid and check it again rather than repeating the payment.

## A small code example

The browser module encodes the instruction; UniSat builds and sends the Bitcoin transaction. This example sends **10 tokens** of an asset at the illustrative locator `961555:3`. Replace the locator and recipient with your own, and check your balance before sending.

```js
import { NetworkId, encodeTransfer } from
  '/sign/aibrc-protocol.browser.js';

const payload = encodeTransfer({
  network: NetworkId.MAINNET,
  authInputIndex: 0,
  assetLocator: { blockHeight: 961555, txIndex: 3 },
  allocations: [{
    receiverOutputIndex: 0,
    amount: 10n * 100000000n,
  }],
});

// Requests wallet approval and broadcasts if approved.
const txid = await window.unisat.sendBitcoin(
  recipientAddress, 546,
  { memo: payload.toString('hex') },
);
```

The page checks the returned transaction against the reviewed payload, recipient output and sender input. Wallet versions can differ; review the wallet's payment details before approving. A successful UniSat transfer has been observed with this output layout; OKX in-app compatibility still needs a real-wallet check.

## Share a prefilled draft

```text
/sign/?v=1&asset=<deploy-txid>&amount=10&to=<address>
```

The link fills the form only. It does not connect a wallet, request a signature or send a transaction. Addresses and amounts in a link can appear in browser history and hosting access logs.
