'use strict';

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// ── Reports Routes (Parts C.5 & C.6) ─────────────────────────────
// GET /reports/doctors   -> Total appointments & revenue per doctor (incl. 0-appt doctors)
// GET /reports/busy-days -> Dates where doctor bookings exceed 80% of daily cap
router.get('/doctors', reportController.getDoctorsReport);
router.get('/busy-days', reportController.getBusyDaysReport);

module.exports = router;
