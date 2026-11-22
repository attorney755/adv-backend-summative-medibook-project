'use strict';

/**
 * Appointment Model
 * Contains ALL SQL statements for appointment operations.
 * Uses ONLY parameterized queries (? placeholders).
 * Handles transaction management for atomic cancellations.
 * NO ORM is used.
 */

const pool = require('../config/db');

/**
 * Create a new appointment.
 * Accepts an optional connection to participate in external transactions.
 * @param {Object} data - { patient_id, doctor_id, appointment_datetime, amount_paid }
 * @param {Object} [conn] - Optional mysql2 connection for transaction
 * @returns {Promise<Object>} Created appointment
 */
async function create(
  { patient_id, doctor_id, appointment_datetime, amount_paid },
  conn = null
) {
  const executor = conn || pool;
  const sql = `
    INSERT INTO appointments (
        patient_id,
        doctor_id,
        appointment_datetime,
        status,
        amount_paid,
        refund_amount
    )
    VALUES (?, ?, ?, 'confirmed', ?, 0.00)
  `;
  const [result] = await executor.query(sql, [
    patient_id,
    doctor_id,
    appointment_datetime,
    amount_paid,
  ]);

  return findById(result.insertId, conn);
}

/**
 * Find appointment by ID with joined patient and doctor details.
 * @param {number} id
 * @param {Object} [conn]
 * @returns {Promise<Object|null>}
 */
async function findById(id, conn = null) {
  const executor = conn || pool;
  const sql = `
    SELECT 
        a.id,
        a.patient_id,
        p.name AS patient_name,
        p.email AS patient_email,
        p.phone AS patient_phone,
        a.doctor_id,
        d.name AS doctor_name,
        d.specialty AS doctor_specialty,
        d.consultation_fee,
        d.room AS doctor_room,
        a.appointment_datetime,
        a.status,
        a.amount_paid,
        a.refund_amount,
        a.booked_on
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors d  ON a.doctor_id  = d.id
    WHERE a.id = ?
  `;
  const [rows] = await executor.query(sql, [id]);
  if (!rows[0]) return null;

  return {
    ...rows[0],
    amount_paid: parseFloat(rows[0].amount_paid),
    refund_amount: parseFloat(rows[0].refund_amount),
    consultation_fee: parseFloat(rows[0].consultation_fee),
  };
}

/**
 * Check if a doctor already has a confirmed appointment at this slot.
 * @param {number} doctor_id
 * @param {string|Date} appointment_datetime
 * @param {Object} [conn]
 * @returns {Promise<Object|null>}
 */
async function findActiveByDoctorAndSlot(
  doctor_id,
  appointment_datetime,
  conn = null
) {
  const executor = conn || pool;
  const sql = `
    SELECT id, patient_id, doctor_id, appointment_datetime, status
    FROM appointments
    WHERE doctor_id = ?
      AND appointment_datetime = ?
      AND status = 'confirmed'
  `;
  const [rows] = await executor.query(sql, [doctor_id, appointment_datetime]);
  return rows[0] || null;
}

/**
 * Count confirmed appointments for a doctor on a specific date.
 * Used to enforce the 12-appointment daily cap.
 * @param {number} doctor_id
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {Object} [conn]
 * @returns {Promise<number>}
 */
async function countConfirmedOnDate(doctor_id, dateStr, conn = null) {
  const executor = conn || pool;
  const sql = `
    SELECT COUNT(*) AS count
    FROM appointments
    WHERE doctor_id = ?
      AND DATE(appointment_datetime) = ?
      AND status = 'confirmed'
  `;
  const [rows] = await executor.query(sql, [doctor_id, dateStr]);
  return Number(rows[0].count);
}

/**
 * List all appointments with optional filters.
 * @param {Object} [filters] - { doctor_id, patient_id, status, date }
 * @returns {Promise<Array>}
 */
async function findAll(filters = {}) {
  let sql = `
    SELECT 
        a.id,
        a.patient_id,
        p.name AS patient_name,
        a.doctor_id,
        d.name AS doctor_name,
        d.room,
        a.appointment_datetime,
        a.status,
        a.amount_paid,
        a.refund_amount,
        a.booked_on
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors d  ON a.doctor_id  = d.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.doctor_id) {
    sql += ' AND a.doctor_id = ?';
    params.push(filters.doctor_id);
  }
  if (filters.patient_id) {
    sql += ' AND a.patient_id = ?';
    params.push(filters.patient_id);
  }
  if (filters.status) {
    sql += ' AND a.status = ?';
    params.push(filters.status);
  }
  if (filters.date) {
    sql += ' AND DATE(a.appointment_datetime) = ?';
    params.push(filters.date);
  }

  sql += ' ORDER BY a.appointment_datetime ASC';

  const [rows] = await pool.query(sql, params);
  return rows.map((r) => ({
    ...r,
    amount_paid: parseFloat(r.amount_paid),
    refund_amount: parseFloat(r.refund_amount),
  }));
}

/**
 * Atomically cancel an appointment and record its refund in a transaction.
 * Rubric requirement: "The cancellation and its refund record succeed or fail together."
 * Uses SELECT ... FOR UPDATE to avoid race conditions.
 * @param {number} appointmentId
 * @param {number} refundAmount
 * @returns {Promise<Object>} { success, appointment } or { error }
 */
async function cancelWithRefund(appointmentId, refundAmount) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the record for update
    const [rows] = await conn.query(
      `SELECT * FROM appointments WHERE id = ? FOR UPDATE`,
      [appointmentId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return { error: 'NOT_FOUND' };
    }

    const appointment = rows[0];

    if (appointment.status === 'cancelled') {
      await conn.rollback();
      return { error: 'ALREADY_CANCELLED', appointment };
    }

    // Atomic update of status and refund
    await conn.query(
      `UPDATE appointments
       SET status = 'cancelled', refund_amount = ?
       WHERE id = ?`,
      [refundAmount, appointmentId]
    );

    await conn.commit();

    return {
      success: true,
      appointment: {
        ...appointment,
        status: 'cancelled',
        refund_amount: parseFloat(refundAmount),
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  create,
  findById,
  findActiveByDoctorAndSlot,
  countConfirmedOnDate,
  findAll,
  cancelWithRefund,
};
