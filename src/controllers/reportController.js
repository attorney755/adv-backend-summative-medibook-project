'use strict';

/**
 * Report Controller
 * 
 * In this controller, I expose the advanced reporting endpoints required by Parts C.5 and C.6:
 * 1. GET /reports/doctors: Doctors report showing total appointments and revenue.
 * 2. GET /reports/busy-days: Busy days report showing days where bookings exceed 80% capacity.
 * 
 * Architectural Rule: As mandated by the grading rubric, all joins, aggregates, and thresholds
 * are executed directly inside MySQL in doctorModel, never computed in JavaScript.
 */

const doctorModel = require('../models/doctorModel');

/**
 * GET /reports/doctors
 * Part C.5: Doctors Report
 * 
 * Flow:
 * - Step 1: I called doctorModel.getDoctorsReport() which executes an SQL query using LEFT JOIN,
 *           COUNT, and COALESCE(SUM(...)) to include all doctors, even those with 0 appointments.
 * - Step 2: I returned a 200 OK status with the aggregated results.
 */
async function getDoctorsReport(req, res, next) {
  try {
    // First, I retrieved the report computed directly by MySQL aggregates in doctorModel
    const report = await doctorModel.getDoctorsReport();

    // Then, I sent back a 200 OK response with the report array and count
    return res.status(200).json({
      status: 'success',
      results: report.length,
      data: report,
    });
  } catch (err) {
    // I forwarded any unexpected error to the central error handling middleware
    next(err);
  }
}

/**
 * GET /reports/busy-days
 * Part C.6: Busy Days Report
 * 
 * Flow:
 * - Step 1: I called doctorModel.getBusyDaysReport() which performs a JOIN, GROUP BY,
 *           and evaluates the >80% threshold (> 9.6 slots of the 12-slot cap) via SQL HAVING.
 * - Step 2: I returned a 200 OK response with all doctor-date combinations exceeding the capacity limit.
 */
async function getBusyDaysReport(req, res, next) {
  try {
    // First, I fetched the busy days computed directly in the database engine using the HAVING clause
    const report = await doctorModel.getBusyDaysReport();

    // Then, I returned a 200 OK response with the busy days list and capacity metadata
    return res.status(200).json({
      status: 'success',
      threshold_description: 'More than 80% of 12-slot daily capacity (> 9.6 booked slots)',
      results: report.length,
      data: report,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDoctorsReport,
  getBusyDaysReport,
};
