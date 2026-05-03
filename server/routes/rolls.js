const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// GET /api/rolls — list user's rolls with camera name, film stock name, latest lab order info
router.get('/', async (req, res) => {
  const { status } = req.query;

  try {
    const params = [req.user.id];
    let statusClause = '';
    if (status) {
      params.push(status);
      statusClause = `AND r.status = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT
         r.*,
         c.name        AS camera_name,
         c.format      AS camera_format,
         fs.name       AS film_stock_name,
         fs.brand      AS film_stock_brand,
         fs.iso        AS film_stock_iso,
         lo.id         AS lab_order_id,
         lo.lab_id,
         l.name        AS lab_name,
         lo.service,
         lo.sent_date,
         lo.estimated_return_date,
         lo.actual_return_date,
         lo.cost
       FROM rolls r
       LEFT JOIN cameras     c  ON c.id = r.camera_id
       LEFT JOIN film_stocks fs ON fs.id = r.film_stock_id
       LEFT JOIN LATERAL (
         SELECT * FROM lab_orders WHERE roll_id = r.id ORDER BY created_at DESC LIMIT 1
       ) lo ON TRUE
       LEFT JOIN labs l ON l.id = lo.lab_id
       WHERE r.user_id = $1 ${statusClause}
       ORDER BY r.created_at DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rolls' });
  }
});

// POST /api/rolls — create roll (enforce free tier 5-roll limit on active rolls)
router.post(
  '/',
  [
    body('shoot_date').optional().isDate().withMessage('shoot_date must be a valid date'),
    body('frames_shot').optional().isInt({ min: 1 }).withMessage('frames_shot must be a positive integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Free tier: max 5 active (non-archived) rolls
    if (req.user.plan === 'free') {
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) AS cnt FROM rolls WHERE user_id = $1 AND status != 'archived'`,
        [req.user.id]
      );
      if (parseInt(countRows[0].cnt, 10) >= 5) {
        return res.status(403).json({
          error: 'Free plan limit reached. Upgrade to Solo or Pro to track more rolls.',
          code: 'FREE_TIER_LIMIT',
        });
      }
    }

    const { camera_id, film_stock_id, location, shoot_date, notes, frames_shot, push_pull } = req.body;

    try {
      const { rows } = await pool.query(
        `INSERT INTO rolls (user_id, camera_id, film_stock_id, location, shoot_date, notes, frames_shot, push_pull)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          req.user.id,
          camera_id || null,
          film_stock_id || null,
          location || null,
          shoot_date || null,
          notes || null,
          frames_shot || null,
          push_pull || null,
        ]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create roll' });
    }
  }
);

// PUT /api/rolls/:id — update roll
router.put(
  '/:id',
  [
    body('status').optional().isIn(['shot', 'sent', 'developing', 'returned', 'archived']),
    body('frames_shot').optional().isInt({ min: 1 }),
    body('shoot_date').optional().isDate(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { camera_id, film_stock_id, location, shoot_date, notes, frames_shot, push_pull, status } = req.body;

    try {
      const { rows } = await pool.query(
        `UPDATE rolls SET
           camera_id     = COALESCE($1, camera_id),
           film_stock_id = COALESCE($2, film_stock_id),
           location      = COALESCE($3, location),
           shoot_date    = COALESCE($4, shoot_date),
           notes         = COALESCE($5, notes),
           frames_shot   = COALESCE($6, frames_shot),
           push_pull     = COALESCE($7, push_pull),
           status        = COALESCE($8, status)
         WHERE id = $9 AND user_id = $10
         RETURNING *`,
        [
          camera_id || null,
          film_stock_id || null,
          location !== undefined ? location : null,
          shoot_date || null,
          notes !== undefined ? notes : null,
          frames_shot || null,
          push_pull !== undefined ? push_pull : null,
          status || null,
          id,
          req.user.id,
        ]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Roll not found' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update roll' });
    }
  }
);

// DELETE /api/rolls/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM rolls WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Roll not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete roll' });
  }
});

module.exports = router;
