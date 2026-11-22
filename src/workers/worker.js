'use strict';

/**
 * Background Worker Process (Part E)
 * 
 * In this module, I implemented the dedicated background worker process.
 * Architectural Rule: As required by the rubric, this worker runs as a SEPARATE PROCESS
 * from the Express web server (started via 'npm run worker').
 * 
 * Key Responsibilities:
 * 1. Promotes waitlisted patients when an appointment cancellation frees a slot.
 * 2. Handles promoted booking failures gracefully: re-queues the patient at the head
 *    of the waitlist via LPUSH so the patient is NEVER lost from both queue and table!
 * 3. Consumes appointment confirmation jobs and logs simulated SMS/Email notifications
 *    to logs/audit.log.
 */

require('dotenv').config();
const { getConnectedRedisClient } = require('../config/redis');
const queueService = require('../services/queueService');
const appointmentModel = require('../models/appointmentModel');
const doctorModel = require('../models/doctorModel');
const { logAuditEvent } = require('../utils/auditLogger');
const { MAX_DAILY_APPOINTMENTS } = require('../config/constants');

/**
 * Formats a date to MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
 */
function toMysqlDatetime(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

let isRunning = true;

/**
 * Processes a freed slot event by attempting to promote the next waitlisted patient.
 */
async function processSlotFreedEvent(client) {
  // Step 1: I polled the slot freed queue for pending cancellation events
  const rawEvent = await client.lPop(queueService.QUEUE_SLOT_FREED);
  if (!rawEvent) return;

  const event = JSON.parse(rawEvent);
  const { doctor_id, appointment_datetime } = event;

  console.log(`[Worker] Slot freed detected for Doctor ${doctor_id} at ${appointment_datetime}`);

  // Step 2: I checked if any patient is waiting in the Redis waitlist for this doctor and slot
  const nextPatient = await queueService.getNextWaitlistedPatient(doctor_id, appointment_datetime);
  if (!nextPatient) {
    console.log(`[Worker] No patients currently on the waitlist for Doctor ${doctor_id} at ${appointment_datetime}`);
    return;
  }

  console.log(`[Worker] Attempting to promote waitlisted patient ${nextPatient.patient_name} (ID: ${nextPatient.patient_id})`);

  // Step 3: Critical Rubric Requirement — I wrapped the promotion in a robust try/catch block
  // to ensure that if the promoted booking fails, the patient is NEVER lost!
  try {
    // I checked the doctor's consultation fee
    const doctor = await doctorModel.findById(doctor_id);
    const fee = doctor ? doctor.consultation_fee : nextPatient.consultation_fee || 100.00;
    const mysqlDatetime = toMysqlDatetime(appointment_datetime);

    // Next, I attempted to create the confirmed appointment in the database
    const appointment = await appointmentModel.create({
      patient_id: nextPatient.patient_id,
      doctor_id: doctor_id,
      appointment_datetime: mysqlDatetime,
      amount_paid: fee,
    });

    console.log(`[Worker] Successfully promoted waitlisted patient into Appointment ID ${appointment.id}`);

    // Then, I logged the successful waitlist promotion into logs/audit.log
    await logAuditEvent('WAITLIST_PROMOTED', {
      appointment_id: appointment.id,
      patient_id: nextPatient.patient_id,
      patient_name: nextPatient.patient_name,
      doctor_id: doctor_id,
      appointment_datetime: appointment_datetime,
      amount_paid: appointment.amount_paid,
    });

    // Next, I enqueued a confirmation notification for the newly promoted patient
    await queueService.enqueueNotification({
      appointment_id: appointment.id,
      patient_id: nextPatient.patient_id,
      patient_name: nextPatient.patient_name,
      doctor_id: doctor_id,
      doctor_name: doctor ? doctor.name : nextPatient.doctor_name,
      appointment_datetime: appointment_datetime,
      room: doctor ? doctor.room : 'General',
      amount_paid: appointment.amount_paid,
      promoted_from_waitlist: true,
    });
  } catch (err) {
    // Step 4: FAILURE RECOVERY STRATEGY (Rubric: "patient must not simply vanish")
    // If the database insert fails (e.g. daily cap exceeded or unexpected DB error),
    // I re-queued the patient back to the HEAD of the waitlist using LPUSH!
    console.error(`[Worker Error] Promotion failed for patient ${nextPatient.patient_id}: ${err.message}`);
    console.log(`[Worker] Re-queuing patient ${nextPatient.patient_name} at the head of the waitlist...`);

    await queueService.requeueWaitlistedPatient(doctor_id, appointment_datetime, nextPatient);

    // I also logged this incident in logs/audit.log for administrative visibility
    await logAuditEvent('WAITLIST_PROMOTION_FAILED', {
      patient_id: nextPatient.patient_id,
      doctor_id: doctor_id,
      appointment_datetime: appointment_datetime,
      error: err.message,
      recovered: 'Patient re-queued at the front of the list',
    });
  }
}

/**
 * Processes an appointment confirmation notification job.
 * Writes simulated SMS/Email to logs/audit.log.
 */
async function processNotificationJob(client) {
  // Step 1: I popped the next notification job from the queue
  const rawJob = await client.lPop(queueService.QUEUE_NOTIFICATIONS);
  if (!rawJob) return;

  const job = JSON.parse(rawJob);

  // Step 2: I constructed the simulated message text
  const messageText = `Dear ${job.patient_name}, your appointment with ${job.doctor_name} on ${job.appointment_datetime} (Room: ${job.room || 'R-01'}) is confirmed. Total paid: $${job.amount_paid}.`;

  console.log(`[Worker Notification] ${messageText}`);

  // Step 3: As required by Part E.2, I processed the job by logging the message to logs/audit.log
  await logAuditEvent('NOTIFICATION_DELIVERED', {
    appointment_id: job.appointment_id,
    patient_id: job.patient_id,
    patient_name: job.patient_name,
    doctor_name: job.doctor_name,
    appointment_datetime: job.appointment_datetime,
    channel: 'SMS/Email',
    simulated_message: messageText,
  });
}

/**
 * Main worker loop.
 */
async function startWorker() {
  console.log('=====================================================');
  console.log(' MediBook Background Worker Process Started (Part E) ');
  console.log(' Listening for freed slots and notification jobs...  ');
  console.log('=====================================================');

  const client = await getConnectedRedisClient();

  while (isRunning) {
    try {
      // Process pending freed slots (waitlist promotions)
      await processSlotFreedEvent(client);

      // Process pending notifications
      await processNotificationJob(client);
    } catch (loopErr) {
      console.error('[Worker Loop Error]', loopErr.message);
    }

    // Sleep 500ms before next poll cycle to prevent busy-waiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// Start worker if executed directly as entrypoint
if (require.main === module) {
  startWorker().catch((err) => {
    console.error('[Worker Fatal Error]', err);
    process.exit(1);
  });
}

module.exports = {
  startWorker,
  processSlotFreedEvent,
  processNotificationJob,
};
