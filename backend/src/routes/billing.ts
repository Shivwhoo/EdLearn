import { Router, Request, Response } from 'express';
import { stripe } from '../lib/stripe';
import db from '../lib/db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import Stripe from 'stripe';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const PRICE_ID = process.env.STRIPE_TEST_PRICE_ID || 'price_12345'; // Hardcoded test Price ID for V1 gating

// POST /api/billing/checkout
router.post('/checkout', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;
  
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { subscription: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    let stripeCustomerId = user.subscription?.stripeCustomerId;

    if (!stripeCustomerId) {
      // Create Stripe Customer on first checkout
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId }
      });
      stripeCustomerId = customer.id;

      if (!user.subscription) {
        // Just to store the customer ID. The webhook will fully populate subscription details.
        await db.subscription.create({
          data: {
            userId,
            stripeId: `mock_${Date.now()}`,
            stripeCustomerId,
            status: 'incomplete',
            expiresAt: new Date(0)
          }
        });
      } else {
        await db.subscription.update({
          where: { userId },
          data: { stripeCustomerId }
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${FRONTEND_URL}/dashboard?checkout=success`,
      cancel_url: `${FRONTEND_URL}/dashboard?checkout=cancelled`,
      metadata: { userId },
    });

    return res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('[api/billing/checkout]', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/billing/portal
router.post('/portal', authenticate, async (req: Request, res: Response): Promise<any> => {
  const userId = (req as AuthenticatedRequest).user!.id;

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { subscription: true }
    });

    const stripeCustomerId = user?.subscription?.stripeCustomerId;
    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'No active subscription found.' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${FRONTEND_URL}/dashboard`,
    });

    return res.json({ success: true, url: portalSession.url });
  } catch (error) {
    console.error('[api/billing/portal]', error);
    return res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// POST /api/billing/webhook
// This route is explicitly registered with express.raw() in index.ts BEFORE express.json()
export const webhookRouter = Router();

webhookRouter.post('/webhook', async (req: Request, res: Response): Promise<any> => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET missing, skipping webhook validation for local dev.');
  }

  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Unsafe fallback for testing without webhook secret
      event = JSON.parse(req.body.toString());
    }
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency check
  const existingEvent = await db.stripeEvent.findUnique({ where: { id: event.id } });
  if (existingEvent) {
    return res.json({ received: true, note: 'Duplicate event skipped' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const stripeCustomerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          await db.subscription.upsert({
            where: { userId },
            create: {
              userId,
              stripeId: subscription.id,
              stripeCustomerId,
              status: subscription.status,
              tier: 'PRO',
              expiresAt: new Date(subscription.current_period_end * 1000)
            },
            update: {
              stripeId: subscription.id,
              stripeCustomerId,
              status: subscription.status,
              tier: 'PRO',
              expiresAt: new Date(subscription.current_period_end * 1000)
            }
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        await db.subscription.updateMany({
          where: { stripeId: subscription.id },
          data: {
            status: subscription.status,
            tier: subscription.status === 'active' || subscription.status === 'trialing' ? 'PRO' : 'FREE',
            expiresAt: new Date(subscription.current_period_end * 1000)
          }
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        await db.subscription.updateMany({
          where: { stripeId: subscription.id },
          data: {
            status: subscription.status,
            tier: 'FREE', // Explicit downgrade
            expiresAt: new Date() 
          }
        });
        break;
      }
    }

    // Mark event as processed
    await db.stripeEvent.create({ data: { id: event.id } });

    res.json({ received: true });
  } catch (error) {
    console.error('[api/billing/webhook] Error processing event:', error);
    // Return 500 so Stripe retries
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
