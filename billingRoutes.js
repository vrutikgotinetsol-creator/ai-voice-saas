const express = require('express');
const Stripe = require('stripe');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth, requireBusinessOwner, requirePlatformAdmin } = require('../middleware/auth');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════
// Client-facing: start a Stripe Checkout session for their subscription
// ═══════════════════════════════════════════════════════════════════════
router.post('/billing/checkout', requireAuth, requireBusinessOwner, async (req, res) => {
  const { data: business } = await req.supabase
    .from('businesses')
    .select('name')
    .eq('id', req.businessId)
    .single();

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('business_id', req.businessId)
    .maybeSingle();

  let customerId = sub?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      name: business?.name,
      metadata: { business_id: req.businessId },
    });
    customerId = customer.id;
    await supabaseAdmin
      .from('subscriptions')
      .update({ stripe_customer_id: customerId })
      .eq('business_id', req.businessId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID_STANDARD, quantity: 1 }],
    success_url: `${req.headers.origin}/billing?success=true`,
    cancel_url: `${req.headers.origin}/billing?canceled=true`,
    metadata: { business_id: req.businessId },
  });

  res.json({ url: session.url });
});

// ═══════════════════════════════════════════════════════════════════════
// Client-facing: open the Stripe customer portal (manage card, cancel, etc)
// ═══════════════════════════════════════════════════════════════════════
router.post('/billing/portal', requireAuth, requireBusinessOwner, async (req, res) => {
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('business_id', req.businessId)
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

// ═══════════════════════════════════════════════════════════════════════
// Stripe webhook — keeps `subscriptions` and `businesses.status` in sync
// IMPORTANT: this route needs the RAW body for signature verification,
// so it's mounted with express.raw() in index.js BEFORE express.json().
// ═══════════════════════════════════════════════════════════════════════
async function stripeWebhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const businessId = session.metadata?.business_id;
        if (businessId) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              stripe_subscription_id: session.subscription,
              status: 'active',
            })
            .eq('business_id', businessId);
          await supabaseAdmin.from('businesses').update({ status: 'active' }).eq('id', businessId);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object;
        const { data: row } = await supabaseAdmin
          .from('subscriptions')
          .select('business_id')
          .eq('stripe_customer_id', sub.customer)
          .maybeSingle();

        if (row) {
          const statusMap = { active: 'active', trialing: 'trialing', past_due: 'past_due', canceled: 'canceled', unpaid: 'past_due' };
          await supabaseAdmin
            .from('subscriptions')
            .update({
              stripe_subscription_id: sub.id,
              status: statusMap[sub.status] || sub.status,
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            })
            .eq('business_id', row.business_id);

          if (sub.status === 'active') {
            await supabaseAdmin.from('businesses').update({ status: 'active' }).eq('id', row.business_id);
          } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
            // Don't auto-suspend on first miss — give a grace period via platform admin instead
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const { data: row } = await supabaseAdmin
          .from('subscriptions')
          .select('business_id')
          .eq('stripe_customer_id', sub.customer)
          .maybeSingle();

        if (row) {
          await supabaseAdmin.from('subscriptions').update({ status: 'canceled' }).eq('business_id', row.business_id);
          await supabaseAdmin.from('businesses').update({ status: 'cancelled' }).eq('id', row.business_id);
        }
        break;
      }
      default:
        break; // ignore other event types
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Stripe webhook] Handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

module.exports = { router, stripeWebhookHandler };
