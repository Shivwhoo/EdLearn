import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2026-07-29.dahlia'
});
