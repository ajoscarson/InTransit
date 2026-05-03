const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// GET /api/film-stocks — list all global stocks + user's custom stocks
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT fs.*
       FROM film_stocks fs
       LEFT JOIN rolls r ON r.film_stock_id = fs.id AND r.user_id = $1
       WHERE fs.is_custom = FALSE
          OR (fs.is_custom = TRUE AND EXISTS (
                SELECT 1 FROM rolls r2
                WHERE r2.film_stock_id = fs.id AND r2.user_id = $1
              ))
       UNION
       SELECT fs.*
       FROM film_stocks fs
       WHERE fs.is_custom = TRUE
         AND EXISTS (
           SELECT 1 FROM rolls r3
           WHERE r3.film_stock_id = fs.id AND r3.user_id = $1
         )
       ORDER BY brand, name`,
      [req.user.id]
    );

    // Deduplicate (UNION already deduplicates, but let's be safe)
    const seen = new Set();
    const unique = [];
    for (const row of rows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        unique.push(row);
      }
    }

    res.json(unique);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch film stocks' });
  }
});

// POST /api/film-stocks — create custom stock
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('iso').isInt({ min: 1 }).withMessage('ISO must be a positive integer'),
    body('brand').trim().notEmpty().withMessage('Brand is required'),
    body('type').isIn(['color', 'bw', 'slide']).withMessage('Invalid type'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, iso, brand, type } = req.body;
    try {
      const { rows } = await pool.query(
        `INSERT INTO film_stocks (name, iso, brand, type, is_custom)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING *`,
        [name, iso, brand, type]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create film stock' });
    }
  }
);

module.exports = router;
