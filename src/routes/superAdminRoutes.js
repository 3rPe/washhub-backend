const express = require("express");
const router = express.Router();
const db = require("../config/database");
const superAdminAuth = require("../middleware/superAdminAuth");


// ===========================
// LIST ALL OWNERS
// ===========================
router.get("/owners", superAdminAuth, (req, res) => {

  db.query(`
    SELECT id, name, email, status, trial_end, is_internal, created_at
    FROM owners
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `,
  (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });

});


// ===========================
// UPDATE OWNER STATUS
// ===========================
router.put("/owners/:id/status", superAdminAuth, (req, res) => {

  const { status } = req.body;
  const ownerId = req.params.id;

  db.query(
    `UPDATE owners SET status = ? WHERE id = ?`,
    [status, ownerId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Owner status updated" });
    }
  );

});


// ===========================
// LIST ALL OUTLETS
// ===========================
router.get("/outlets", superAdminAuth, (req, res) => {

  db.query(`
    SELECT o.id, o.name, o.status, o.created_at,
           ow.name as owner_name
    FROM outlets o
    JOIN owners ow ON o.owner_id = ow.id
    WHERE o.deleted_at IS NULL
    ORDER BY o.created_at DESC
  `,
  (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });

});

router.get("/owners/:id", superAdminAuth, (req, res) => {
  db.query(
    `SELECT id, name, email, phone, status, trial_start, trial_end, is_internal, created_at
     FROM owners
     WHERE id = ?`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results[0]);
    }
  );
});

router.put("/owners/:id", superAdminAuth, (req, res) => {
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
    [name, email, phone, status, trial_start, trial_end, is_internal, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Owner updated successfully" });
    }
  );
});

module.exports = router;