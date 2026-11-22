'use strict';

/**
 * Patient Controller
 * 
 * In this controller, I handle all HTTP requests for patient operations.
 * I make sure to validate every user input, enforce proper HTTP status codes,
 * and call the patientModel so that no SQL is written directly in the controller.
 */

const patientModel = require('../models/patientModel');

// I defined this regular expression to validate email format
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Helper function to validate patient input payload.
 */
function validatePatientInput({ name, email, phone }) {
  const errors = [];

  // I did this check here to ensure the client provides a valid patient name
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Name is required and must be a non-empty string');
  } else if (name.trim().length > 100) {
    errors.push('Name cannot exceed 100 characters');
  }

  // Next, I checked the email to ensure it exists and matches standard email syntax
  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('Email format is invalid');
  } else if (email.trim().length > 150) {
    errors.push('Email cannot exceed 150 characters');
  }

  // Then, I checked that a valid phone number is provided
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
    // First, I extracted the fields sent in the request body
    const { name, email, phone } = req.body;

    // Next, I ran input validation to ensure all required fields are present and valid
    const errors = validatePatientInput({ name, email, phone });
    if (errors.length > 0) {
      // If validation fails, I returned a 400 Bad Request status with the specific error messages
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors,
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Then, I checked the database to see if a patient with this email already exists
    const existing = await patientModel.findByEmail(trimmedEmail);
    if (existing) {
      // If the email is already in use, I returned a 409 Conflict status
      return res.status(409).json({
        status: 'error',
        message: 'A patient with this email already exists',
      });
    }

    // Next, I called the model function to insert the new patient into MySQL
    const patient = await patientModel.create({
      name: name.trim(),
      email: trimmedEmail,
      phone: phone.trim(),
    });

    // Finally, I returned a 201 Created status with the newly created patient record
    return res.status(201).json({
      status: 'success',
      data: patient,
    });
  } catch (err) {
    // I forwarded any unexpected errors to the central error handling middleware
    next(err);
  }
}

/**
 * GET /patients
 * Retrieve all patients.
 */
async function getAllPatients(req, res, next) {
  try {
    // First, I fetched all patient records by calling the model
    const patients = await patientModel.findAll();

    // Then, I returned a 200 OK status along with the total count and the patient list
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
    // First, I parsed and validated the patient ID from the route parameters
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Patient ID must be a positive integer',
      });
    }

    // Next, I searched for the patient in the database using the model
    const patient = await patientModel.findById(id);

    // Then, I checked if the patient was found; if not, I returned a 404 Not Found status
    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: `Patient with ID ${id} not found`,
      });
    }

    // Finally, I returned a 200 OK status with the patient details
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
    // First, I validated that the ID parameter is a positive integer
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Patient ID must be a positive integer',
      });
    }

    // Next, I checked if the patient exists in the database before proceeding
    const existing = await patientModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Patient with ID ${id} not found`,
      });
    }

    // Then, I validated the updated fields provided by the client
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

    // I checked if the updated email is already taken by a different patient
    const duplicate = await patientModel.findByEmail(trimmedEmail);
    if (duplicate && duplicate.id !== id) {
      return res.status(409).json({
        status: 'error',
        message: 'Another patient with this email already exists',
      });
    }

    // Next, I called the model to update the patient record in MySQL
    const updated = await patientModel.update(id, {
      name: name.trim(),
      email: trimmedEmail,
      phone: phone.trim(),
    });

    // Finally, I returned a 200 OK status with the updated record
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
 * Delete a patient.
 */
async function deletePatient(req, res, next) {
  try {
    // First, I validated the patient ID parameter
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Patient ID must be a positive integer',
      });
    }

    // Next, I verified that the patient exists
    const existing = await patientModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Patient with ID ${id} not found`,
      });
    }

    // I did this check here to maintain referential integrity and ensure we do not delete a patient with booked appointments
    const appointmentCount = await patientModel.countAppointments(id);
    if (appointmentCount > 0) {
      // If appointments exist, I returned a 409 Conflict status
      return res.status(409).json({
        status: 'error',
        message: `Cannot delete patient with ${appointmentCount} existing appointment(s)`,
      });
    }

    // Then, I deleted the patient record from the database
    await patientModel.deleteById(id);

    // Finally, I returned a 200 OK status confirming the deletion
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
