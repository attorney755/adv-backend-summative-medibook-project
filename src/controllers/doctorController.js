'use strict';

/**
 * Doctor Controller
 * 
 * In this controller, I handle all incoming HTTP requests for doctor resources.
 * I validate each field, compute doctor statistics via advanced SQL queries in doctorModel,
 * and ensure proper RESTful status codes are returned.
 */

const doctorModel = require('../models/doctorModel');

/**
 * Helper function to validate doctor input payload.
 */
function validateDoctorInput({ name, specialty, consultation_fee, room }) {
  const errors = [];

  // I did this check here to ensure the client provides a doctor name
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Name is required and must be a non-empty string');
  } else if (name.trim().length > 100) {
    errors.push('Name cannot exceed 100 characters');
  }

  // Next, I validated that a medical specialty is provided
  if (!specialty || typeof specialty !== 'string' || !specialty.trim()) {
    errors.push('Specialty is required and must be a non-empty string');
  } else if (specialty.trim().length > 100) {
    errors.push('Specialty cannot exceed 100 characters');
  }

  // Then, I checked that the consultation fee is a valid positive number
  const fee = parseFloat(consultation_fee);
  if (consultation_fee === undefined || consultation_fee === null || isNaN(fee)) {
    errors.push('Consultation fee is required and must be a valid number');
  } else if (fee <= 0) {
    errors.push('Consultation fee must be greater than 0');
  }

  // Next, I ensured that a clinic room identifier is specified
  if (!room || typeof room !== 'string' || !room.trim()) {
    errors.push('Room is required and must be a non-empty string');
  } else if (room.trim().length > 20) {
    errors.push('Room identifier cannot exceed 20 characters');
  }

  return errors;
}

/**
 * POST /doctors
 * Create a new doctor.
 */
async function createDoctor(req, res, next) {
  try {
    // First, I extracted the doctor fields from the request body
    const { name, specialty, consultation_fee, room } = req.body;

    // Next, I validated the inputs to catch missing or invalid values
    const errors = validateDoctorInput({ name, specialty, consultation_fee, room });
    if (errors.length > 0) {
      // If validation fails, I returned a 400 Bad Request status with all error messages
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors,
      });
    }

    // Then, I saved the new doctor record into MySQL by calling doctorModel.create()
    const doctor = await doctorModel.create({
      name: name.trim(),
      specialty: specialty.trim(),
      consultation_fee: parseFloat(consultation_fee),
      room: room.trim(),
    });

    // Finally, I returned a 201 Created status with the saved doctor resource
    return res.status(201).json({
      status: 'success',
      data: doctor,
    });
  } catch (err) {
    // I passed any unexpected server error to the central error middleware
    next(err);
  }
}

/**
 * GET /doctors
 * Retrieve all registered doctors.
 */
async function getAllDoctors(req, res, next) {
  try {
    // First, I fetched all doctor records from the model
    const doctors = await doctorModel.findAll();

    // Then, I returned a 200 OK status with the results
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
 * Retrieve a single doctor by ID.
 */
async function getDoctorById(req, res, next) {
  try {
    // First, I parsed and validated the doctor ID parameter
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Doctor ID must be a positive integer',
      });
    }

    // Next, I queried the database through doctorModel to find the doctor
    const doctor = await doctorModel.findById(id);

    // Then, I checked if the doctor exists; if not, I returned 404 Not Found
    if (!doctor) {
      return res.status(404).json({
        status: 'error',
        message: `Doctor with ID ${id} not found`,
      });
    }

    // Finally, I returned 200 OK with the doctor details
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
 * Update an existing doctor.
 */
async function updateDoctor(req, res, next) {
  try {
    // First, I validated that the ID parameter is a positive integer
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Doctor ID must be a positive integer',
      });
    }

    // Next, I checked that the doctor exists before allowing updates
    const existing = await doctorModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Doctor with ID ${id} not found`,
      });
    }

    // Then, I validated the updated field values sent by the client
    const { name, specialty, consultation_fee, room } = req.body;
    const errors = validateDoctorInput({ name, specialty, consultation_fee, room });
    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors,
      });
    }

    // Next, I updated the doctor record in the database using the model
    const updated = await doctorModel.update(id, {
      name: name.trim(),
      specialty: specialty.trim(),
      consultation_fee: parseFloat(consultation_fee),
      room: room.trim(),
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
 * DELETE /doctors/:id
 * Delete a doctor.
 */
async function deleteDoctor(req, res, next) {
  try {
    // First, I parsed and verified the ID parameter
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Doctor ID must be a positive integer',
      });
    }

    // Next, I ensured that the doctor exists in our database
    const existing = await doctorModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: `Doctor with ID ${id} not found`,
      });
    }

    // I did this check here to ensure we do not delete a doctor who has booked appointments
    const appointmentCount = await doctorModel.countAppointments(id);
    if (appointmentCount > 0) {
      // If appointments exist, I returned 409 Conflict to maintain referential integrity
      return res.status(409).json({
        status: 'error',
        message: `Cannot delete doctor with ${appointmentCount} existing appointment(s)`,
      });
    }

    // Then, I proceeded to delete the doctor record
    await doctorModel.deleteById(id);

    // Finally, I returned 200 OK confirming deletion
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
 */
async function getDoctorStats(req, res, next) {
  try {
    // First, I validated the doctor ID parameter
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Doctor ID must be a positive integer',
      });
    }

    // Next, I retrieved the doctor statistics produced strictly by SQL aggregates in doctorModel
    const stats = await doctorModel.getDoctorStats(id);

    // Then, I checked if the doctor was found in the database
    if (!stats) {
      return res.status(404).json({
        status: 'error',
        message: `Doctor with ID ${id} not found`,
      });
    }

    // Finally, I returned 200 OK with the full statistics payload
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
