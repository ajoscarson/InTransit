const cron = require('node-cron');
const webpush = require('web-push');
const pool = require('../db');

function setupVapid() {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function sendPushToUser(pushSubscription, title, body) {
  if (!pushSubscription) return;

  const payload = JSON.stringify({ title, body });
  try {
    await webpush.sendNotification(pushSubscription, payload);
  } catch (err) {
    if (err.statusCode === 410) {
      // Subscription expired — remove it
      await pool.query(
        `UPDATE users SET push_subscription = NULL WHERE push_subscription->>'endpoint' = $1`,
        [pushSubscription.endpoint]
      );
    } else {
      console.error('Push notification error:', err.message);
    }
  }
}

async function runDailyNotifications() {
  console.log('[Cron] Running daily lab order notifications...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Due soon: estimated_return_date - 2 days = today
  const dueSoonDate = new Date(today);
  dueSoonDate.setDate(dueSoonDate.getDate() + 2);
  const dueSoonStr = dueSoonDate.toISOString().split('T')[0];

  // Still waiting: estimated_return_date + 3 days <= today
  const stillWaitingDate = new Date(today);
  stillWaitingDate.setDate(stillWaitingDate.getDate() - 3);
  const stillWaitingStr = stillWaitingDate.toISOString().split('T')[0];

  try {
    const { rows: dueSoonOrders } = await pool.query(
      `SELECT
         lo.id,
         lo.estimated_return_date,
         r.id AS roll_id,
         fs.name AS film_name,
         l.name AS lab_name,
         u.push_subscription
       FROM lab_orders lo
       JOIN rolls r ON r.id = lo.roll_id
       LEFT JOIN film_stocks fs ON fs.id = r.film_stock_id
       JOIN labs l ON l.id = lo.lab_id
       JOIN users u ON u.id = r.user_id
       WHERE lo.actual_return_date IS NULL
         AND lo.estimated_return_date = $1
         AND u.push_subscription IS NOT NULL`,
      [dueSoonStr]
    );

    for (const order of dueSoonOrders) {
      const filmName = order.film_name || 'Your roll';
      await sendPushToUser(
        order.push_subscription,
        'Film returning soon!',
        `${filmName} from ${order.lab_name} is expected back in 2 days.`
      );
    }

    const { rows: stillWaitingOrders } = await pool.query(
      `SELECT
         lo.id,
         lo.estimated_return_date,
         r.id AS roll_id,
         fs.name AS film_name,
         l.name AS lab_name,
         u.push_subscription
       FROM lab_orders lo
       JOIN rolls r ON r.id = lo.roll_id
       LEFT JOIN film_stocks fs ON fs.id = r.film_stock_id
       JOIN labs l ON l.id = lo.lab_id
       JOIN users u ON u.id = r.user_id
       WHERE lo.actual_return_date IS NULL
         AND lo.estimated_return_date <= $1
         AND u.push_subscription IS NOT NULL`,
      [stillWaitingStr]
    );

    for (const order of stillWaitingOrders) {
      const filmName = order.film_name || 'Your roll';
      const daysPast = Math.round(
        (today - new Date(order.estimated_return_date)) / (1000 * 60 * 60 * 24)
      );
      await sendPushToUser(
        order.push_subscription,
        'Still waiting on your film',
        `${filmName} from ${order.lab_name} is ${daysPast} day${daysPast !== 1 ? 's' : ''} overdue. Time to follow up?`
      );
    }

    console.log(
      `[Cron] Sent ${dueSoonOrders.length} due-soon + ${stillWaitingOrders.length} still-waiting notifications`
    );
  } catch (err) {
    console.error('[Cron] Notification job error:', err);
  }
}

// Run daily at 9:00 AM server time
cron.schedule('0 9 * * *', runDailyNotifications, {
  timezone: 'America/Los_Angeles',
});

console.log('[Cron] Daily notification job scheduled (9am PT)');

module.exports = { runDailyNotifications };
