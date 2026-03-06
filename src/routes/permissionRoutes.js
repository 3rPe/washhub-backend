const express = require('express');
const router = express.Router();
const db = require('../config/database');
const verifyToken = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

/* ==========================
   GET ALL PERMISSIONS
========================== */
router.get('/', verifyToken, async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM permissions");
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================
   GET ROLE PERMISSIONS
========================== */
router.get(
  '/role/:roleId',
  verifyToken,
  checkPermission("view_user"),
  (req, res) => {

    const roleId = req.params.roleId;

    db.query(
      `
      SELECT p.id, p.name
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      `,
      [roleId],
      (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
      }
    );
  }
);

/* ==========================
   ASSIGN PERMISSION TO ROLE
========================== */
router.post(
  '/assign',
  verifyToken,
  checkPermission("create_user"), // yg boleh manage role
  (req, res) => {

    const { role_id, permission_id } = req.body;

    if (!role_id || !permission_id) {
      return res.status(400).json({ message: "role_id and permission_id required" });
    }

    db.query(
      `
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (?, ?)
      `,
      [role_id, permission_id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Permission assigned to role" });
      }
    );
  }
);

/* ==========================
   REVOKE PERMISSION FROM ROLE
========================== */
router.delete(
  '/revoke',
  verifyToken,
  checkPermission("delete_user"),
  (req, res) => {

    const { role_id, permission_id } = req.body;

    db.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = ? AND permission_id = ?
      `,
      [role_id, permission_id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Permission revoked from role" });
      }
    );
  }
);

module.exports = router;