const { authenticate } = require('./auth');

function requireAmbAccess(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'ambulanta') {
      return res.status(403).json({ error: 'Acces interzis. Necesită rol admin sau ambulanță.' });
    }
    next();
  });
}

module.exports = { requireAmbAccess };
