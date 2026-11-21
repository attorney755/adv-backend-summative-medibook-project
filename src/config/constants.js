'use strict';

// ── Business-rule constants ──────────────────────────────────────
// All magic numbers live here — referenced everywhere else.

/** Earliest appointment hour (inclusive), 24-hour clock */
const WORK_START_HOUR = 9;

/** Latest appointment hour (exclusive — last slot starts at 16:30) */
const WORK_END_HOUR = 17;

/** Slot duration in minutes */
const SLOT_MINUTES = 30;

/** Maximum appointments a single doctor can hold in one day */
const MAX_DAILY_APPOINTMENTS = 12;

/** Refund policy thresholds in hours */
const REFUND_FULL_THRESHOLD_HOURS = 48;   // > 48 h  → 100 %
const REFUND_HALF_THRESHOLD_HOURS = 24;   // 24–48 h → 50 %
// < 24 h → 0 %

/** Refund percentages (as decimals) */
const REFUND_FULL  = 1.00;
const REFUND_HALF  = 0.50;
const REFUND_NONE  = 0.00;

/** Busy-day threshold: fraction of daily cap that triggers "busy" */
const BUSY_DAY_THRESHOLD = 0.80;

module.exports = {
  WORK_START_HOUR,
  WORK_END_HOUR,
  SLOT_MINUTES,
  MAX_DAILY_APPOINTMENTS,
  REFUND_FULL_THRESHOLD_HOURS,
  REFUND_HALF_THRESHOLD_HOURS,
  REFUND_FULL,
  REFUND_HALF,
  REFUND_NONE,
  BUSY_DAY_THRESHOLD,
};
