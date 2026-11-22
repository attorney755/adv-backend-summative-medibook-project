'use strict';

const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// ── Waitlist Queue Route (Part E) ────────────────────────────────
// POST /appointments/waitlist -> Join waitlist when slot or day is fully booked
router.post('/waitlist', appointmentController.joinWaitlist);

// ── Appointment Routes (Part C.2 & C.3) ──────────────────────────
// POST /appointments     -> Book an appointment
// GET  /appointments     -> List appointments with optional filters
router
  .route('/')
  .post(appointmentController.bookAppointment)
  .get(appointmentController.getAllAppointments);

// GET    /appointments/:id -> Get appointment details
// DELETE /appointments/:id -> Cancel appointment and compute refund
router
  .route('/:id')
  .get(appointmentController.getAppointmentById)
  .delete(appointmentController.cancelAppointment);

module.exports = router;
