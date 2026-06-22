import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../lib/supabase';
import { requireAuth, requireBusinessOwner, getAuthReq } from '../../middleware/auth';
import { env } from '../../config/env';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
const router = Router();

const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  starter: env.STRIPE_PRICE_STARTER,
  professional: env.STRIPE_PRICE_PROFESSIONAL,
  enterprise: env.STRIPE_PRICE_ENTERPRISE,
};

router.post('/checkout', requireAuth, requireBusinessOwner, async (req, res: Response) => {
  if (!stripe) return res.status(503).json({ error: 'Billing not configured' });

  const authReq = getAuthReq(req);
  const planSlug = (req.body.planSlug as string) || 'professional';
  const priceId = PLAN_PRICE_MAP[planSlug] || env.STRIPE_PRICE_PROFESSIONAL;

  if (!priceId) return res.status(400).json({ error: 'Invalid plan or Stripe price not configured' });

  const { data: business } = await authReq.supabase
    .from('businesses')
    .select('name')
    .eq('id', authReq.businessId!)
    .single();

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id, plan_id, plans(slug)')
    .eq('business_id', authReq.businessId!)
    .maybeSingle();

  let customerId = sub?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: authReq.user.email,
      name: business?.name,
      metadata: { business_id: authReq.businessId! },
    });
    customerId = customer.id;
    await supabaseAdmin
      .from('subscriptions')
      .update({ stripe_customer_id: customerId })
      .eq('business_id', authReq.businessId!);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${req.headers.origin}/billing?success=true`,
    cancel_url: `${req.headers.origin}/billing?canceled=true`,
    metadata: { business_id: authReq.businessId!, plan_slug: planSlug },
  });

  res.json({ url: session.url });
});

router.post('/portal', requireAuth, requireBusinessOwner, async (req, res: Response) => {
  if (!stripe) return res.status(503).json({ error: 'Billing not configured' });

  const authReq = getAuthReq(req);
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('business_id', authReq.businessId!)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return res.status(400).json({ error: 'No billing account yet — start a subscription first.' });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${req.headers.origin}/billing`,
  });

  res.json({ url: session.url });
});

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: 'Stripe not configured' });
    return;
  }

  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Stripe webhook] Signature verification failed:', message);
    res.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const businessId = session.metadata?.business_id;
        const planSlug = session.metadata?.plan_slug;

        if (businessId) {
          let planId: string | null = null;
          if (planSlug) {
            const { data: plan } = await supabaseAdmin
              .from('plans')
              .select('id, amount_cents')
              .eq('slug', planSlug)
              .maybeSingle();
            planId = plan?.id ?? null;
          }

          await supabaseAdmin
            .from('subscriptions')
            .update({
              stripe_subscription_id: session.subscription as string,
              status: 'active',
              ...(planId ? { plan_id: planId } : {}),
            })
            .eq('business_id', businessId);
          await supabaseAdmin.from('businesses').update({ status: 'active' }).eq('id', businessId);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const { data: row } = await supabaseAdmin
          .from('subscriptions')
          .select('business_id')
          .eq('stripe_customer_id', sub.customer as string)
          .maybeSingle();

        if (row) {
          const statusMap: Record<string, string> = {
            active: 'active',
            trialing: 'trialing',
            past_due: 'past_due',
            canceled: 'canceled',
            unpaid: 'past_due',
          };
          await supabaseAdmin
            .from('subscriptions')
            .update({
              stripe_subscription_id: sub.id,
              status: statusMap[sub.status] || sub.status,
              current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              cancel_at_period_end: sub.cancel_at_period_end,
            })
            .eq('business_id', row.business_id);

          if (sub.status === 'active') {
            await supabaseAdmin.from('businesses').update({ status: 'active' }).eq('id', row.business_id);
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const { data: row } = await supabaseAdmin
          .from('subscriptions')
          .select('business_id')
          .eq('stripe_customer_id', sub.customer as string)
          .maybeSingle();

        if (row) {
          await supabaseAdmin.from('subscriptions').update({ status: 'canceled' }).eq('business_id', row.business_id);
          await supabaseAdmin.from('businesses').update({ status: 'cancelled' }).eq('id', row.business_id);
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Stripe webhook] Handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

export default router;
