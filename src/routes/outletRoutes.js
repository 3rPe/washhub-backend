const express = require("express");
const router = express.Router();
const db = require("../config/database");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");

/* ==========================
   CREATE OUTLET
========================== */
router.post(
  "/",
  verifyToken,
  checkPermission("create_outlet"),
  async (req, res) => {
    try {
      const ownerId = req.user.owner_id;
      const { name, phone, address, latitude, longitude, radius_meter } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Outlet name required" });
      }

      const [result] = await db.query(
        `
        INSERT INTO outlets 
        (owner_id, name, phone, address, latitude, longitude, radius_meter)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          ownerId,
          name,
          phone || null,
          address || null,
          latitude || null,
          longitude || null,
          radius_meter || 100
        ]
      );

      res.status(201).json({
        message: "Outlet created successfully",
        outlet_id: result.insertId
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/* ==========================
   GET ALL OUTLETS
========================== */
router.get("/", verifyToken, async (req, res) => {
  try {
    console.log("REQ USER:", req.user);

    const ownerId = req.user.owner_id;
    console.log("OWNER ID:", ownerId);

    const [outlets] = await db.query(
      "SELECT * FROM outlets WHERE owner_id = ?",
      [ownerId]
    );

    console.log("DB RESULT:", outlets);

    res.json(outlets);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ==========================
   GET SINGLE OUTLET
========================== */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const ownerId = req.user.owner_id;
    const outletId = req.params.id;

    const [outlets] = await db.query(
      "SELECT * FROM outlets WHERE id = ? AND owner_id = ?",
      [outletId, ownerId]
    );

    if (!outlets.length) {
      return res.status(404).json({ message: "Outlet not found" });
    }

    res.json(outlets[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ==========================
   UPDATE OUTLET
========================== */
router.put(
  "/:id",
  verifyToken,
  checkPermission("edit_outlet"),
  async (req, res) => {
    try {
      const ownerId = req.user.owner_id;
      const outletId = req.params.id;
      const { name, phone, address, latitude, longitude, radius_meter } = req.body;

      const [result] = await db.query(
        `
        UPDATE outlets
        SET 
          name = ?, 
          phone = ?, 
          address = ?, 
          latitude = ?, 
          longitude = ?, 
          radius_meter = ?
        WHERE id = ? AND owner_id = ?
        `,
        [
          name,
          phone || null,
          address || null,
          latitude || null,
          longitude || null,
          radius_meter || 100,
          outletId,
          ownerId
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({ message: "Outlet not found" });
      }

      res.json({ message: "Outlet updated successfully" });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/* ==========================
   DELETE OUTLET
========================== */
router.delete(
  "/:id",
  verifyToken,
  checkPermission("delete_outlet"),
  async (req, res) => {
    try {
      const ownerId = req.user.owner_id;
      const outletId = req.params.id;

      const [result] = await db.query(
        "DELETE FROM outlets WHERE id = ? AND owner_id = ?",
        [outletId, ownerId]
      );

      if (!result.affectedRows) {
        return res.status(404).json({ message: "Outlet not found" });
      }

      res.json({ message: "Outlet deleted successfully" });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;