module.exports = (roleRequired) => {

  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role !== roleRequired) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};