const express = require('express');
const Stripe = require('stripe');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

function getStripe() {
  return Stripe(process.env.STRIPE_SECRET_KEY);
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: null,
    features: ['Up to 5 active rolls', 'Camera management', 'Lab tracking', 'Status notifications'],
  },
  {
    id: 'solo',
    name: 'Solo',
    price: 8,
    interval: 'month',
    priceId: process.env.STRIPE_SOLO_PRICE_ID,
    features: ['Unlimited rolls', 'Scan link storage', 'All Free features', 'Priority support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 15,
    interval: 'month',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: ['Everything in Solo', 'Export data', 'Multiple labs per roll', 'Advanced analytics'],
  },
];

// GET /api/billing/plans
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

// GET /api/billing/subscription — get user's current plan
router.get('/subscription', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT plan, stripe_customer_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = rows[0];
    const plan = PLANS.find((p) => p.id === user.plan) || PLANS[0];
    res.json({ plan: user.plan, planDetails: plan, stripe_customer_id: user.stripe_customer_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// POST /api/billing/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  const { plan } = req.body;
  if (!['solo', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const priceId = plan === 'solo' ? process.env.STRIPE_SOLO_PRICE_ID : process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    return res.status(500).json({ error: 'Stripe price ID not configured' });
  }

  const stripe = getStripe();

  try {
    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { user_id: req.user.id },
      });
      customerId = customer.id;
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, req.user.id]
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/?upgraded=true`,
      cancel_url: `${process.env.CLIENT_URL}/settings`,
      metadata: { user_id: req.user.id, plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/billing/create-portal-session
router.post('/create-portal-session', async (req, res) => {
  const stripe = getStripe();

  try {
    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer found. Please upgrade first.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.CLIENT_URL}/settings`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

module.exports = router;
