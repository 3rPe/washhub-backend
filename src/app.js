const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./config/database');

const app = express();
const roleRoutes = require("./routes/roleRoutes");
const employeeRoutes = require("./routes/employeeRoutes");


app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// =====================
// ROUTES
// =====================
app.use('/api/admin/owners', require('./routes/ownerRoutes'));
app.use('/auth', require('./routes/authRoutes'));
app.use('/outlets', require('./routes/outletRoutes'));
app.use('/users', require('./routes/userRoutes'));
app.use('/transactions', require('./routes/transactionRoutes'));
app.use('/services', require('./routes/serviceRoutes'));
app.use('/customers', require('./routes/customerRoutes'));
app.use('/permissions', require('./routes/permissionRoutes'));

const superAdminAuthRoutes = require("./routes/superAdminAuthRoutes");
const superAdminRoutes = require("./routes/superAdminRoutes");

app.use("/api/admin", superAdminAuthRoutes);
app.use("/api/admin", superAdminRoutes);
app.use("/roles", roleRoutes);
app.use("/employees", employeeRoutes);
app.use("/attendance", require("./routes/attendanceRoutes"));

app.get('/', (req, res) => {
  res.send('Laundry SaaS Backend Running 🚀');
});

const PORT = process.env.PORT || 3000;

// =====================
// OWNER DASHBOARD TEST
// =====================

const verifyToken = require("./middleware/authMiddleware");
const ownerOnly = require("./middleware/ownerOnly");

app.get("/owner/dashboard", verifyToken, ownerOnly, (req, res) => {
  res.json({
    message: "Welcome Owner Dashboard",
    user: req.user
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});