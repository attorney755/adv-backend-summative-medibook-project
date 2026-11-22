'use strict';

/**
 * Patient Model
 * Contains ALL SQL statements for patient operations.
 * Uses ONLY parameterized queries (? placeholders).
 */

const pool = require('../config/db');

/**
 * Create a new patient record.
 * @param {Object} patient - { name, email, phone }
 * @returns {Promise<Object>} Created patient with its generated ID
 */
async function create({ name, email, phone }) {
  const sql = `
    INSERT INTO patients (name, email, phone)
    VALUES (?, ?, ?)
  `;
  const [result] = await pool.query(sql, [name, email, phone]);
  return findById(result.insertId);
}

/**
 * Retrieve all patients.
 * @returns {Promise<Array>} List of patients
 */
async function findAll() {
  const sql = `
    SELECT id, name, email, phone, created_at
    FROM patients
    ORDER BY id ASC
  `;
  const [rows] = await pool.query(sql);
  return rows;
}

/**
 * Find a single patient by ID.
 * @param {number} id
 * @returns {Promise<Object|null>} Patient record or null
 */
async function findById(id) {
  const sql = `
    SELECT id, name, email, phone, created_at
    FROM patients
    WHERE id = ?
  `;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
}

/**
 * Find a patient by email (used for uniqueness validation).
 * @param {string} email
 * @returns {Promise<Object|null>} Patient record or null
 */
async function findByEmail(email) {
  const sql = `
    SELECT id, name, email, phone, created_at
    FROM patients
    WHERE email = ?
  `;
  const [rows] = await pool.query(sql, [email]);
  return rows[0] || null;
}

/**
 * Update an existing patient.
 * @param {number} id
 * @param {Object} data - { name, email, phone }
 * @returns {Promise<Object|null>} Updated patient or null if not found
 */
async function update(id, { name, email, phone }) {
  const sql = `
    UPDATE patients
    SET name = ?, email = ?, phone = ?
    WHERE id = ?
  `;
  const [result] = await pool.query(sql, [name, email, phone, id]);
  if (result.affectedRows === 0) {
    return null;
  }
  return findById(id);
}

/**
 * Delete a patient by ID.
 * @param {number} id
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteById(id) {
  const sql = `
    DELETE FROM patients
    WHERE id = ?
  `;
  const [result] = await pool.query(sql, [id]);
  return result.affectedRows > 0;
}

/**
 * Check if patient has any existing appointments (for referential integrity).
 * @param {number} id
 * @returns {Promise<number>} Count of associated appointments
 */
async function countAppointments(id) {
  const sql = `
    SELECT COUNT(*) AS count
    FROM appointments
    WHERE patient_id = ?
  `;
  const [rows] = await pool.query(sql, [id]);
  return rows[0].count;
}

module.exports = {
  create,
  findAll,
  findById,
  findByEmail,
  update,
  deleteById,
  countAppointments,
};
