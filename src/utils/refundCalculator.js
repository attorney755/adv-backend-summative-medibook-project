'use strict';

/**
 * Refund Calculator Utility (Part C.3 & Part F)
 * 
 * In this module, I implemented the server-side refund calculation as a pure function.
 * This guarantees that refund amounts are always computed server-side (never trusted from the client),
 * and allows comprehensive unit testing in Part F without any database dependency.
 * 
 * Documented Cancellation & Refund Policy:
 * 1. Notice > 48 hours: 100% refund (Full refund).
 * 2. Notice between 24 hours and 48 hours (24 <= notice <= 48): 50% refund (Half refund, inclusive of exact boundaries).
 * 3. Notice < 24 hours: 0% refund (No refund).
 */

const {
  REFUND_FULL_THRESHOLD_HOURS,
  REFUND_HALF_THRESHOLD_HOURS,
  REFUND_FULL,
  REFUND_HALF,
  REFUND_NONE,
} = require('../config/constants');

/**
 * Calculates the refund amount based on notice given prior to the appointment.
 * 
 * @param {number} amountPaid - Total amount paid for the consultation
 * @param {string|Date} appointmentDatetime - Scheduled date/time of the appointment
 * @param {Date} [cancellationTime=new Date()] - Exact time cancellation is requested (enables deterministic testing)
 * @returns {Object} { noticeHours, refundPercentage, refundAmount }
 */
function calculateRefund(amountPaid, appointmentDatetime, cancellationTime = new Date()) {
  // Step 1: I parsed both the appointment timestamp and the cancellation timestamp
  const apptTime = new Date(appointmentDatetime).getTime();
  const cancelTime = new Date(cancellationTime).getTime();

  // Step 2: I computed the difference in milliseconds and converted it into hours
  const diffMs = apptTime - cancelTime;
  const noticeHours = diffMs / (1000 * 60 * 60);

  let refundPercentage = REFUND_NONE;

  // Step 3: I applied the documented refund tiers:
  // Tier 1: More than 48 hours notice -> 100% refund
  if (noticeHours > REFUND_FULL_THRESHOLD_HOURS) {
    refundPercentage = REFUND_FULL;
  }
  // Tier 2: Between 24 hours and 48 hours (inclusive) -> 50% refund
  else if (noticeHours >= REFUND_HALF_THRESHOLD_HOURS) {
    refundPercentage = REFUND_HALF;
  }
  // Tier 3: Less than 24 hours notice -> 0% refund
  else {
    refundPercentage = REFUND_NONE;
  }

  // Step 4: Next, I multiplied the fee by the refund percentage and rounded to 2 decimal places
  const refundAmount = Math.round((parseFloat(amountPaid) * refundPercentage) * 100) / 100;

  // Finally, I returned the computed refund details
  return {
    noticeHours: parseFloat(noticeHours.toFixed(2)),
    refundPercentage: refundPercentage * 100,
    refundAmount,
  };
}

module.exports = {
  calculateRefund,
};
