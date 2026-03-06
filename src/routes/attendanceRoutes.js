const express = require("express");
const router = express.Router();
const db = require("../config/database");
const verifyToken = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");


// ==============================
// CREATE UPLOAD FOLDER
// ==============================

const uploadPath = "uploads/attendances";

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}


// ==============================
// MULTER CONFIG
// ==============================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {

    const allowed = ["image/jpeg", "image/png", "image/jpg"];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only image files allowed"));
    }

    cb(null, true);
  }
});


// ==============================
// HELPER: GET TODAY DATE (WIB)
// ==============================

function getTodayDateWIB() {

  const now = new Date();

  return new Date(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Jakarta"
    })
  )
    .toISOString()
    .slice(0, 10);
}


// ==============================
// CHECK IN
// ==============================

router.post(
  "/checkin",
  verifyToken,
  upload.single("photo"),
  async (req, res) => {

    try {

      const ownerId = req.user.owner_id;
      const userId = req.user.user_id;

      const { latitude, longitude, work_location } = req.body;

      const attendanceDate = getTodayDateWIB();

      if (!latitude || !longitude) {
        return res.status(400).json({
          message: "Location required"
        });
      }

      const [existing] = await db.query(
        `
        SELECT id
        FROM attendances
        WHERE user_id = ?
        AND attendance_date = ?
        `,
        [userId, attendanceDate]
      );

      if (existing.length) {
        return res.status(400).json({
          message: "Already checked in today"
        });
      }

      const [users] = await db.query(
        `
        SELECT 
          e.outlet_id,
          e.full_name,
          e.employee_code
        FROM users u
        LEFT JOIN employees e
        ON u.employee_id = e.id
        WHERE u.id = ?
        `,
        [userId]
      );

      if (!users.length) {
        return res.status(404).json({
          message: "User not found"
        });
      }

      const userData = users[0];

      if (!userData.outlet_id) {
        return res.status(400).json({
          message: "Employee has no outlet"
        });
      }

      await db.query(
        `
        INSERT INTO attendances
        (
          owner_id,
          user_id,
          outlet_id,
          employee_name,
          employee_code,
          latitude,
          longitude,
          work_location,
          attendance_date,
          check_in,
          check_in_photo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        `,
        [
          ownerId,
          userId,
          userData.outlet_id,
          userData.full_name,
          userData.employee_code,
          latitude,
          longitude,
          work_location || null,
          attendanceDate,
          req.file ? req.file.filename : null
        ]
      );

      res.json({
        message: "Check-in successful"
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ==============================
// CHECK OUT
// ==============================

router.post(
  "/checkout",
  verifyToken,
  upload.single("photo"),
  async (req, res) => {

    try {

      const userId = req.user.user_id;

      const attendanceDate = getTodayDateWIB();

      const [rows] = await db.query(
        `
        SELECT *
        FROM attendances
        WHERE user_id = ?
        AND attendance_date = ?
        `,
        [userId, attendanceDate]
      );

      if (!rows.length) {
        return res.status(400).json({
          message: "Check in first"
        });
      }

      if (rows[0].check_out) {
        return res.status(400).json({
          message: "Already checked out"
        });
      }

      await db.query(
        `
        UPDATE attendances
        SET check_out = NOW(),
            check_out_photo = ?
        WHERE id = ?
        `,
        [
          req.file ? req.file.filename : null,
          rows[0].id
        ]
      );

      res.json({
        message: "Check-out successful"
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ==============================
// GET TODAY STATUS
// ==============================

router.get("/today", verifyToken, async (req, res) => {

  try {

    const userId = req.user.user_id;

    const attendanceDate = getTodayDateWIB();

    const [rows] = await db.query(
      `
      SELECT *
      FROM attendances
      WHERE user_id = ?
      AND attendance_date = ?
      `,
      [userId, attendanceDate]
    );

    res.json(rows[0] || null);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});


module.exports = router;