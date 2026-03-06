const express = require("express");
const router = express.Router();
const db = require("../config/database");
const bcrypt = require("bcrypt");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");

/* ======================================================
   GET ALL USERS
====================================================== */
router.get(
  "/",
  verifyToken,
  async (req, res) => {
    try {
      const ownerId = req.user.owner_id;

      const [users] = await db.query(
        `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.outlet_id,
          r.name AS role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.owner_id = ?
        AND u.is_primary_owner = 0
        ORDER BY u.created_at DESC
        `,
        [ownerId]
      );

      res.json(users);

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/* ======================================================
   GET USER DETAIL
====================================================== */
router.get(
  "/:id",
  verifyToken,
  checkPermission("view_user"),
  async (req, res) => {
    try {
      const ownerId = req.user.owner_id;
      const userId = req.params.id;

      const [users] = await db.query(
        `
        SELECT u.id, u.name, u.email, u.phone, u.outlet_id,
               r.id AS role_id, r.name AS role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = ? AND u.owner_id = ?
        `,
        [userId, ownerId]
      );

      if (!users.length) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(users[0]);

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/* ======================================================
   CREATE USER
====================================================== */
router.post(
  "/",
  verifyToken,
  checkPermission("create_user"),
  async (req, res) => {
    try {
      const ownerId = req.user.owner_id;
      const { name, email, password, role_id, outlet_id } = req.body;

      if (!name || !email || !password || !role_id) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const [existing] = await db.query(
        "SELECT id FROM users WHERE email = ?",
        [email]
      );

      if (existing.length) {
        return res.status(400).json({ message: "Email already used" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await db.query(
        `
        INSERT INTO users
        (owner_id, name, email, password, role_id, outlet_id)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [ownerId, name, email, hashedPassword, role_id, outlet_id || null]
      );

      res.status(201).json({
        message: "User created successfully",
        user_id: result.insertId
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/* ======================================================
   UPDATE USER
====================================================== */
router.put(
  "/:id",
  verifyToken,
  checkPermission("edit_user"),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const ownerId = req.user.owner_id;
      const { name, email, role_id, outlet_id } = req.body;

      const [result] = await db.query(
        `
        UPDATE users
        SET name = ?, email = ?, role_id = ?, outlet_id = ?
        WHERE id = ? AND owner_id = ?
        `,
        [name, email, role_id, outlet_id || null, userId, ownerId]
      );

      if (!result.affectedRows) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "User updated successfully" });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/* ======================================================
   DELETE USER
====================================================== */
router.delete(
  "/:id",
  verifyToken,
  checkPermission("delete_user"),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const ownerId = req.user.owner_id;

      const [result] = await db.query(
        "DELETE FROM users WHERE id = ? AND owner_id = ?",
        [userId, ownerId]
      );

      if (!result.affectedRows) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "User deleted successfully" });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;