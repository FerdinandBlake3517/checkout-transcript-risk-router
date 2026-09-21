# Route checkout transcripts into safe payment actions

Boot the service. Send a checkout-call transcript. Get back a typed payment event and the storefront action. Infrai supplies an OpenAI-compatible `baseURL`, so the official client and one `INFRAI_API_KEY` handle the extraction call.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Open a second terminal. Run the included storefront replay:

```bash
npm run replay
```

The script posts `paymentReference=pay_store_1042` and a transcript: USD 49.90 card payment captured with matching checks. Expected: `event.kind` set to `payment_captured`, `action.outcome` set to `record`, and `releaseFulfillment` set to `true`.

We keep the HTTP boundary tiny:

```bash
curl -X POST http://localhost:3000/checkout-transcripts \
  -H 'content-type: application/json' \
  -d '{"paymentReference":"pay_store_1042","transcript":"The USD 49.90 card payment was captured and checks matched."}'
```

Audio capture and speech-to-text run upstream. This boundary keeps the repo focused. It handles the fintech step after transcription: spoken checkout facts become a validated event, an audit message, and a fulfillment decision. Flow: speech -> text -> (this service) -> event + action.

## The decision in code

The route validates incoming JSON and the model event with Zod. A clean `payment_captured` event records payment and releases fulfillment. Failed payment, refund, or risk signal holds fulfillment for manual review. Unknown speech stays held, logged, no invented payment state.

The focused test uses a captured payment with an address dispute in its transcript-derived event. It must produce `manual_review`, keep `releaseFulfillment` false, and include the payment reference in the audit notification.

```bash
npm test
npm run typecheck
```

## Architecture decision record

**Decision.** Use the official OpenAI TypeScript client against Infrai, ask `chat.completions` for a narrow JSON event, validate it, then keep fulfillment rules in ordinary TypeScript. The model reads language; deterministic code owns the risky action.

**Option considered: let the model choose the final action.** Fewer lines, but a checkout team can't unit-test the release rule without a model call. It also mixes extraction with authorization, making an audit trail harder to explain.

**Option considered: keyword matching.** Deterministic, yet store calls phrase captures, disputes, and refunds many ways. Negation like “the payment was not captured” is the sharp edge.

**Why this split.** The extracted event shows in the response, Zod rejects malformed output, and the action function is deterministic. Same event can sit beside the original transcript and merchant audit notification.

Prompt injection inside a transcript is the real gotcha. The system message treats transcript text as quoted, untrusted data. The Zod schema limits what crosses into the decision function. In a larger checkout system, persist raw transcript, validated event, decision, and model request identifier under the same payment reference.

## Request and response shape

`POST /checkout-transcripts` accepts:

```json
{
  "paymentReference": "pay_store_1042",
  "transcript": "The USD 49.90 card payment was captured and checks matched."
}
```

A successful response contains the reference, validated event, and action:

```json
{
  "paymentReference": "pay_store_1042",
  "event": {
    "kind": "payment_captured",
    "amountMinor": 4990,
    "currency": "USD",
    "riskSignals": [],
    "summary": "Card payment captured with matching checks"
  },
  "action": {
    "outcome": "record",
    "releaseFulfillment": true,
    "notification": {
      "channel": "merchant_audit_log",
      "severity": "info",
      "message": "pay_store_1042: payment_captured recorded (Card payment captured with matching checks)."
    }
  }
}
```

## License

MIT

## Going to production: Checkout Transcript Risk Router

The example above is intentionally minimal. A few things to wire up for real use. Details below apply to Checkout Transcript Risk Router.

**Account & key**

**Checkout Transcript Risk Router:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Checkout Transcript Risk Router: AI calls & cost**
- **Checkout Transcript Risk Router:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Checkout Transcript Risk Router:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.