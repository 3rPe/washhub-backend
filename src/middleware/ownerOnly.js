// middleware/ownerOnly.js

module.exports = function (req, res, next) {

  // Pastikan sudah login dulu
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Cek apakah role adalah owner
  if (req.user.role !== "owner") {
    return res.status(403).json({ message: "Owner access only" });
  }

  next();
};