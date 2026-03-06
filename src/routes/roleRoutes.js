const express = require("express");
const router = express.Router();
const db = require("../config/database");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");

/* ==========================
   GET ALL ROLES
========================== */
router.get("/:id/permissions", verifyToken, async (req, res) => {
  try {
    const roleId = req.params.id;

    const [permissions] = await db.query(
      `
      SELECT p.id, p.name
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      `,
      [roleId]
    );

    res.json(permissions);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ==========================
   GET ROLE PERMISSIONS
========================== */
router.get("/", verifyToken, async (req, res) => {
  try {
    const [roles] = await db.query(
      "SELECT * FROM roles"
    );

    res.json(roles);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
/* ==========================
   UPDATE ROLE PERMISSIONS
========================== */
router.put("/:id/permissions", verifyToken, async (req, res) => {
  try {
    const roleId = req.params.id;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: "Permissions must be array" });
    }

    await db.query(
      "DELETE FROM role_permissions WHERE role_id = ?",
      [roleId]
    );

    if (permissions.length) {
      const values = permissions.map(pid => [roleId, pid]);

      await db.query(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES ?",
        [values]
      );
    }

    res.json({ message: "Permissions updated" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const ownerId = req.user.owner_id;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Role name required" });
    }

    await db.query(
      `INSERT INTO roles (owner_id, name, description)
       VALUES (?, ?, ?)`,
      [ownerId, name, description || null]
    );

    res.json({ message: "Role created" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const roleId = req.params.id;

    const [role] = await db.query(
      "SELECT name FROM roles WHERE id = ?",
      [roleId]
    );

    if (role[0]?.name === "Owner") {
      return res.status(403).json({ message: "Cannot delete Owner role" });
    }

    await db.query(
      "DELETE FROM roles WHERE id = ?",
      [roleId]
    );

    res.json({ message: "Role deleted" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;