const express = require('express');
const router = express.Router();
const db = require('../config/database');
const verifyToken = require('../middleware/authMiddleware');


router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      name,
      price,
      unit,
      duration_day,
      duration_hour,
      outlet_id
    } = req.body;

    const owner_id = req.user.owner_id;

    const [existing] = await db.query(
      `
      SELECT id, is_active
      FROM services
      WHERE outlet_id = ? AND name = ?
      `,
      [outlet_id, name]
    );

    if (existing.length > 0) {
      if (existing[0].is_active === 0) {
        await db.query(
          `
          UPDATE services
          SET unit = ?, price = ?, duration_day = ?, duration_hour = ?, is_active = 1
          WHERE id = ?
          `,
          [unit, price, duration_day || 0, duration_hour || 0, existing[0].id]
        );

        return res.json({ message: "Service restored successfully" });
      }

      return res.status(400).json({ message: "Service already exists" });
    }

    await db.query(
      `
      INSERT INTO services 
      (owner_id, outlet_id, name, unit, price, duration_day, duration_hour, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        owner_id,
        outlet_id,
        name,
        unit,
        price,
        duration_day || 0,
        duration_hour || 0
      ]
    );

    res.status(201).json({ message: "Service created" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET SERVICES PER OUTLET
router.get("/:outletId", verifyToken, async (req, res) => {
  try {
    const outletId = req.params.outletId;

    const [services] = await db.query(
      `
      SELECT id, name, unit, price, duration_day, duration_hour
      FROM services
      WHERE outlet_id = ? AND is_active = 1
      `,
      [outletId]
    );

    res.json(services);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// SOFT DELETE SERVICE
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const serviceId = req.params.id;

    await db.query(
      `
      UPDATE services
      SET is_active = 0
      WHERE id = ?
      `,
      [serviceId]
    );

    res.json({ message: "Service deactivated successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;