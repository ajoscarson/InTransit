require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Stripe webhook — must come BEFORE json body parser ────────────────────────
app.use('/api/stripe-webhook', require('./routes/stripeWebhook'));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/rolls',          require('./routes/rolls'));
app.use('/api/cameras',        require('./routes/cameras'));
app.use('/api/film-stocks',    require('./routes/filmStocks'));
app.use('/api/labs',           require('./routes/labs'));
app.use('/api/lab-orders',     require('./routes/labOrders'));
app.use('/api/scans',          require('./routes/scans'));
app.use('/api/roll-locations', require('./routes/rollLocations'));
app.use('/api/roll-frames',    require('./routes/rollFrames'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/billing',        require('./routes/billing'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Film Roll Tracker API running on port ${PORT}`);
});

// ── Cron jobs ─────────────────────────────────────────────────────────────────
require('./cron/notifications');
