const express = require('express');
const router = express.Router();
const db = require('../config/database');
const verifyToken = require('../middleware/authMiddleware');

// CREATE CUSTOMER
router.post("/", verifyToken, async (req, res) => {
  try {
    const ownerId = req.user.owner_id;
    const { name, phone, gender, birth_date } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        message: "Name and phone required"
      });
    }

    // cek apakah phone sudah ada
    const [existing] = await db.query(
      "SELECT id FROM customers WHERE owner_id = ? AND phone = ?",
      [ownerId, phone]
    );

    if (existing.length) {
      return res.status(409).json({
        message: "Customer with this phone already exists"
      });
    }

    // insert customer
    const [result] = await db.query(
      `
      INSERT INTO customers
      (owner_id, name, phone, gender, birth_date)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        ownerId,
        name,
        phone,
        gender || null,
        birth_date || null
      ]
    );

    // ambil customer yang baru dibuat
    const [customers] = await db.query(
      `
      SELECT id, name, phone, gender, birth_date
      FROM customers
      WHERE id = ?
      `,
      [result.insertId]
    );

    res.status(201).json({
      message: "Customer created successfully",
      customer: customers[0]
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


// GET ALL / SEARCH CUSTOMERS
router.get("/", verifyToken, async (req, res) => {
  try {
    const ownerId = req.user.owner_id;
    const keyword = req.query.q || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, name, phone
      FROM customers
      WHERE owner_id = ?
    `;

    let params = [ownerId];

    if (keyword) {
      query += ` AND (phone LIKE ? OR name LIKE ?)`;
      params.push(`${keyword}%`, `${keyword}%`);
    }

    query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [customers] = await db.query(query, params);

    res.json(customers);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;