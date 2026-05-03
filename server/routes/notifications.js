const express = require('express');
const webpush = require('web-push');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// POST /api/notifications/subscribe — save push subscription
router.post('/subscribe', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  try {
    await pool.query(
      'UPDATE users SET push_subscription = $1 WHERE id = $2',
      [JSON.stringify(subscription), req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

// POST /api/notifications/test — send a test push notification
router.post('/test', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT push_subscription FROM users WHERE id = $1',
    [req.user.id]
  );

  const pushSub = rows[0]?.push_subscription;
  if (!pushSub) {
    return res.status(400).json({ error: 'No push subscription found. Enable notifications first.' });
  }

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const payload = JSON.stringify({
    title: 'Film Roll Tracker',
    body: 'Push notifications are working!',
  });

  try {
    await webpush.sendNotification(pushSub, payload);
    res.json({ success: true });
  } catch (err) {
    console.error('Push send error:', err);
    if (err.statusCode === 410) {
      // Subscription expired — clean it up
      await pool.query('UPDATE users SET push_subscription = NULL WHERE id = $1', [req.user.id]);
    }
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

module.exports = router;
