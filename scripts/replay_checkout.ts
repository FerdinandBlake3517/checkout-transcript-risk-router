const serviceURL = process.env.SERVICE_URL ?? "http://localhost:3000/checkout-transcripts";

const response = await fetch(serviceURL, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    paymentReference: "pay_store_1042",
    transcript: "The card payment for 49 dollars and 90 cents USD was captured. Address and cardholder checks matched."
  })
});

const result: unknown = await response.json();
if (!response.ok) throw new Error(`Replay rejected with HTTP ${response.status}`);
console.log(JSON.stringify(result, null, 2));
