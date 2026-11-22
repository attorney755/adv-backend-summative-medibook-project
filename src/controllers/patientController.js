'use strict';

/**
 * Patient Controller
 * Handles business logic, input validation, and HTTP status codes for Patients.
 * Strictly calls patientModel — NEVER calls the database directly.
 */

const patientModel = require('../models/patientModel');

// Email format regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate patient payload.
 * Returns array of error messages (empty if valid).
 */
function validatePatientInput({ name, email, phone }) {
  const errors = [];

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Name is required and must be a non-empty string');
  } else if (name.trim().length > 100) {
    errors.push('Name cannot exceed 100 characters');
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('Email format is invalid');
  } else if (email.trim().length > 150) {
    errors.push('Email cannot exceed 150 characters');
  }

  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    errors.push('Phone is required and must be a non-empty string');
  } else if (phone.trim().length > 20) {
    errors.push('Phone cannot exceed 20 characters');
  }

  return errors;
}

/**
 * POST /patients
 * Create a new patient.
 */
async function createPatient(req, res, next) {
  try {
    const { name, email, phone } = req.body;

    const errors = validatePatientInput({ name, email, phone });
    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors,
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check for duplicate email
    const existing = await patientModel.findByEmail(trimmedEmail);
    if (existing) {
      return res.status(409).json({
        status: 'error',
        message: 'A patient with this email already exists',
      });
    }

    const patient = await patientModel.create({
      name: name.trim(),
      email: trimmedEmail,
      phone: phone.trim(),
    });

    return res.status(201).json({
      status: 'success',
      data: patient,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /patients
 * Retrieve all patients.
 */
async function getAllPatients(req, res, next) {
  try {
    const patients = await patientModel.findAll();
    return res.status(200).json({
      status: 'success',
      results: patients.length,
      data: patients,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /patients/:id
 * Retrieve a single patient by ID.
 */
async function getPatientById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Patient ID must be a positive integer',
      });
    }

    const patient = await patientModel.findById(id);
    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: `Patient with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: patient,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /patients/:id
 * Update an existing patient.
 */
async function updatePatient(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Patient ID must be a positive integer',
      });
    }

    const existing = await patientModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Patient with ID ${id} not found`,
      });
    }

    const { name, email, phone } = req.body;
    const errors = validatePatientInput({ name, email, phone });
    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors,
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if new email is taken by a different patient
    const duplicate = await patientModel.findByEmail(trimmedEmail);
    if (duplicate && duplicate.id !== id) {
      return res.status(409).json({
        status: 'error',
        message: 'Another patient with this email already exists',
      });
    }

    const updated = await patientModel.update(id, {
      name: name.trim(),
      email: trimmedEmail,
      phone: phone.trim(),
    });

    return res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /patients/:id
 * Delete a patient by ID.
 * Respects referential integrity (409 Conflict if appointments exist).
 */
async function deletePatient(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Patient ID must be a positive integer',
      });
    }

    const existing = await patientModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Patient with ID ${id} not found`,
      });
    }

    // Check appointment associations
    const appointmentCount = await patientModel.countAppointments(id);
    if (appointmentCount > 0) {
      return res.status(409).json({
        status: 'error',
        message: `Cannot delete patient with ${appointmentCount} existing appointment(s)`,
      });
    }

    await patientModel.deleteById(id);
    return res.status(200).json({
      status: 'success',
      message: 'Patient deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
};
