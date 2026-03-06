const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const generateInvoiceNumber = require("../utils/invoiceGenerator");
const db = require("../config/database");


// =====================================================
// CREATE TRANSACTION
// =====================================================
router.post("/", verifyToken, async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const ownerId = req.user.owner_id;
    const { outlet_id, customer_id, items, note } = req.body;

    if (!outlet_id || !customer_id || !items?.length) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const invoiceNumber = await generateInvoiceNumber(ownerId, outlet_id);

    const [trxResult] = await connection.query(
      `INSERT INTO transactions
       (owner_id, outlet_id, customer_id, invoice_number,
        subtotal, total, payment_status, status, current_stage, note)
       VALUES (?, ?, ?, ?, 0, 0, 'unpaid', 'process', 'label', ?)`,
      [ownerId, outlet_id, customer_id, invoiceNumber, note || null]
    );

    const transactionId = trxResult.insertId;
    let subtotal = 0;

    for (const item of items) {

      const [service] = await connection.query(
        `SELECT name, price, duration_day 
         FROM services 
         WHERE id = ? AND owner_id = ?`,
        [item.service_id, ownerId]
      );

      if (!service.length) {
        throw new Error("Service not found");
      }

      const price = Number(service[0].price);
      const qty = Number(item.quantity);
      const totalItem = price * qty;

      subtotal += totalItem;

      const finishDate = new Date();
      finishDate.setDate(
        finishDate.getDate() + (service[0].duration_day || 0)
      );

      await connection.query(
        `INSERT INTO transaction_items
         (transaction_id, service_name, quantity, price,
          duration_day, finish_date, status, current_stage)
         VALUES (?, ?, ?, ?, ?, ?, 'processing', 'label')`,
        [
          transactionId,
          service[0].name,
          qty,
          price,
          service[0].duration_day || 0,
          finishDate
        ]
      );
    }

    await connection.query(
      `UPDATE transactions 
       SET subtotal = ?, total = ?
       WHERE id = ?`,
      [subtotal, subtotal, transactionId]
    );

    await connection.commit();
    connection.release();

    res.status(201).json({
      message: "Transaction created safely",
      invoice_number: invoiceNumber,
      transaction_id: transactionId
    });

  } catch (error) {

    await connection.rollback();
    connection.release();

    res.status(500).json({
      error: error.message
    });
  }
});

// =====================================================
// PAYMENT
// =====================================================
router.post("/:id/pay", verifyToken, async (req, res) => {
  try {
    const transactionId = req.params.id;
    const ownerId = req.user.owner_id;
    const { amount, method, payment_type } = req.body;

    const [trx] = await db.query(
      "SELECT total FROM transactions WHERE id = ? AND owner_id = ?",
      [transactionId, ownerId]
    );

    if (!trx.length) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (payment_type === "pickup") {
      return res.json({
        message: "Payment on pickup",
        payment_status: "unpaid",
        total_paid: 0
      });
    }

    if (!amount || !method) {
      return res.status(400).json({ message: "Amount and method required" });
    }

    await db.query(
      `INSERT INTO payments (transaction_id, amount, method)
       VALUES (?, ?, ?)`,
      [transactionId, amount, method]
    );

    const [sumResult] = await db.query(
      `SELECT SUM(amount) as total_paid
       FROM payments
       WHERE transaction_id = ?`,
      [transactionId]
    );

    const totalPaid = sumResult[0].total_paid || 0;
    const totalTransaction = trx[0].total;

    let paymentStatus = "unpaid";

    if (totalPaid >= totalTransaction) {
      paymentStatus = "paid";
    } else if (totalPaid > 0) {
      paymentStatus = "partial";
    }

    await db.query(
      `UPDATE transactions
       SET payment_status = ?
       WHERE id = ?`,
      [paymentStatus, transactionId]
    );

    res.json({
      message: "Payment recorded",
      payment_status: paymentStatus,
      total_paid: totalPaid
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// =====================================================
// UPDATE STAGE PER ITEM
// =====================================================
router.put(
  "/items/:id/stage",
  verifyToken,
  async (req, res) => {
    try {
      const itemId = req.params.id;
      const { stage } = req.body;
      const operatorId = req.user.user_id;

      if (!stage) {
        return res.status(400).json({ message: "Stage required" });
      }

      await db.query(
        `UPDATE transaction_items
         SET current_stage = ?
         WHERE id = ?`,
        [stage, itemId]
      );

      await db.query(
        `INSERT INTO transaction_item_steps
         (transaction_item_id, step_name, operator_id,
          started_at, finished_at, status)
         VALUES (?, ?, ?, NOW(), NOW(), 'done')`,
        [itemId, stage, operatorId]
      );

      res.json({ message: "Stage updated" });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);


router.get("/active", verifyToken, async (req, res) => {
  try {

    const ownerId = req.user.owner_id;
    const outletId = req.user.outlet_id;
    const isOwner = req.user.is_primary_owner;

    let query = `
      SELECT 
        t.id,
        t.invoice_number,
        t.status,
        t.created_at,
        c.name as customer_name,
        c.phone as customer_phone,
        MAX(ti.finish_date) as estimated_finish
      FROM transactions t
      JOIN customers c ON t.customer_id = c.id
      LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
      WHERE t.status = 'process'
      AND t.owner_id = ?
    `;

    const params = [ownerId];

    if (!isOwner) {
      query += " AND t.outlet_id = ?";
      params.push(outletId);
    }

    query += `
      GROUP BY t.id
      ORDER BY t.created_at ASC
    `;

    const [results] = await db.query(query, params);

    res.json(results);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// =====================================================
// LIST AMBIL & PELUNASAN
// =====================================================
router.get(
  "/pickup",
  verifyToken,
  async (req, res) => {
    try {

      const ownerId = req.user.owner_id;
      const outletId = req.user.outlet_id;
      const isOwner = req.user.is_primary_owner;

      let query = `
        SELECT 
          t.id,
          t.invoice_number,
          t.total,
          t.payment_status,
          t.status,
          t.created_at,
          c.name as customer_name,
          c.phone as customer_phone,
          COUNT(ti.id) as total_items,
          MAX(ti.finish_date) as estimated_finish
        FROM transactions t
        JOIN customers c ON t.customer_id = c.id
        LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
        WHERE t.owner_id = ?
      `;

      const params = [ownerId];

      if (!isOwner) {
        query += " AND t.outlet_id = ?";
        params.push(outletId);
      }

      query += `
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `;

      const [results] = await db.query(query, params);

      res.json(results);

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);


// =====================================================
// DETAIL TRANSACTION + ITEMS + HISTORI
// =====================================================
router.get(
  "/:id/detail",
  verifyToken,
  async (req, res) => {
    try {
      const transactionId = req.params.id;
      const ownerId = req.user.owner_id;

      const [trxResult] = await db.query(
        `SELECT 
           t.id,
           t.invoice_number,
           t.status,
           t.created_at,
           t.note,
           c.name as customer_name,
           c.phone as customer_phone
         FROM transactions t
         JOIN customers c ON t.customer_id = c.id
         WHERE t.id = ? AND t.owner_id = ?`,
        [transactionId, ownerId]
      );

      if (!trxResult.length) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const [itemsResult] = await db.query(
        `SELECT 
           ti.id,
           ti.service_name,
           ti.quantity,
           ti.current_stage,
           ti.finish_date
         FROM transaction_items ti
         WHERE ti.transaction_id = ?`,
        [transactionId]
      );

      for (let item of itemsResult) {
        const [stepsResult] = await db.query(
          `SELECT 
             s.step_name,
             s.finished_at,
             u.name as operator_name
           FROM transaction_item_steps s
           JOIN users u ON s.operator_id = u.id
           WHERE s.transaction_item_id = ?
           ORDER BY s.finished_at ASC`,
          [item.id]
        );

        item.steps = stepsResult;
      }

      res.json({
        transaction: trxResult[0],
        items: itemsResult
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);


module.exports = router;