const express = require('express');
const Stripe = require('stripe');
const pool = require('../db');

const router = express.Router();

// NOTE: This route must receive raw body — do not use express.json() here.
// The main app mounts this BEFORE json middleware, passing rawBody via express.raw().

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;

        if (userId && plan && ['solo', 'pro'].includes(plan)) {
          await pool.query(
            'UPDATE users SET plan = $1 WHERE id = $2',
            [plan, userId]
          );
          console.log(`Upgraded user ${userId} to ${plan}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await pool.query(
          `UPDATE users SET plan = 'free' WHERE stripe_customer_id = $1`,
          [customerId]
        );
        console.log(`Downgraded customer ${customerId} to free`);
        break;
      }

      case 'customer.subscription.updated': {
        // Handle plan changes (e.g., solo -> pro or pro -> solo)
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        if (status === 'active') {
          // Determine plan from price ID
          const priceId = subscription.items?.data[0]?.price?.id;
          let newPlan = null;
          if (priceId === process.env.STRIPE_SOLO_PRICE_ID) newPlan = 'solo';
          if (priceId === process.env.STRIPE_PRO_PRICE_ID) newPlan = 'pro';

          if (newPlan) {
            await pool.query(
              'UPDATE users SET plan = $1 WHERE stripe_customer_id = $2',
              [newPlan, customerId]
            );
            console.log(`Updated customer ${customerId} to ${newPlan}`);
          }
        } else if (['canceled', 'unpaid', 'past_due'].includes(status)) {
          await pool.query(
            `UPDATE users SET plan = 'free' WHERE stripe_customer_id = $1`,
            [customerId]
          );
        }
        break;
      }

      default:
        // Ignore other events
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.json({ received: true });
});

module.exports = router;
