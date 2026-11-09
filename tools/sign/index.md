# Transfer

Send an AIBRC asset to one recipient or paste a list for many recipients. Review the instruction and BTC cost, then approve in your wallet.

Your wallet keeps your keys. **Single** uses the existing UniSat or OKX wallet payment flow. **Batch** prepares a multi-recipient transaction plan locally using UniSat’s safe BTC coins, then asks the wallet to sign and broadcast. Both modes read back the original transaction IDs.

## Send an asset

<div class="aibrc-sign-tool" data-aibrc-sign-tool>
  <p class="sign-version">Protocol 0.25.0 · Sign v1</p>
  <nav class="mode-tabs" role="tablist" aria-label="Transfer mode">
    <button id="mode-single" type="button" role="tab" aria-selected="true" aria-controls="single-mode">Single</button>
    <button id="mode-batch" type="button" role="tab" aria-selected="false" aria-controls="batch-mode">Batch</button>
  </nav>
  <section id="single-mode" role="tabpanel" aria-labelledby="mode-single">
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
  </section>
    <section id="batch-mode" role="tabpanel" aria-labelledby="mode-batch" hidden>
      <h3>One transfer, many recipients</h3>
      <p>Paste an address and token amount on each line. The tool builds the complete transaction plan; your wallet signs and broadcasts.</p>
      <div class="actions" aria-label="Batch wallet">
        <button id="batch-wallet-unisat" type="button" aria-pressed="true">UniSat</button>
        <button id="batch-wallet-okx" type="button" aria-pressed="false">OKX Wallet</button>
      </div>
      <button id="batch-connect" type="button">Connect for Batch</button>
      <p id="batch-connected" class="mono"></p>
      <label for="batch-asset">Asset: deploy transaction ID or height:txIndex</label>
      <textarea id="batch-asset" rows="1" maxlength="80" spellcheck="false" autocomplete="off"></textarea>
      <label for="batch-list">Recipients: one address and amount per line</label>
      <textarea id="batch-list" rows="8" spellcheck="false" autocomplete="off" placeholder="bc1q… 1&#10;bc1p… 2.5"></textarea>
      <small>Separate the address and amount with spaces, a comma or a tab. Blank lines and lines starting with # are ignored.</small>
      <button id="batch-merge" type="button" aria-pressed="true">Merge duplicate addresses: on</button>
      <pre id="batch-list-summary" aria-live="polite"></pre>
      <label for="batch-fee">Network fee rate (sat/vB)</label>
      <textarea id="batch-fee" rows="1" inputmode="decimal" maxlength="16" spellcheck="false" autocomplete="off"></textarea>
      <small>Each recipient receives 546 sats as well as the AIBRC instruction. Review the full BTC cost before signing.</small>
      <button id="batch-review" type="button">Review batch</button>
      <section id="batch-confirmation" hidden><h2>Confirm the complete plan</h2><pre id="batch-summary"></pre><button id="batch-send" type="button">Sign and broadcast with wallet</button></section>
      <section class="result"><p id="batch-status" role="status" aria-live="polite"></p><pre id="batch-results"></pre></section>
      <div class="actions"><button id="batch-retry" type="button" hidden>Retry verification only</button><button id="batch-reset" type="button">New batch draft</button></div>
      <p class="sign-version">No platform account or indexer. Safe BTC UTXOs come only from the wallet. Unknown broadcast results stop the batch; this page never automatically resends.</p>
      <details id="batch-previous" hidden><summary>Previous batch results</summary><pre id="batch-previous-results"></pre><small>Kept only in this open page. Match the source lines to your list; never resend rows whose result is unknown.</small></details>
    </section>
</div>

<script type="module" src="./sign.js"></script>
<script type="module" src="./batch-ui.js"></script>

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

## Batch: one transfer, many recipients

1. Select **Batch** and connect UniSat. Enter the deploy transaction ID or `height:txIndex`.
2. Paste one **address and token amount** per line. Spaces, commas or tabs separate the fields. Blank lines and `#` comments are ignored. Duplicate addresses merge by default; switch merging off to keep separate allocations.
3. Set the network fee rate in **sat/vB**, then review the plan. It shows every transaction’s source lines, recipient count, fee and expected txid, plus the total BTC cost. Each recipient receives **546 BTC sats**, separate from their token amount.
4. Review the wallet requests. The tool uses batch signing when available, but your wallet may still ask for approval of each transaction. All signed transactions must match the prebuilt plan before the first is broadcast.
5. Follow the results by **source line and txid**. A failed or unknown broadcast stops the remaining transactions. Verification retry reads only the original txids and never resumes sending. When you start a new draft, the previous result stays visible in this page; compare it with your list before sending again. Reloading the page clears that local history.

```text
Address + amount on each line
  → Validate and group the list
  → Review all outputs, fees and source lines
  → Wallet signs the prebuilt transactions
  → Check the entire signed plan
  → Broadcast in order
     ├─ Success → read the original txid
     └─ Unknown or failed → stop; verify only
```

Batch measures the actual encoded instruction and splits before exceeding the 80-byte compatibility payload or 25 allocations per transaction. At one token each, 12 allocations use 78 bytes, so 30 different recipients become **12 + 12 + 6**. Other quantities can split differently. A complete plan can contain up to 24 chained transactions; the tool does not silently omit remaining rows.

Batch funding comes only from the wallet’s safe BTC UTXO interface and must match confirmed Bitcoin outputs. It never selects coins from an address-UTXO explorer API. OKX remains available in Single; Batch is disabled until a documented safe funding interface can be used through the same flow. Check your AIBRC balance before sending: a matching Bitcoin transaction alone does not prove the asset transfer applied.

## A small code example

For complete SDK scripts, see [deployment, single and batch transfers, decoding and state hashing](https://aibrc.io/docs/quickstart/). The Single form sends to one recipient; Batch builds the matching outputs for a list. The protocol supports 1–25 allocations when the Bitcoin transaction contains the corresponding receiver outputs.

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
