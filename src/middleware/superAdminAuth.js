const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Access denied" });
  }

  // Pisahkan Bearer dan token
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Invalid token format" });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);

    if (verified.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.superAdmin = verified;
    next();
  } catch (err) {
    return res.status(400).json({ message: "Invalid token" });
  }
};