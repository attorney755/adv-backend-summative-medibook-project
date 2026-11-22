'use strict';

/**
 * Audit Logger Utility (Part D)
 * 
 * In this module, I implemented an asynchronous, non-blocking audit logging service.
 * Requirement Checklist:
 * - Appends every successful booking and cancellation as a JSON line to logs/audit.log.
 * - Uses asynchronous fs methods (fs.promises) — strictly NO *Sync calls inside request handlers.
 * - Auto-creates the logs/ directory if it does not exist on first run.
 * - Ensures any logging failure NEVER crashes or fails the user's HTTP request.
 */

const fs = require('fs').promises;
const path = require('path');

// I defined the directory and file path for the audit log
const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');

/**
 * Asynchronously log an event to logs/audit.log as a JSON line.
 * @param {string} action - Event type, e.g. 'APPOINTMENT_BOOKED', 'APPOINTMENT_CANCELLED'
 * @param {Object} details - Event payload containing appointment/refund data
 */
async function logAuditEvent(action, details = {}) {
  try {
    // Step 1: I constructed the structured log entry with a timestamp
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      ...details,
    };

    // Step 2: I ensured the logs/ directory exists before writing (recursive: true prevents error if it exists)
    await fs.mkdir(LOG_DIR, { recursive: true });

    // Step 3: Next, I appended the JSON string followed by a newline character using non-blocking async fs
    await fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf8');
  } catch (err) {
    // Step 4: Critical requirement — I caught any filesystem errors so the user's request never fails
    console.error('[AuditLogger Error] Failed to write audit log entry:', err.message);
  }
}

module.exports = {
  logAuditEvent,
  LOG_FILE,
  LOG_DIR,
};
