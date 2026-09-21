import { z } from "zod";

export const paymentEventSchema = z.object({
  kind: z.enum(["payment_captured", "payment_failed", "refund_requested", "unknown"]),
  amountMinor: z.number().int().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  riskSignals: z.array(z.string()).max(10),
  summary: z.string().min(1).max(240)
});

export type PaymentEvent = z.infer<typeof paymentEventSchema>;

export type PaymentAction = {
  outcome: "record" | "manual_review" | "ignore";
  releaseFulfillment: boolean;
  notification: {
    channel: "merchant_audit_log";
    severity: "info" | "warning";
    message: string;
  };
};

export function decidePaymentAction(event: PaymentEvent, paymentReference: string): PaymentAction {
  const risky = event.riskSignals.length > 0;
  const review = risky || event.kind === "refund_requested" || event.kind === "payment_failed";

  if (event.kind === "unknown") {
    return {
      outcome: "ignore",
      releaseFulfillment: false,
      notification: {
        channel: "merchant_audit_log",
        severity: "warning",
        message: `${paymentReference}: no payment event confirmed; fulfillment remains held.`
      }
    };
  }

  if (review) {
    return {
      outcome: "manual_review",
      releaseFulfillment: false,
      notification: {
        channel: "merchant_audit_log",
        severity: "warning",
        message: `${paymentReference}: ${event.kind} queued for review (${event.summary}).`
      }
    };
  }

  return {
    outcome: "record",
    releaseFulfillment: event.kind === "payment_captured",
    notification: {
      channel: "merchant_audit_log",
      severity: "info",
      message: `${paymentReference}: ${event.kind} recorded (${event.summary}).`
    }
  };
}
