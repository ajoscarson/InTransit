const { createRemoteJWKSet, jwtVerify } = require('jose');
const pool = require('../db');

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    const result = await jwtVerify(token, JWKS);
    payload = result.payload;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const supabaseId = payload.sub;
  const email = payload.email || '';

  try {
    await pool.query(
      `INSERT INTO users (supabase_id, email)
       VALUES ($1, $2)
       ON CONFLICT (supabase_id) DO NOTHING`,
      [supabaseId, email]
    );

    const { rows } = await pool.query(
      'SELECT id, email, plan, push_subscription, stripe_customer_id FROM users WHERE supabase_id = $1',
      [supabaseId]
    );

    if (rows.length === 0) {
      return res.status(500).json({ error: 'User record not found after upsert' });
    }

    req.user = {
      id: rows[0].id,
      supabase_id: supabaseId,
      email: rows[0].email,
      plan: rows[0].plan,
      push_subscription: rows[0].push_subscription,
      stripe_customer_id: rows[0].stripe_customer_id,
    };

    next();
  } catch (err) {
    console.error('Auth middleware DB error:', err);
    return res.status(500).json({ error: 'Internal server error during auth' });
  }
}

module.exports = auth;
