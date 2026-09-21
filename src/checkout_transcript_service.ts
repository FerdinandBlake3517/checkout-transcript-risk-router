import { createServer, type ServerResponse } from "node:http";
import OpenAI from "openai";
import { z } from "zod";
import { readPaymentEvent } from "./infrai_payment_reader.js";
import { decidePaymentAction } from "./payment_decision.js";

const requestSchema = z.object({
  paymentReference: z.string().min(1).max(80),
  transcript: z.string().min(1).max(20_000)
}).strict();

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/checkout-transcripts") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = requestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const event = await readPaymentEvent(input.transcript);
    const action = decidePaymentAction(event, input.paymentReference);
    sendJson(response, 200, { paymentReference: input.paymentReference, event, action });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request or extracted payment event was invalid" });
      return;
    }
    if (error instanceof OpenAI.APIError) {
      const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: "Payment event extraction was rejected" });
      return;
    }
    console.error(error);
    sendJson(response, 500, { error: "Unexpected service error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Checkout transcript service listening on http://localhost:${port}`));
