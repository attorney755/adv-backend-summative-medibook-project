'use strict';

/**
 * Unit Tests for Slot Validator Utility (Part F)
 * 
 * In this test suite, I wrote unit tests to thoroughly verify clinic slot validation rules:
 * 1. Future appointments only.
 * 2. Clinic working hours: 09:00 to 17:00 (latest valid slot starts at 16:30).
 * 3. 30-minute boundary alignment (:00 or :30).
 * 4. Input sanitization (malformed dates, missing inputs).
 * 
 * Architectural Rule: As required by the rubric, these tests run with ZERO dependencies
 * on MySQL or Redis using fixed reference dates.
 */

const { validateAppointmentSlot } = require('../src/utils/slotValidator');

describe('Slot Validator Unit Tests (Part F)', () => {
  // I defined a fixed reference time for deterministic testing (Monday 2026-08-10 at 08:00)
  const FIXED_NOW = new Date('2026-08-10T08:00:00');

  // Test 1: Happy path - Valid morning slot
  test('Happy path: should accept a valid future slot within working hours at 10:00', () => {
    // I chose a future slot at 10:00 on the same day
    const validSlot = new Date('2026-08-10T10:00:00');

    // Next, I validated the slot against my fixed reference time
    const result = validateAppointmentSlot(validSlot, FIXED_NOW);

    // Then, I asserted that the check passed
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.parsedDate).toBeDefined();
  });

  // Test 2: Edge Case - Earliest valid slot at exactly 09:00
  test('Edge case: should accept the earliest possible slot at 09:00 exactly', () => {
    // I tested the exact clinic opening hour
    const openingSlot = new Date('2026-08-10T09:00:00');

    // Next, I ran the validator
    const result = validateAppointmentSlot(openingSlot, FIXED_NOW);

    // Then, I verified it is accepted
    expect(result.isValid).toBe(true);
  });

  // Test 3: Edge Case - Latest valid slot at 16:30
  test('Edge case: should accept the latest possible slot at 16:30 (finishes at 17:00)', () => {
    // I tested the 16:30 slot which concludes at 17:00
    const latestSlot = new Date('2026-08-10T16:30:00');

    // Next, I ran the validator
    const result = validateAppointmentSlot(latestSlot, FIXED_NOW);

    // Then, I asserted that 16:30 is accepted
    expect(result.isValid).toBe(true);
  });

  // Test 4: Edge Case - Exactly 17:00 boundary (closing time)
  test('Edge case (17:00 exactly): should reject 17:00 because a 30-min consultation finishes past closing', () => {
    // I tested booking at 17:00 exactly
    const closingTime = new Date('2026-08-10T17:00:00');

    // Next, I ran the validator
    const result = validateAppointmentSlot(closingTime, FIXED_NOW);

    // Then, I asserted that 17:00 is rejected as outside working hours
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('within clinic working hours');
  });

  // Test 5: Edge Case - Early morning before opening at 08:30
  test('Edge case: should reject a slot before clinic opening (e.g. 08:30)', () => {
    const earlySlot = new Date('2026-08-10T08:30:00');
    const earlierNow = new Date('2026-08-10T07:00:00');

    const result = validateAppointmentSlot(earlySlot, earlierNow);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('within clinic working hours');
  });

  // Test 6: Edge Case - Misaligned slot boundary at 09:15
  test('Edge case (09:15): should reject a slot that does not align with 30-minute boundaries', () => {
    // I tested a slot at 09:15
    const misalignedSlot = new Date('2026-08-10T09:15:00');

    // Next, I ran the validator
    const result = validateAppointmentSlot(misalignedSlot, FIXED_NOW);

    // Then, I asserted that non-30-minute intervals are rejected
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('fixed 30-minute slot boundaries');
  });

  // Test 7: Edge Case - Slot with seconds (10:00:30)
  test('Edge case: should reject slot with non-zero seconds', () => {
    const slotWithSeconds = new Date('2026-08-10T10:00:30');

    const result = validateAppointmentSlot(slotWithSeconds, FIXED_NOW);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('fixed 30-minute slot boundaries');
  });

  // Test 8: Edge Case - Malformed datetime string
  test('Edge case: should reject malformed or unparseable datetime strings', () => {
    // I tested passing an invalid string
    const result = validateAppointmentSlot('not-a-real-date', FIXED_NOW);

    // Then, I verified it was rejected with a clear format error
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid datetime format');
  });

  // Test 9: Edge Case - Past date relative to reference time
  test('Edge case: should reject a datetime that is in the past', () => {
    // I selected a date before the reference time
    const pastSlot = new Date('2026-08-09T10:00:00');

    // Next, I ran the validator
    const result = validateAppointmentSlot(pastSlot, FIXED_NOW);

    // Then, I confirmed past dates are disallowed
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('only be booked for future dates');
  });

  // Test 10: Edge Case - Missing or empty datetime input
  test('Edge case: should reject missing or empty datetime input', () => {
    const resultNull = validateAppointmentSlot(null, FIXED_NOW);
    const resultUndefined = validateAppointmentSlot(undefined, FIXED_NOW);

    expect(resultNull.isValid).toBe(false);
    expect(resultUndefined.isValid).toBe(false);
  });
});
