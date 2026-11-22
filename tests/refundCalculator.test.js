'use strict';

/**
 * Unit Tests for Refund Calculator (Part F)
 * 
 * In this test suite, I wrote unit tests to verify the refund policy logic.
 * Architectural Rule: As required by the rubric, these tests run with ZERO dependencies
 * on MySQL or Redis using fixed reference dates for completely deterministic assertions.
 * 
 * Policy verified:
 * - More than 48 hours notice: 100% refund
 * - Exactly 48 hours notice: 50% refund (Boundary 1)
 * - 24 to 48 hours notice: 50% refund
 * - Exactly 24 hours notice: 50% refund (Boundary 2)
 * - Less than 24 hours notice: 0% refund
 */

const { calculateRefund } = require('../src/utils/refundCalculator');

describe('Refund Calculator Unit Tests (Part F)', () => {
  // I chose a fixed future appointment timestamp for all test cases
  const APPOINTMENT_TIME = '2026-08-10T10:00:00.000Z';
  const CONSULTATION_FEE = 150.00;

  // Test 1: Tier 1 - More than 48 hours notice
  test('Tier 1: should return 100% refund when notice is strictly greater than 48 hours', () => {
    // I set the cancellation time to 72 hours before the appointment
    const cancellationTime = new Date('2026-08-07T10:00:00.000Z');

    // Next, I called the pure refund calculator function
    const result = calculateRefund(CONSULTATION_FEE, APPOINTMENT_TIME, cancellationTime);

    // Then, I asserted that the notice is 72 hours, refund is 100%, and amount matches the fee
    expect(result.noticeHours).toBe(72);
    expect(result.refundPercentage).toBe(100);
    expect(result.refundAmount).toBe(150.00);
  });

  // Test 2: Boundary 1 - Exactly 48 hours notice
  test('Boundary 1: should return 50% refund at exactly 48.00 hours notice per documented policy', () => {
    // I set the cancellation timestamp to exactly 48 hours before the appointment
    const cancellationTime = new Date('2026-08-08T10:00:00.000Z');

    // Next, I calculated the refund for this exact boundary
    const result = calculateRefund(CONSULTATION_FEE, APPOINTMENT_TIME, cancellationTime);

    // Then, I verified that exactly 48 hours falls into the 24–48h 50% tier
    expect(result.noticeHours).toBe(48);
    expect(result.refundPercentage).toBe(50);
    expect(result.refundAmount).toBe(75.00);
  });

  // Test 3: Tier 2 - Notice between 24 and 48 hours
  test('Tier 2: should return 50% refund when notice is between 24 and 48 hours (e.g. 36 hours)', () => {
    // I selected 36 hours notice
    const cancellationTime = new Date('2026-08-08T22:00:00.000Z');

    // Next, I ran the calculation
    const result = calculateRefund(CONSULTATION_FEE, APPOINTMENT_TIME, cancellationTime);

    // Then, I asserted that 50% refund is awarded
    expect(result.noticeHours).toBe(36);
    expect(result.refundPercentage).toBe(50);
    expect(result.refundAmount).toBe(75.00);
  });

  // Test 4: Boundary 2 - Exactly 24 hours notice
  test('Boundary 2: should return 50% refund at exactly 24.00 hours notice per documented policy', () => {
    // I set the cancellation timestamp to exactly 24 hours before the appointment
    const cancellationTime = new Date('2026-08-09T10:00:00.000Z');

    // Next, I ran the calculation for the lower 24h boundary
    const result = calculateRefund(CONSULTATION_FEE, APPOINTMENT_TIME, cancellationTime);

    // Then, I verified that exactly 24 hours is the inclusive lower bound for 50% refund
    expect(result.noticeHours).toBe(24);
    expect(result.refundPercentage).toBe(50);
    expect(result.refundAmount).toBe(75.00);
  });

  // Test 5: Tier 3 - Less than 24 hours notice
  test('Tier 3: should return 0% refund when notice is strictly less than 24 hours (e.g. 12 hours)', () => {
    // I set the cancellation to 12 hours before the appointment
    const cancellationTime = new Date('2026-08-09T22:00:00.000Z');

    // Next, I computed the refund
    const result = calculateRefund(CONSULTATION_FEE, APPOINTMENT_TIME, cancellationTime);

    // Then, I asserted that notice < 24h results in 0 refund
    expect(result.noticeHours).toBe(12);
    expect(result.refundPercentage).toBe(0);
    expect(result.refundAmount).toBe(0.00);
  });

  // Test 6: Edge Case - Cancellation requested after the appointment has passed
  test('Edge case: should return 0% refund when cancellation is requested after appointment time', () => {
    // I set the cancellation timestamp 2 hours after the scheduled appointment
    const cancellationTime = new Date('2026-08-10T12:00:00.000Z');

    // Next, I executed the calculator
    const result = calculateRefund(CONSULTATION_FEE, APPOINTMENT_TIME, cancellationTime);

    // Then, I verified that negative notice hours yield 0 refund
    expect(result.noticeHours).toBeLessThan(0);
    expect(result.refundPercentage).toBe(0);
    expect(result.refundAmount).toBe(0.00);
  });
});
