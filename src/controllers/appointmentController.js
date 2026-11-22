'use strict';

/**
 * Appointment Controller
 * 
 * In this controller, I implement the complete booking and cancellation workflows
 * for MediBook, strictly enforcing all business rules mandated in Parts C.2, C.3, and D:
 * 1. Future appointments only (relative to current server time).
 * 2. Clinic working hours: 09:00 to 17:00 (last slot begins at 16:30).
 * 3. Fixed 30-minute slot boundaries (:00 or :30).
 * 4. Doctor daily cap: maximum 12 appointments per doctor per day.
 * 5. Concurrency protection: two patients can never hold the same slot.
 * 6. Atomic cancellation & refund calculation: succeeds or fails together in a transaction.
 * 7. Non-blocking audit logging via fs module.
 */

const appointmentModel = require('../models/appointmentModel');
const doctorModel = require('../models/doctorModel');
const patientModel = require('../models/patientModel');
const { validateAppointmentSlot } = require('../utils/slotValidator');
const { calculateRefund } = require('../utils/refundCalculator');
const { logAuditEvent } = require('../utils/auditLogger');
const { MAX_DAILY_APPOINTMENTS } = require('../config/constants');

/**
 * Formats a Date object or ISO string to MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
 */
function toMysqlDatetime(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Formats a Date object to YYYY-MM-DD for date-based daily cap calculations.
 */
function toDateString(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * POST /appointments
 * Book a new appointment (Part C.2).
 */
async function bookAppointment(req, res, next) {
  try {
    // First, I extracted the required fields from the request body
    const { patient_id, doctor_id, appointment_datetime } = req.body;

    // Next, I validated that patient_id and doctor_id are positive integers
    const parsedPatientId = parseInt(patient_id, 10);
    const parsedDoctorId = parseInt(doctor_id, 10);

    if (isNaN(parsedPatientId) || parsedPatientId <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid patient_id is required',
      });
    }

    if (isNaN(parsedDoctorId) || parsedDoctorId <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid doctor_id is required',
      });
    }

    // Then, I checked that the patient actually exists in our database
    const patient = await patientModel.findById(parsedPatientId);
    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: `Patient with ID ${parsedPatientId} not found`,
      });
    }

    // Next, I checked that the requested doctor exists
    const doctor = await doctorModel.findById(parsedDoctorId);
    if (!doctor) {
      return res.status(404).json({
        status: 'error',
        message: `Doctor with ID ${parsedDoctorId} not found`,
      });
    }

    // I did this check here to validate working hours, 30-min boundary, and future date
    const slotCheck = validateAppointmentSlot(appointment_datetime);
    if (!slotCheck.isValid) {
      // If the slot violates clinic rules, I returned a 422 Unprocessable Entity status
      return res.status(422).json({
        status: 'error',
        message: slotCheck.error,
      });
    }

    const slotDate = slotCheck.parsedDate;
    const mysqlDatetime = toMysqlDatetime(slotDate);
    const dateStr = toDateString(slotDate);

    // Next, I checked if the doctor has already reached the maximum 12 appointments for that day
    const dailyCount = await appointmentModel.countConfirmedOnDate(parsedDoctorId, dateStr);
    if (dailyCount >= MAX_DAILY_APPOINTMENTS) {
      return res.status(422).json({
        status: 'error',
        message: `Doctor has reached the daily limit of ${MAX_DAILY_APPOINTMENTS} appointments for ${dateStr}`,
        waitlist_available: true,
      });
    }

    // Then, I checked if this specific slot is already booked by another patient
    const existingSlot = await appointmentModel.findActiveByDoctorAndSlot(
      parsedDoctorId,
      mysqlDatetime
    );
    if (existingSlot) {
      // If already taken, I returned 409 Conflict with an offer to join the waitlist
      return res.status(409).json({
        status: 'error',
        message: 'The requested appointment slot is already booked',
        waitlist_available: true,
      });
    }

    // Next, I created the appointment using the doctor's consultation fee as amount_paid
    let appointment;
    try {
      appointment = await appointmentModel.create({
        patient_id: parsedPatientId,
        doctor_id: parsedDoctorId,
        appointment_datetime: mysqlDatetime,
        amount_paid: doctor.consultation_fee,
      });
    } catch (dbErr) {
      // I caught database duplicate key errors to handle simultaneous race conditions
      if (dbErr.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          status: 'error',
          message: 'The requested appointment slot was just booked by another patient',
          waitlist_available: true,
        });
      }
      throw dbErr;
    }

    // Next, I logged this successful booking asynchronously to logs/audit.log without blocking
    logAuditEvent('APPOINTMENT_BOOKED', {
      appointment_id: appointment.id,
      patient_id: appointment.patient_id,
      patient_name: patient.name,
      doctor_id: appointment.doctor_id,
      doctor_name: doctor.name,
      appointment_datetime: mysqlDatetime,
      amount_paid: appointment.amount_paid,
    });

    // Finally, I returned a 201 Created status with the confirmed appointment details
    return res.status(201).json({
      status: 'success',
      data: appointment,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /appointments/:id
 * Cancel an appointment and calculate refund (Part C.3).
 */
async function cancelAppointment(req, res, next) {
  try {
    // First, I parsed and validated the appointment ID
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Appointment ID must be a positive integer',
      });
    }

    // Next, I fetched the appointment from the database to check its current status
    const appointment = await appointmentModel.findById(id);
    if (!appointment) {
      return res.status(404).json({
        status: 'error',
        message: `Appointment with ID ${id} not found`,
      });
    }

    // I did this check here to ensure we do not cancel an already cancelled appointment
    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        status: 'error',
        message: 'This appointment is already cancelled',
      });
    }

    // Then, I computed the refund server-side based on the notice given prior to the appointment
    const refundDetails = calculateRefund(
      appointment.amount_paid,
      appointment.appointment_datetime
    );

    // Next, I executed the cancellation and refund update atomically inside a database transaction
    const result = await appointmentModel.cancelWithRefund(id, refundDetails.refundAmount);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ status: 'error', message: 'Appointment not found' });
    }
    if (result.error === 'ALREADY_CANCELLED') {
      return res.status(400).json({ status: 'error', message: 'Appointment is already cancelled' });
    }

    // Then, I recorded the cancellation event in logs/audit.log asynchronously
    logAuditEvent('APPOINTMENT_CANCELLED', {
      appointment_id: id,
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      appointment_datetime: appointment.appointment_datetime,
      notice_hours: refundDetails.noticeHours,
      refund_percentage: refundDetails.refundPercentage,
      refund_amount: refundDetails.refundAmount,
    });

    // Finally, I returned a 200 OK status detailing the cancellation and computed refund
    return res.status(200).json({
      status: 'success',
      message: 'Appointment successfully cancelled',
      data: {
        appointment_id: id,
        status: 'cancelled',
        notice_hours_given: refundDetails.noticeHours,
        refund_tier: `${refundDetails.refundPercentage}%`,
        amount_paid: appointment.amount_paid,
        refund_amount: refundDetails.refundAmount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /appointments
 * Retrieve all appointments with optional filters (doctor_id, patient_id, status, date).
 */
async function getAllAppointments(req, res, next) {
  try {
    // First, I extracted optional query filters
    const { doctor_id, patient_id, status, date } = req.query;

    // Next, I queried the model with the provided filters
    const appointments = await appointmentModel.findAll({
      doctor_id: doctor_id ? parseInt(doctor_id, 10) : undefined,
      patient_id: patient_id ? parseInt(patient_id, 10) : undefined,
      status,
      date,
    });

    // Finally, I returned a 200 OK status with the results
    return res.status(200).json({
      status: 'success',
      results: appointments.length,
      data: appointments,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /appointments/:id
 * Retrieve a single appointment by ID.
 */
async function getAppointmentById(req, res, next) {
  try {
    // First, I validated the appointment ID parameter
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Appointment ID must be a positive integer',
      });
    }

    // Next, I retrieved the appointment from the database via the model
    const appointment = await appointmentModel.findById(id);

    // Then, I checked if the appointment was found
    if (!appointment) {
      return res.status(404).json({
        status: 'error',
        message: `Appointment with ID ${id} not found`,
      });
    }

    // Finally, I returned a 200 OK status with the appointment details
    return res.status(200).json({
      status: 'success',
      data: appointment,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  bookAppointment,
  cancelAppointment,
  getAllAppointments,
  getAppointmentById,
};
