const db = require('../config/database');

const loadPermissions = (req, res, next) => {
    const userId = req.user.user_id;

    const query = `
    SELECT p.name
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = ?
`;

    db.query(query, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        req.permissions = results.map(r => r.name);
        next();
    });
};

module.exports = loadPermissions;