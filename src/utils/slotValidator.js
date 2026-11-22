'use strict';

/**
 * Slot Validator Utility
 * 
 * In this module, I extracted the appointment slot validation rules into a pure function.
 * This satisfies Part C.2 business rules and allows the validator to be thoroughly
 * unit-tested in Part F without requiring a database connection.
 * 
 * Rules enforced:
 * 1. Date string must be valid and parsable.
 * 2. Appointment must be in the future (relative to the reference time).
 * 3. Working hours are strictly between 09:00 and 17:00 (last valid slot starts at 16:30).
 * 4. Slot boundary must be exactly aligned to 30-minute intervals (:00 or :30, 00 seconds).
 */

const {
  WORK_START_HOUR,
  WORK_END_HOUR,
  SLOT_MINUTES,
} = require('../config/constants');

/**
 * Validates whether an appointment datetime string satisfies all clinic rules.
 * @param {string|Date} datetimeInput - The requested appointment date/time
 * @param {Date} [referenceNow=new Date()] - Reference timestamp for future check (enables deterministic testing)
 * @returns {Object} { isValid: boolean, error?: string, parsedDate?: Date }
 */
function validateAppointmentSlot(datetimeInput, referenceNow = new Date()) {
  // Step 1: I checked if the input exists and is provided
  if (!datetimeInput) {
    return { isValid: false, error: 'Appointment datetime is required' };
  }

  // Step 2: I attempted to parse the input into a Date object
  const date = new Date(datetimeInput);
  if (isNaN(date.getTime())) {
    // If parsing fails, I rejected it as a malformed date
    return { isValid: false, error: 'Invalid datetime format' };
  }

  // Step 3: I checked if the requested time is in the future
  if (date.getTime() <= referenceNow.getTime()) {
    return {
      isValid: false,
      error: 'Appointments can only be booked for future dates and times',
    };
  }

  // Step 4: I extracted the hour, minute, and second components in local time
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  const millisecond = date.getMilliseconds();

  // Step 5: I verified the 30-minute slot boundary rule (:00 or :30, with 0 seconds)
  if (minute % SLOT_MINUTES !== 0 || second !== 0 || millisecond !== 0) {
    return {
      isValid: false,
      error: `Appointments must be scheduled on fixed ${SLOT_MINUTES}-minute slot boundaries (e.g. :00 or :30)`,
    };
  }

  // Step 6: I checked that the slot falls within clinic working hours (09:00 to 17:00)
  // Since each slot is 30 minutes, an appointment starting at 17:00 would finish at 17:30 (outside hours).
  // Therefore, valid start times range from 09:00 up to 16:30 inclusive.
  if (hour < WORK_START_HOUR || hour >= WORK_END_HOUR) {
    return {
      isValid: false,
      error: `Appointments must be within clinic working hours (${String(WORK_START_HOUR).padStart(2, '0')}:00–${String(WORK_END_HOUR).padStart(2, '0')}:00)`,
    };
  }

  // Finally, I confirmed that all business checks passed successfully
  return { isValid: true, parsedDate: date };
}

module.exports = {
  validateAppointmentSlot,
};
