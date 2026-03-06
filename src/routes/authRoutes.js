const express = require("express");
const router = express.Router();
const db = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


/* ===============================
   REGISTER OWNER (PUBLIC)
================================ */
router.post("/register-owner", async (req, res) => {

  try {

    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Required fields missing"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [existing] = await db.query(
      "SELECT id FROM owners WHERE email = ?",
      [email]
    );

    if (existing.length) {
      return res.status(400).json({
        message: "Email already registered"
      });
    }

    const [ownerResult] = await db.query(
      `
      INSERT INTO owners
      (name, email, phone, status, trial_start, trial_end, is_internal)
      VALUES (?, ?, ?, 'trial', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 0)
      `,
      [name, email, phone]
    );

    const ownerId = ownerResult.insertId;

    await db.query(
      `
      INSERT INTO users
      (owner_id, name, email, password, is_primary_owner)
      VALUES (?, ?, ?, ?, 1)
      `,
      [ownerId, name, email, hashedPassword]
    );

    res.status(201).json({
      message: "Registration successful"
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});


/* ===============================
   LOGIN (OWNER / EMPLOYEE)
================================ */
router.post("/login", async (req, res) => {

  try {

    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        message: "Login and password required"
      });
    }

    // bisa login pakai email (owner) atau username (employee)
    const [users] = await db.query(
      `
SELECT
  u.*,
  e.outlet_id AS employee_outlet_id
FROM users u
LEFT JOIN employees e
ON u.employee_id = e.id
WHERE u.email = ? OR u.username = ?
      `,
      [login, login]
    );

    if (!users.length) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const user = users[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }


    /* ===============================
       GET PERMISSIONS
    ================================ */

    let permissions = [];

    if (user.role_id) {

      const [permResults] = await db.query(
        `
        SELECT p.name
        FROM role_permissions rp
        JOIN permissions p
        ON rp.permission_id = p.id
        WHERE rp.role_id = ?
        `,
        [user.role_id]
      );

      permissions = permResults.map(p => p.name);

    }


    /* ===============================
       PRIMARY OWNER FULL ACCESS
    ================================ */

    if (user.is_primary_owner === 1) {
      permissions = ["*"];
    }


    /* ===============================
       CREATE TOKEN
    ================================ */

    const token = jwt.sign(
      {
        user_id: user.id,
        owner_id: user.owner_id,
        role_id: user.role_id,
        outlet_id: user.employee_outlet_id || null,   // 🔥 penting untuk kasir
        employee_id: user.employee_id || null,
        is_primary_owner: user.is_primary_owner,
        permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );


    res.json({
      token
    });


  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});


module.exports = router;