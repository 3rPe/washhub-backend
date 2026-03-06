const checkPermission = (permissionName) => {
  return (req, res, next) => {

    // PRIMARY OWNER FULL ACCESS
    if (req.user.is_primary_owner) {
      return next();
    }

    if (!req.user.permissions.includes(permissionName)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};

module.exports = checkPermission;