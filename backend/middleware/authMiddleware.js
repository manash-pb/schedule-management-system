const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const token = req.cookies?.authToken;
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

exports.requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    next();
};
