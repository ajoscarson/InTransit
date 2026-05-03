const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// GET /api/lab-orders/:rollId — get lab order(s) for a roll
router.get('/:rollId', async (req, res) => {
  const { rollId } = req.params;
  try {
    // Verify roll belongs to user
    const { rows: rollRows } = await pool.query(
      'SELECT id FROM rolls WHERE id = $1 AND user_id = $2',
      [rollId, req.user.id]
    );
    if (rollRows.length === 0) {
      return res.status(404).json({ error: 'Roll not found' });
    }

    const { rows } = await pool.query(
      `SELECT lo.*, l.name AS lab_name, l.avg_turnaround_days, l.website
       FROM lab_orders lo
       JOIN labs l ON l.id = lo.lab_id
       WHERE lo.roll_id = $1
       ORDER BY lo.created_at DESC`,
      [rollId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch lab orders' });
  }
});

// POST /api/lab-orders — create lab order
router.post(
  '/',
  [
    body('roll_id').isUUID().withMessage('roll_id must be a UUID'),
    body('lab_id').isUUID().withMessage('lab_id must be a UUID'),
    body('sent_date').isDate().withMessage('sent_date must be a valid date'),
    body('service')
      .isIn(['dev_only', 'dev_scan', 'dev_scan_print'])
      .withMessage('Invalid service'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { roll_id, lab_id, sent_date, service, cost, notes, tracking_number, carrier } = req.body;

    try {
      // Verify roll belongs to user
      const { rows: rollRows } = await pool.query(
        'SELECT id FROM rolls WHERE id = $1 AND user_id = $2',
        [roll_id, req.user.id]
      );
      if (rollRows.length === 0) {
        return res.status(404).json({ error: 'Roll not found' });
      }

      // Get lab turnaround to auto-calculate estimated_return_date
      const { rows: labRows } = await pool.query(
        'SELECT avg_turnaround_days FROM labs WHERE id = $1',
        [lab_id]
      );
      if (labRows.length === 0) {
        return res.status(404).json({ error: 'Lab not found' });
      }

      let estimatedReturnDate = null;
      if (labRows[0].avg_turnaround_days) {
        const sent = new Date(sent_date);
        sent.setDate(sent.getDate() + labRows[0].avg_turnaround_days);
        estimatedReturnDate = sent.toISOString().split('T')[0];
      }

      // Create the lab order
      const { rows } = await pool.query(
        `INSERT INTO lab_orders (roll_id, lab_id, sent_date, service, estimated_return_date, cost, notes, tracking_number, carrier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [roll_id, lab_id, sent_date, service, estimatedReturnDate, cost || null, notes || null, tracking_number || null, carrier || null]
      );

      // Update roll status to 'sent'
      await pool.query(
        `UPDATE rolls SET status = 'sent' WHERE id = $1`,
        [roll_id]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create lab order' });
    }
  }
);

// PUT /api/lab-orders/:id — update lab order (e.g., mark returned)
router.put(
  '/:id',
  [
    body('actual_return_date').optional().isDate(),
    body('cost').optional().isDecimal(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { actual_return_date, estimated_return_date, cost, notes, service, tracking_number, carrier } = req.body;

    try {
      // Verify the lab order belongs to the user via roll ownership
      const { rows: orderRows } = await pool.query(
        `SELECT lo.id, lo.roll_id FROM lab_orders lo
         JOIN rolls r ON r.id = lo.roll_id
         WHERE lo.id = $1 AND r.user_id = $2`,
        [id, req.user.id]
      );
      if (orderRows.length === 0) {
        return res.status(404).json({ error: 'Lab order not found' });
      }

      const rollId = orderRows[0].roll_id;

      const { rows } = await pool.query(
        `UPDATE lab_orders SET
           actual_return_date    = COALESCE($1, actual_return_date),
           estimated_return_date = COALESCE($2, estimated_return_date),
           cost                  = COALESCE($3, cost),
           notes                 = COALESCE($4, notes),
           service               = COALESCE($5, service),
           tracking_number       = COALESCE($6, tracking_number),
           carrier               = COALESCE($7, carrier)
         WHERE id = $8
         RETURNING *`,
        [
          actual_return_date || null,
          estimated_return_date || null,
          cost !== undefined ? cost : null,
          notes !== undefined ? notes : null,
          service || null,
          tracking_number || null,
          carrier || null,
          id,
        ]
      );

      // If marking as returned, update roll status
      if (actual_return_date) {
        await pool.query(
          `UPDATE rolls SET status = 'returned' WHERE id = $1`,
          [rollId]
        );
      }

      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update lab order' });
    }
  }
);

module.exports = router;
