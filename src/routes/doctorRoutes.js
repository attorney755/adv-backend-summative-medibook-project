'use strict';

const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

// ── Doctor CRUD endpoints ────────────────────────────────────────
router
  .route('/')
  .post(doctorController.createDoctor)
  .get(doctorController.getAllDoctors);

// ── Doctor Statistics (Part C.4) ─────────────────────────────────
// Must be registered BEFORE /:id or with clear segment to follow REST conventions
router.route('/:id/stats').get(doctorController.getDoctorStats);

router
  .route('/:id')
  .get(doctorController.getDoctorById)
  .put(doctorController.updateDoctor)
  .delete(doctorController.deleteDoctor);

module.exports = router;
