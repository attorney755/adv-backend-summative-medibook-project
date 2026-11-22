'use strict';

/**
 * Doctor Model
 * Contains ALL SQL statements for doctor operations and advanced reports.
 * Uses ONLY parameterized queries (? placeholders).
 * NO ORM is used.
 */

const pool = require('../config/db');
const { MAX_DAILY_APPOINTMENTS, BUSY_DAY_THRESHOLD } = require('../config/constants');

/**
 * Create a new doctor record.
 * @param {Object} doctor - { name, specialty, consultation_fee, room }
 * @returns {Promise<Object>} Created doctor
 */
async function create({ name, specialty, consultation_fee, room }) {
  const sql = `
    INSERT INTO doctors (name, specialty, consultation_fee, room)
    VALUES (?, ?, ?, ?)
  `;
  const [result] = await pool.query(sql, [name, specialty, consultation_fee, room]);
  return findById(result.insertId);
}

/**
 * Retrieve all doctors.
 * @returns {Promise<Array>} List of doctors
 */
async function findAll() {
  const sql = `
    SELECT id, name, specialty, consultation_fee, room, created_at
    FROM doctors
    ORDER BY id ASC
  `;
  const [rows] = await pool.query(sql);
  return rows;
}

/**
 * Find a single doctor by ID.
 * @param {number} id
 * @returns {Promise<Object|null>} Doctor record or null
 */
async function findById(id) {
  const sql = `
    SELECT id, name, specialty, consultation_fee, room, created_at
    FROM doctors
    WHERE id = ?
  `;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
}

/**
 * Update an existing doctor.
 * @param {number} id
 * @param {Object} data - { name, specialty, consultation_fee, room }
 * @returns {Promise<Object|null>} Updated doctor or null
 */
async function update(id, { name, specialty, consultation_fee, room }) {
  const sql = `
    UPDATE doctors
    SET name = ?, specialty = ?, consultation_fee = ?, room = ?
    WHERE id = ?
  `;
  const [result] = await pool.query(sql, [name, specialty, consultation_fee, room, id]);
  if (result.affectedRows === 0) {
    return null;
  }
  return findById(id);
}

/**
 * Delete a doctor by ID.
 * @param {number} id
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteById(id) {
  const sql = `
    DELETE FROM doctors
    WHERE id = ?
  `;
  const [result] = await pool.query(sql, [id]);
  return result.affectedRows > 0;
}

/**
 * Count associated appointments for a doctor.
 * @param {number} id
 * @returns {Promise<number>}
 */
async function countAppointments(id) {
  const sql = `
    SELECT COUNT(*) AS count
    FROM appointments
    WHERE doctor_id = ?
  `;
  const [rows] = await pool.query(sql, [id]);
  return rows[0].count;
}

/**
 * Part C.4: Doctor Statistics
 * For a given doctor:
 * - Revenue collected (retaining paid minus refund)
 * - Upcoming appointment count
 * - Appointments per day for the next 7 days
 * - Utilization % against the 12-slot daily cap
 * @param {number} id - Doctor ID
 * @returns {Promise<Object>} Statistics object
 */
async function getDoctorStats(id) {
  // 1. Overall revenue & upcoming counts via SQL aggregate
  const summarySql = `
    SELECT 
        d.id,
        d.name,
        d.specialty,
        COALESCE(SUM(CASE 
            WHEN a.status = 'confirmed' THEN a.amount_paid 
            ELSE (a.amount_paid - a.refund_amount) 
        END), 0.00) AS total_revenue_collected,
        COUNT(CASE 
            WHEN a.status = 'confirmed' AND a.appointment_datetime > NOW() THEN 1 
        END) AS upcoming_appointments_count
    FROM doctors d
    LEFT JOIN appointments a ON d.id = a.doctor_id
    WHERE d.id = ?
    GROUP BY d.id, d.name, d.specialty
  `;
  const [summaryRows] = await pool.query(summarySql, [id]);
  if (!summaryRows.length) {
    return null;
  }

  // 2. Daily appointment counts and utilization % for the next 7 days
  const next7DaysSql = `
    SELECT 
        DATE(appointment_datetime) AS date,
        COUNT(*) AS booked_count,
        ? AS daily_capacity,
        ROUND((COUNT(*) / ?) * 100, 2) AS utilization_percentage
    FROM appointments
    WHERE doctor_id = ?
      AND status = 'confirmed'
      AND appointment_datetime >= CURDATE()
      AND appointment_datetime < DATE_ADD(CURDATE(), INTERVAL 7 DAY)
    GROUP BY DATE(appointment_datetime)
    ORDER BY date ASC
  `;
  const [dailyRows] = await pool.query(next7DaysSql, [
    MAX_DAILY_APPOINTMENTS,
    MAX_DAILY_APPOINTMENTS,
    id,
  ]);

  return {
    doctor_id: summaryRows[0].id,
    doctor_name: summaryRows[0].name,
    specialty: summaryRows[0].specialty,
    total_revenue_collected: parseFloat(summaryRows[0].total_revenue_collected),
    upcoming_appointments_count: summaryRows[0].upcoming_appointments_count,
    daily_cap: MAX_DAILY_APPOINTMENTS,
    next_7_days: dailyRows.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date,
      booked_count: r.booked_count,
      daily_capacity: r.daily_capacity,
      utilization_percentage: parseFloat(r.utilization_percentage),
    })),
  };
}

/**
 * Part C.5: Doctors Report (Advanced SQL)
 * Lists every doctor's total appointments and revenue collected.
 * MUST include doctors with zero appointments via LEFT JOIN.
 * @returns {Promise<Array>}
 */
async function getDoctorsReport() {
  const sql = `
    SELECT 
        d.id,
        d.name,
        d.specialty,
        d.room,
        COUNT(a.id) AS total_appointments,
        COALESCE(SUM(CASE 
            WHEN a.status = 'confirmed' THEN a.amount_paid 
            ELSE (a.amount_paid - a.refund_amount) 
        END), 0.00) AS total_revenue
    FROM doctors d
    LEFT JOIN appointments a ON d.id = a.doctor_id
    GROUP BY d.id, d.name, d.specialty, d.room
    ORDER BY d.id ASC
  `;
  const [rows] = await pool.query(sql);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    specialty: r.specialty,
    room: r.room,
    total_appointments: Number(r.total_appointments),
    total_revenue: parseFloat(r.total_revenue),
  }));
}

/**
 * Part C.6: Busy Days Report (Advanced SQL)
 * Every (doctor, date) where more than 80% of the 12-slot daily capacity is booked.
 * Threshold is computed strictly in SQL via HAVING clause.
 * @returns {Promise<Array>}
 */
async function getBusyDaysReport() {
  const sql = `
    SELECT 
        d.id AS doctor_id,
        d.name AS doctor_name,
        d.specialty,
        DATE(a.appointment_datetime) AS date,
        COUNT(a.id) AS booked_slots,
        ? AS daily_capacity,
        ROUND((COUNT(a.id) / ?) * 100, 2) AS utilization_percentage
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    WHERE a.status = 'confirmed'
    GROUP BY d.id, d.name, d.specialty, DATE(a.appointment_datetime)
    HAVING COUNT(a.id) > (? * ?)
    ORDER BY date ASC, d.id ASC
  `;
  const [rows] = await pool.query(sql, [
    MAX_DAILY_APPOINTMENTS,
    MAX_DAILY_APPOINTMENTS,
    MAX_DAILY_APPOINTMENTS,
    BUSY_DAY_THRESHOLD,
  ]);
  return rows.map((r) => ({
    doctor_id: r.doctor_id,
    doctor_name: r.doctor_name,
    specialty: r.specialty,
    date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date,
    booked_slots: Number(r.booked_slots),
    daily_capacity: Number(r.daily_capacity),
    utilization_percentage: parseFloat(r.utilization_percentage),
  }));
}

module.exports = {
  create,
  findAll,
  findById,
  update,
  deleteById,
  countAppointments,
  getDoctorStats,
  getDoctorsReport,
  getBusyDaysReport,
};
