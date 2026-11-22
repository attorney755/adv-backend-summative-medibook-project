'use strict';

const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');

// RESTful route definitions for /patients
router
  .route('/')
  .post(patientController.createPatient)
  .get(patientController.getAllPatients);

router
  .route('/:id')
  .get(patientController.getPatientById)
  .put(patientController.updatePatient)
  .delete(patientController.deletePatient);

module.exports = router;
