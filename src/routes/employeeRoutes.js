const express = require("express");
const router = express.Router();
const db = require("../config/database");
const bcrypt = require("bcrypt");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");


// ======================================================
// CREATE EMPLOYEE + USER LOGIN
// ======================================================
router.post("/", verifyToken, async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const ownerId = req.user.owner_id;

    const {
      full_name,
      gender,
      phone,
      address,
      start_date,
      outlet_id,
      base_salary,
      username,
      password,
      positions,
      work_types
    } = req.body;

    if (
      !full_name ||
      !gender ||
      !phone ||
      !address ||
      !start_date ||
      !outlet_id ||
      !base_salary ||
      !username ||
      !password
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // INSERT EMPLOYEE
    const [empResult] = await connection.query(
      `INSERT INTO employees
       (owner_id, full_name, gender, phone, address, start_date, outlet_id, base_salary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        full_name,
        gender,
        phone,
        address,
        start_date,
        outlet_id,
        base_salary
      ]
    );

    const employeeId = empResult.insertId;

    const employeeCode = `EMP-${employeeId}`;
    await connection.query(
      `UPDATE employees SET employee_code = ? WHERE id = ?`,
      [employeeCode, employeeId]
    );

    // INSERT POSITIONS
    let roleId = null;

    if (positions?.length) {
      const positionValues = positions.map((p) => [employeeId, p]);
      await connection.query(
        `INSERT INTO employee_positions (employee_id, position) VALUES ?`,
        [positionValues]
      );

      if (positions.includes("kasir")) {
        roleId = 2;
      } else {
        roleId = 3;
      }
    }

    // INSERT WORK TYPES
    if (work_types?.length) {
      const workValues = work_types.map((w) => [
        employeeId,
        w.work_type,
        w.receives_incentive ? 1 : 0
      ]);

      await connection.query(
        `INSERT INTO employee_work_types
         (employee_id, work_type, receives_incentive)
         VALUES ?`,
        [workValues]
      );
    }

    // CREATE LOGIN USER
    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.query(
      `INSERT INTO users
       (owner_id, username, name, phone, password, role_id, employee_id, is_primary_owner)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        ownerId,
        username,
        full_name,
        phone,
        hashedPassword,
        roleId,
        employeeId
      ]
    );

    await connection.commit();
    connection.release();

    res.status(201).json({
      message: "Employee created successfully",
      employee_id: employeeId,
      employee_code: employeeCode
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: error.message });
  }
});


// ======================================================
// GET EMPLOYEE SUMMARY (FILTER SUPPORT)
// ======================================================
router.get("/summary/total", verifyToken, async (req, res) => {
  try {
    const ownerId = req.user.owner_id;
    const outletId = req.query.outlet_id;

    let query = `
      SELECT COUNT(*) as total
      FROM employees
      WHERE owner_id = ?
    `;

    const params = [ownerId];

    if (outletId && outletId !== "all") {
      query += " AND outlet_id = ?";
      params.push(outletId);
    }

    const [rows] = await db.query(query, params);

    res.json(rows[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ======================================================
// GET ALL EMPLOYEES (CLEAN VERSION)
// ======================================================
router.get(
  "/",
  verifyToken,
  async (req, res) => {
    try {
      const ownerId = req.user.owner_id;
      const outletId = req.query.outlet_id;

      let query = `
        SELECT
          e.id,
          e.full_name,
          e.employee_code,
          e.outlet_id,
          o.name AS outlet_name
        FROM employees e
        LEFT JOIN outlets o ON e.outlet_id = o.id
        WHERE e.owner_id = ?
      `;

      const params = [ownerId];

      if (outletId && outletId !== "all") {
        query += " AND e.outlet_id = ?";
        params.push(outletId);
      }

      query += " ORDER BY e.created_at DESC";

      const [employees] = await db.query(query, params);

      // attach positions & work types
      for (let emp of employees) {

        const [positions] = await db.query(
          `SELECT position 
           FROM employee_positions
           WHERE employee_id = ?`,
          [emp.id]
        );

        const [workTypes] = await db.query(
          `SELECT work_type, receives_incentive
           FROM employee_work_types
           WHERE employee_id = ?`,
          [emp.id]
        );

        emp.positions = positions.map(p => p.position);
        emp.work_types = workTypes;
      }

      res.json(employees);

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);


// ======================================================
// GET EMPLOYEE DETAIL
// ======================================================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const ownerId = req.user.owner_id;
    const employeeId = req.params.id;

    const [rows] = await db.query(
      `
      SELECT 
        e.*,
        o.name AS outlet_name
      FROM employees e
      LEFT JOIN outlets o ON e.outlet_id = o.id
      WHERE e.id = ? AND e.owner_id = ?
      `,
      [employeeId, ownerId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const employee = rows[0];

    const [positions] = await db.query(
      "SELECT position FROM employee_positions WHERE employee_id = ?",
      [employeeId]
    );

    employee.positions = positions.map(p => p.position);

    const [workTypes] = await db.query(
      "SELECT work_type, receives_incentive FROM employee_work_types WHERE employee_id = ?",
      [employeeId]
    );

    employee.work_types = workTypes;

    res.json(employee);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ======================================================
// UPDATE EMPLOYEE
// ======================================================
router.put("/:id", verifyToken, async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const ownerId = req.user.owner_id;
    const employeeId = req.params.id;

    const {
      full_name,
      gender,
      phone,
      address,
      start_date,
      outlet_id,
      base_salary,
      positions,
      work_types
    } = req.body;

    await connection.query(
      `
      UPDATE employees
      SET full_name = ?, 
          gender = ?, 
          phone = ?, 
          address = ?, 
          start_date = ?, 
          outlet_id = ?, 
          base_salary = ?
      WHERE id = ? AND owner_id = ?
      `,
      [
        full_name,
        gender,
        phone,
        address,
        start_date,
        outlet_id,
        base_salary,
        employeeId,
        ownerId
      ]
    );

    await connection.query(
      "DELETE FROM employee_positions WHERE employee_id = ?",
      [employeeId]
    );

    if (positions?.length) {
      const positionValues = positions.map(p => [employeeId, p]);
      await connection.query(
        "INSERT INTO employee_positions (employee_id, position) VALUES ?",
        [positionValues]
      );
    }

    await connection.query(
      "DELETE FROM employee_work_types WHERE employee_id = ?",
      [employeeId]
    );

    if (work_types?.length) {
      const workValues = work_types.map(w => [
        employeeId,
        w.work_type,
        w.receives_incentive ? 1 : 0
      ]);

      await connection.query(
        `INSERT INTO employee_work_types
         (employee_id, work_type, receives_incentive)
         VALUES ?`,
        [workValues]
      );
    }

    await connection.commit();
    connection.release();

    res.json({ message: "Employee updated successfully" });

  } catch (error) {
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;