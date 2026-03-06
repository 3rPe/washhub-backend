const express = require("express");
const router = express.Router();
const db = require("../config/database");
const bcrypt = require("bcrypt");
const verifyToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");



/* ===============================
   GET ALL OWNERS (Super Admin)
================================ */
router.get("/", requireRole("superadmin"), (req, res) => {
  db.query(
    `SELECT id, name, email, phone, status, trial_start, trial_end, is_internal
     FROM owners
     WHERE deleted_at IS NULL
     ORDER BY id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

/* ===============================
   GET OWNER BY ID
================================ */
router.get("/:id", requireRole("superadmin"), (req, res) => {
  db.query(
    `SELECT id, name, email, phone, status, trial_start, trial_end, is_internal
     FROM owners
     WHERE id = ? AND deleted_at IS NULL`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results[0]);
    }
  );
});

/* ===============================
   CREATE OWNER + LOGIN ACCOUNT
================================ */
router.post("/", requireRole("superadmin"), async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Required fields missing"
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      `INSERT INTO owners (name, email, phone, status)
       VALUES (?, ?, ?, 'trial')`,
      [name, email, phone],
      (err, ownerResult) => {
        if (err) return res.status(500).json({ error: err.message });

        const ownerId = ownerResult.insertId;

        db.query(
          `INSERT INTO users (owner_id, name, email, password, is_owner)
           VALUES (?, ?, ?, ?, 1)`,
          [ownerId, name, email, hashedPassword],
          (err) => {
            if (err)
              return res.status(500).json({ error: err.message });

            res.status(201).json({
              message: "Owner created successfully"
            });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   UPDATE OWNER
================================ */
router.put("/:id", requireRole("superadmin"), (req, res) => {
  const {
    name,
    email,
    phone,
    status,
    trial_start,
    trial_end,
    is_internal
  } = req.body;

  db.query(
    `UPDATE owners
     SET name=?, email=?, phone=?, status=?, trial_start=?, trial_end=?, is_internal=?
     WHERE id=?`,
    [
      name,
      email,
      phone,
      status,
      trial_start,
      trial_end,
      is_internal,
      req.params.id
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Owner updated successfully" });
    }
  );
});

/* ===============================
   CHANGE STATUS ONLY
================================ */
router.put("/:id/status", requireRole("superadmin"), (req, res) => {
  db.query(
    `UPDATE owners SET status=? WHERE id=?`,
    [req.body.status, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Status updated" });
    }
  );
});

/* ===============================
   DELETE (SOFT DELETE)
================================ */
router.delete("/:id", requireRole("superadmin"), (req, res) => {
  db.query(
    `UPDATE owners SET deleted_at = NOW() WHERE id = ?`,
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Owner deleted" });
    }
  );
});

/* ===============================
   RESET OWNER PASSWORD
================================ */
router.put("/:id/reset-password", requireRole("superadmin"), async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({
      message: "New password required"
    });
  }

  try {
    const hashed = await bcrypt.hash(newPassword, 10);

    db.query(
      `UPDATE users 
       SET password=? 
       WHERE owner_id=? AND is_owner=1`,
      [hashed, req.params.id],
      (err, result) => {
        if (err)
          return res.status(500).json({ error: err.message });

        if (result.affectedRows === 0) {
          return res.status(404).json({
            message: "Owner login not found"
          });
        }

        res.json({
          message: "Password reset successful"
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;