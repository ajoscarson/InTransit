const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/roll-frames/:rollId
router.get('/:rollId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT rf.*, rl.location AS location_name
       FROM roll_frames rf
       JOIN rolls r ON r.id = rf.roll_id
       LEFT JOIN roll_locations rl ON rl.id = rf.location_id
       WHERE rf.roll_id = $1 AND r.user_id = $2
       ORDER BY rf.frame_number ASC`,
      [req.params.rollId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch frames' });
  }
});

// POST /api/roll-frames
router.post(
  '/',
  [
    body('roll_id').notEmpty(),
    body('frame_number').isInt({ min: 1 }).withMessage('Frame number required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      roll_id, frame_number, aperture, shutter_speed, notes, location_id,
      metered_aperture, metered_shutter, tags, latitude, longitude,
    } = req.body;

    try {
      const { rowCount } = await pool.query(
        'SELECT 1 FROM rolls WHERE id = $1 AND user_id = $2',
        [roll_id, req.user.id]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'Roll not found' });

      const { rows } = await pool.query(
        `INSERT INTO roll_frames
           (roll_id, frame_number, aperture, shutter_speed, notes, location_id,
            metered_aperture, metered_shutter, tags, latitude, longitude)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (roll_id, frame_number) DO UPDATE SET
           aperture         = $3,
           shutter_speed    = $4,
           notes            = $5,
           location_id      = $6,
           metered_aperture = $7,
           metered_shutter  = $8,
           tags             = $9,
           latitude         = $10,
           longitude        = $11
         RETURNING *`,
        [
          roll_id, frame_number,
          aperture || null, shutter_speed || null, notes || null, location_id || null,
          metered_aperture || null, metered_shutter || null,
          tags || null, latitude ?? null, longitude ?? null,
        ]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to log frame' });
    }
  }
);

// PUT /api/roll-frames/:id
router.put('/:id', async (req, res) => {
  const {
    aperture, shutter_speed, notes, location_id,
    metered_aperture, metered_shutter, tags,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE roll_frames rf SET
         aperture         = $1,
         shutter_speed    = $2,
         notes            = $3,
         location_id      = $4,
         metered_aperture = $5,
         metered_shutter  = $6,
         tags             = $7
       FROM rolls r
       WHERE rf.id = $8 AND rf.roll_id = r.id AND r.user_id = $9
       RETURNING rf.*`,
      [
        aperture || null, shutter_speed || null, notes || null, location_id || null,
        metered_aperture || null, metered_shutter || null,
        tags || null,
        req.params.id, req.user.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Frame not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update frame' });
  }
});

// DELETE /api/roll-frames/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM roll_frames rf
       USING rolls r
       WHERE rf.id = $1 AND rf.roll_id = r.id AND r.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Frame not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete frame' });
  }
});

module.exports = router;
