const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/summary', (req, res) => {
  const db = getDb();
  const totalPatients = db.prepare('SELECT COUNT(*) as count FROM patients').get().count;
  const totalVisits = db.prepare('SELECT COUNT(*) as count FROM visits').get().count;
  const totalEmployees = db.prepare("SELECT COUNT(*) as count FROM users WHERE role='employee' AND active=1").get().count;
  const revenue = db.prepare('SELECT COALESCE(SUM(suma_de_plata),0) as total, COALESCE(SUM(suma_incasata),0) as incasat FROM visits').get();
  const visitsThisMonth = db.prepare(`
    SELECT COUNT(*) as count FROM visits
    WHERE strftime('%Y-%m', data) = strftime('%Y-%m', 'now')
  `).get().count;
  const patientsThisMonth = db.prepare(`
    SELECT COUNT(*) as count FROM patients
    WHERE strftime('%Y-%m', data_inregistrare) = strftime('%Y-%m', 'now')
  `).get().count;

  res.json({
    totalPatients, totalVisits, totalEmployees,
    revenue: revenue.total, incasat: revenue.incasat,
    visitsThisMonth, patientsThisMonth
  });
});

router.get('/monthly', (req, res) => {
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();
  const db = getDb();
  const monthly = db.prepare(`
    SELECT strftime('%m', data) as luna,
           COUNT(*) as vizite,
           COALESCE(SUM(suma_de_plata), 0) as total_plata,
           COALESCE(SUM(suma_incasata), 0) as total_incasat
    FROM visits
    WHERE strftime('%Y', data) = ?
    GROUP BY luna
    ORDER BY luna
  `).all(String(targetYear));
  res.json(monthly);
});

router.get('/employees', (req, res) => {
  const db = getDb();
  const stats = db.prepare(`
    SELECT u.id, u.name, u.email,
           COUNT(DISTINCT p.id) as pacienti,
           COUNT(v.id) as vizite,
           COALESCE(SUM(v.suma_de_plata), 0) as total_plata,
           COALESCE(SUM(v.suma_incasata), 0) as total_incasat
    FROM users u
    LEFT JOIN patients p ON p.utilizator_creator_id = u.id
    LEFT JOIN visits v ON v.angajat_id = u.id
    WHERE u.active = 1
    GROUP BY u.id
    ORDER BY vizite DESC
  `).all();
  res.json(stats);
});

router.get('/visits-detail', (req, res) => {
  const { from, to, angajat_id } = req.query;
  const db = getDb();
  let query = `
    SELECT v.*, p.nume as patient_name, p.cnp, u.name as angajat_name
    FROM visits v
    JOIN patients p ON v.patient_id = p.id
    JOIN users u ON v.angajat_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (from) { query += ' AND v.data >= ?'; params.push(from); }
  if (to) { query += ' AND v.data <= ?'; params.push(to); }
  if (angajat_id) { query += ' AND v.angajat_id = ?'; params.push(angajat_id); }
  query += ' ORDER BY v.data DESC, v.ora DESC';
  const visits = db.prepare(query).all(...params);
  res.json(visits);
});

module.exports = router;
