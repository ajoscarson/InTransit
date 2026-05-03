const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const uid = req.user.id;

  try {
    const [
      overview,
      cameras,
      filmStocks,
      filmTypes,
      labs,
      monthlyActivity,
      pushPull,
      personalBests,
    ] = await Promise.all([
      // Overview
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status != 'archived') AS total_rolls,
          COUNT(*) FILTER (WHERE status != 'archived' AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())) AS rolls_this_year,
          COUNT(*) FILTER (WHERE status != 'archived' AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW()) - 1) AS rolls_last_year,
          COALESCE(SUM(frames_shot) FILTER (WHERE status != 'archived'), 0) AS total_frames,
          COALESCE((SELECT SUM(lo.cost) FROM lab_orders lo JOIN rolls r ON r.id = lo.roll_id WHERE r.user_id = $1), 0) AS total_spent
        FROM rolls WHERE user_id = $1
      `, [uid]),

      // Cameras
      pool.query(`
        SELECT c.name, COUNT(r.id) AS roll_count
        FROM rolls r
        JOIN cameras c ON c.id = r.camera_id
        WHERE r.user_id = $1 AND r.status != 'archived'
        GROUP BY c.id, c.name
        ORDER BY roll_count DESC
      `, [uid]),

      // Film stocks
      pool.query(`
        SELECT fs.name, fs.brand, fs.type, COUNT(r.id) AS roll_count
        FROM rolls r
        JOIN film_stocks fs ON fs.id = r.film_stock_id
        WHERE r.user_id = $1 AND r.status != 'archived'
        GROUP BY fs.id, fs.name, fs.brand, fs.type
        ORDER BY roll_count DESC
      `, [uid]),

      // Film type breakdown
      pool.query(`
        SELECT fs.type, COUNT(r.id) AS roll_count
        FROM rolls r
        JOIN film_stocks fs ON fs.id = r.film_stock_id
        WHERE r.user_id = $1 AND r.status != 'archived'
        GROUP BY fs.type
      `, [uid]),

      // Labs
      pool.query(`
        SELECT
          l.name,
          COUNT(lo.id) AS roll_count,
          ROUND(AVG(lo.cost) FILTER (WHERE lo.cost IS NOT NULL), 2) AS avg_cost,
          COUNT(lo.id) FILTER (WHERE lo.actual_return_date IS NOT NULL AND lo.sent_date IS NOT NULL) AS turnaround_count,
          ROUND(AVG(lo.actual_return_date - lo.sent_date) FILTER (WHERE lo.actual_return_date IS NOT NULL AND lo.sent_date IS NOT NULL)) AS avg_turnaround_days
        FROM lab_orders lo
        JOIN labs l ON l.id = lo.lab_id
        JOIN rolls r ON r.id = lo.roll_id
        WHERE r.user_id = $1
        GROUP BY l.id, l.name
        ORDER BY roll_count DESC
      `, [uid]),

      // Monthly activity (current year)
      pool.query(`
        SELECT EXTRACT(MONTH FROM shoot_date) AS month, COUNT(*) AS roll_count
        FROM rolls
        WHERE user_id = $1
          AND status != 'archived'
          AND EXTRACT(YEAR FROM shoot_date) = EXTRACT(YEAR FROM NOW())
          AND shoot_date IS NOT NULL
        GROUP BY month
        ORDER BY month
      `, [uid]),

      // Push/pull breakdown
      pool.query(`
        SELECT push_pull, COUNT(*) AS roll_count
        FROM rolls
        WHERE user_id = $1 AND status != 'archived' AND push_pull IS NOT NULL
        GROUP BY push_pull
        ORDER BY roll_count DESC
      `, [uid]),

      // Personal bests
      pool.query(`
        SELECT
          (SELECT r.id FROM rolls r
           WHERE r.user_id = $1 AND r.status IN ('shot','sent','developing') AND r.shoot_date IS NOT NULL
           ORDER BY r.shoot_date ASC LIMIT 1) AS oldest_active_roll_id,
          (SELECT COALESCE(r.location, fs.name, 'Unknown')
           FROM rolls r LEFT JOIN film_stocks fs ON fs.id = r.film_stock_id
           WHERE r.user_id = $1 AND r.status IN ('shot','sent','developing') AND r.shoot_date IS NOT NULL
           ORDER BY r.shoot_date ASC LIMIT 1) AS oldest_active_roll_name,
          (SELECT NOW()::date - r.shoot_date
           FROM rolls r
           WHERE r.user_id = $1 AND r.status IN ('shot','sent','developing') AND r.shoot_date IS NOT NULL
           ORDER BY r.shoot_date ASC LIMIT 1) AS oldest_active_days,
          (SELECT lo.actual_return_date - lo.sent_date
           FROM lab_orders lo JOIN rolls r ON r.id = lo.roll_id
           WHERE r.user_id = $1 AND lo.actual_return_date IS NOT NULL AND lo.sent_date IS NOT NULL
           ORDER BY (lo.actual_return_date - lo.sent_date) ASC LIMIT 1) AS fastest_turnaround_days,
          (SELECT l.name FROM lab_orders lo
           JOIN labs l ON l.id = lo.lab_id JOIN rolls r ON r.id = lo.roll_id
           WHERE r.user_id = $1 AND lo.actual_return_date IS NOT NULL AND lo.sent_date IS NOT NULL
           ORDER BY (lo.actual_return_date - lo.sent_date) ASC LIMIT 1) AS fastest_turnaround_lab,
          (SELECT MAX(frame_count) FROM (
             SELECT COUNT(*) AS frame_count FROM roll_frames rf
             JOIN rolls r ON r.id = rf.roll_id WHERE r.user_id = $1
             GROUP BY rf.roll_id
           ) fc) AS most_frames_on_roll
      `, [uid]),
    ]);

    res.json({
      overview: overview.rows[0],
      cameras: cameras.rows,
      filmStocks: filmStocks.rows,
      filmTypes: filmTypes.rows,
      labs: labs.rows,
      monthlyActivity: monthlyActivity.rows,
      pushPull: pushPull.rows,
      personalBests: personalBests.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
