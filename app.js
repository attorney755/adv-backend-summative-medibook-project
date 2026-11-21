'use strict';

const express = require('express');
const errorHandler = require('./src/middleware/errorHandler');

const patientRoutes = require('./src/routes/patientRoutes');
const doctorRoutes = require('./src/routes/doctorRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const feedbackRoutes = require('./src/routes/feedbackRoutes');

const app = express();

// ── Body parsing ────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Routes ──────────────────────────────────────────────────────
app.use('/patients', patientRoutes);
app.use('/doctors', doctorRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/reports', reportRoutes);
app.use('/feedback', feedbackRoutes);

// ── 404 for unknown routes ───────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// ── Central error handler ────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
