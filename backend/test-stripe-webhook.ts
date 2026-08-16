import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2026-07-29.dahlia'
});

async function runTest() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock';
  
  // 1. Create a mock payload string (must be stringified JSON)
  const payloadStr = JSON.stringify({
    id: `evt_mock_${Date.now()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_mock',
        customer: 'cus_mock123',
        subscription: 'sub_mock123',
        metadata: {
          userId: 'test_user_uuid'
        }
      }
    }
  });

  // 2. Generate a valid Stripe signature header using the SDK
  // We need to use the exact timestamp and payload to generate the signature
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: payloadStr,
    secret: webhookSecret,
  });

  console.log(`Sending webhook with signature: ${signature}`);

  // 3. Send the webhook
  const response = await fetch('http://localhost:5000/api/billing/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature
    },
    body: payloadStr
  });

  console.log('Webhook Response Status:', response.status);
  const data = await response.text();
  console.log('Webhook Response Body:', data);
}

runTest().catch(console.error).finally(() => process.exit(0));
