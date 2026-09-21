import assert from "node:assert/strict";
import test from "node:test";
import { decidePaymentAction } from "../src/payment_decision.js";

test("a clean captured payment releases storefront fulfillment", () => {
  const action = decidePaymentAction(
    {
      kind: "payment_captured",
      amountMinor: 4990,
      currency: "USD",
      riskSignals: [],
      summary: "Card payment captured with matching checks"
    },
    "pay_store_1042"
  );

  assert.equal(action.outcome, "record");
  assert.equal(action.releaseFulfillment, true);
  assert.equal(action.notification.severity, "info");
  assert.match(action.notification.message, /pay_store_1042/);
});

test("a captured payment with a risk signal holds storefront fulfillment", () => {
  const action = decidePaymentAction(
    {
      kind: "payment_captured",
      amountMinor: 4990,
      currency: "USD",
      riskSignals: ["cardholder disputed the shipping address"],
      summary: "Payment captured but address was disputed"
    },
    "pay_store_1042"
  );

  assert.equal(action.outcome, "manual_review");
  assert.equal(action.releaseFulfillment, false);
  assert.equal(action.notification.severity, "warning");
  assert.match(action.notification.message, /pay_store_1042/);
});
