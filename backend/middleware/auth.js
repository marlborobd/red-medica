const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'asistenta_medicala_secret_2024';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token lipsă' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalid sau expirat' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acces interzis. Doar administratorii pot accesa această resursă.' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, JWT_SECRET };
