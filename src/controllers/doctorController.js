'use strict';

/**
 * Doctor Controller
 * 
 * Handles business logic, input validation, and HTTP responses for Doctors.
 * Exposes full CRUD operations plus the Doctor Statistics endpoint (Part C.4).
 * Architectural Rule: Never executes SQL directly; all operations delegate to doctorModel.
 */

const doctorModel = require('../models/doctorModel');

/**
 * Validates doctor input fields.
 * Follows a step-by-step validation strategy:
 * 1. Validate 'name': required string, trimmed length between 1 and 100 characters.
 * 2. Validate 'specialty': required string, trimmed length between 1 and 100 characters.
 * 3. Validate 'consultation_fee': required positive numeric value (DECIMAL 10,2).
 * 4. Validate 'room': required string, trimmed length between 1 and 20 characters (e.g. 'R-12').
 */
function validateDoctorInput({ name, specialty, consultation_fee, room }) {
  const errors = [];

  // Step 1: Validate doctor's name
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Name is required and must be a non-empty string');
  } else if (name.trim().length > 100) {
    errors.push('Name cannot exceed 100 characters');
  }

  // Step 2: Validate medical specialty
  if (!specialty || typeof specialty !== 'string' || !specialty.trim()) {
    errors.push('Specialty is required and must be a non-empty string');
  } else if (specialty.trim().length > 100) {
    errors.push('Specialty cannot exceed 100 characters');
  }

  // Step 3: Validate consultation fee (monetary DECIMAL)
  const fee = parseFloat(consultation_fee);
  if (consultation_fee === undefined || consultation_fee === null || isNaN(fee)) {
    errors.push('Consultation fee is required and must be a valid number');
  } else if (fee <= 0) {
    errors.push('Consultation fee must be greater than 0');
  }

  // Step 4: Validate room identifier
  if (!room || typeof room !== 'string' || !room.trim()) {
    errors.push('Room is required and must be a non-empty string');
  } else if (room.trim().length > 20) {
    errors.push('Room identifier cannot exceed 20 characters');
  }

  return errors;
}

/**
 * POST /doctors
 * Creates a new doctor.
 * 
 * Flow:
 * - Step 1: Extract payload from request body.
 * - Step 2: Validate all fields (name, specialty, consultation_fee, room).
 * - Step 3: If validation fails, return 400 Bad Request with all error messages.
 * - Step 4: Call doctorModel.create() using parameterized SQL.
 * - Step 5: Return 201 Created with the new doctor record.
 */
async function createDoctor(req, res, next) {
  try {
    // Step 1: Extract fields
    const { name, specialty, consultation_fee, room } = req.body;

    // Step 2: Validate fields
    const errors = validateDoctorInput({ name, specialty, consultation_fee, room });
    if (errors.length > 0) {
      // Step 3: Return 400 if validation fails
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors,
      });
    }

    // Step 4: Insert record via model
    const doctor = await doctorModel.create({
      name: name.trim(),
      specialty: specialty.trim(),
      consultation_fee: parseFloat(consultation_fee),
      room: room.trim(),
    });

    // Step 5: Respond with 201 Created
    return res.status(201).json({
      status: 'success',
      data: doctor,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /doctors
 * Retrieves all registered doctors.
 * 
 * Flow:
 * - Step 1: Fetch all doctor records from doctorModel.
 * - Step 2: Return 200 OK with the array of doctors and total count.
 */
async function getAllDoctors(req, res, next) {
  try {
    // Step 1: Fetch from model
    const doctors = await doctorModel.findAll();

    // Step 2: Send 200 response
    return res.status(200).json({
      status: 'success',
      results: doctors.length,
      data: doctors,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /doctors/:id
 * Retrieves a single doctor by ID.
 * 
 * Flow:
 * - Step 1: Parse and validate the ID route parameter.
 * - Step 2: Query the database via doctorModel.findById().
 * - Step 3: If doctor does not exist, return 404 Not Found.
 * - Step 4: If doctor exists, return 200 OK with doctor data.
 */
async function getDoctorById(req, res, next) {
  try {
    // Step 1: Validate ID
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Doctor ID must be a positive integer',
      });
    }

    // Step 2: Query model
    const doctor = await doctorModel.findById(id);

    // Step 3: Check existence
    if (!doctor) {
      return res.status(404).json({
        status: 'error',
        message: `Doctor with ID ${id} not found`,
      });
    }

    // Step 4: Return 200 OK
    return res.status(200).json({
      status: 'success',
      data: doctor,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /doctors/:id
 * Updates an existing doctor's details.
 * 
 * Flow:
 * - Step 1: Parse and validate the doctor ID parameter.
 * - Step 2: Check if doctor exists. If not, return 404 Not Found.
 * - Step 3: Validate the updated fields. If invalid, return 400 Bad Request.
 * - Step 4: Call doctorModel.update() to persist changes.
 * - Step 5: Return 200 OK with updated doctor details.
 */
async function updateDoctor(req, res, next) {
  try {
    // Step 1: Validate ID
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Doctor ID must be a positive integer',
      });
    }

    // Step 2: Check if doctor exists
    const existing = await doctorModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Doctor with ID ${id} not found`,
      });
    }

    // Step 3: Validate incoming fields
    const { name, specialty, consultation_fee, room } = req.body;
    const errors = validateDoctorInput({ name, specialty, consultation_fee, room });
    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors,
      });
    }

    // Step 4: Update record in model
    const updated = await doctorModel.update(id, {
      name: name.trim(),
      specialty: specialty.trim(),
      consultation_fee: parseFloat(consultation_fee),
      room: room.trim(),
    });

    // Step 5: Return 200 OK
    return res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /doctors/:id
 * Deletes a doctor.
 * 
 * Flow:
 * - Step 1: Parse and validate the ID parameter.
 * - Step 2: Check if doctor exists. If not, return 404 Not Found.
 * - Step 3: Enforce referential integrity: check if the doctor has existing appointment records.
 * - Step 4: If appointments exist, return 409 Conflict (cannot delete doctor with appointments).
 * - Step 5: If no appointments exist, delete the doctor record.
 * - Step 6: Return 200 OK confirming deletion.
 */
async function deleteDoctor(req, res, next) {
  try {
    // Step 1: Validate ID
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Doctor ID must be a positive integer',
      });
    }

    // Step 2: Check if doctor exists
    const existing = await doctorModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Doctor with ID ${id} not found`,
      });
    }

    // Step 3: Check for linked appointments
    const appointmentCount = await doctorModel.countAppointments(id);
    if (appointmentCount > 0) {
      // Step 4: Reject deletion if foreign keys depend on this record
      return res.status(409).json({
        status: 'error',
        message: `Cannot delete doctor with ${appointmentCount} existing appointment(s)`,
      });
    }

    // Step 5: Delete record
    await doctorModel.deleteById(id);

    // Step 6: Return 200 OK
    return res.status(200).json({
      status: 'success',
      message: 'Doctor deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /doctors/:id/stats
 * Part C.4: Doctor Statistics
 * 
 * Flow:
 * - Step 1: Parse and validate doctor ID.
 * - Step 2: Check if doctor exists. If not, return 404 Not Found.
 * - Step 3: Call doctorModel.getDoctorStats() which computes revenue, upcoming count,
 *           next 7 days counts, and daily utilization % using SQL aggregates.
 * - Step 4: Return 200 OK with the computed statistics.
 */
async function getDoctorStats(req, res, next) {
  try {
    // Step 1: Validate ID
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Doctor ID must be a positive integer',
      });
    }

    // Step 2: Fetch stats computed strictly by SQL aggregates
    const stats = await doctorModel.getDoctorStats(id);

    // Step 3: Check if doctor was found
    if (!stats) {
      return res.status(404).json({
        status: 'error',
        message: `Doctor with ID ${id} not found`,
      });
    }

    // Step 4: Return 200 OK with statistics
    return res.status(200).json({
      status: 'success',
      data: stats,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  deleteDoctor,
  getDoctorStats,
};
