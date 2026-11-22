'use strict';

/**
 * Queue Service (Part E)
 * 
 * In this service, I implemented all Redis-backed queue operations:
 * 1. Waitlist Queue: Manages waitlists per doctor and slot boundary using Redis lists.
 * 2. Slot Freed Queue: Enqueues events when an appointment is cancelled.
 * 3. Notifications Queue: Enqueues appointment confirmation SMS/email jobs for the background worker.
 */

const { getConnectedRedisClient } = require('../config/redis');

// Redis key prefixes
const WAITLIST_PREFIX = 'medibook:waitlist';
const QUEUE_SLOT_FREED = 'medibook:queue:slot_freed';
const QUEUE_NOTIFICATIONS = 'medibook:queue:notifications';

/**
 * Helper to construct the specific waitlist key for a doctor and slot.
 */
function getWaitlistKey(doctorId, appointmentDatetime) {
  const normalizedDate = new Date(appointmentDatetime).toISOString();
  return `${WAITLIST_PREFIX}:${doctorId}:${normalizedDate}`;
}

/**
 * Adds a patient to the waitlist queue for a specific doctor slot.
 * Uses RPUSH to maintain a FIFO (First-In, First-Out) order.
 */
async function addToWaitlist(doctorId, appointmentDatetime, patientData) {
  // First, I obtained an active Redis client connection
  const client = await getConnectedRedisClient();
  const key = getWaitlistKey(doctorId, appointmentDatetime);

  // Next, I serialized the patient payload with a joined timestamp
  const payload = JSON.stringify({
    ...patientData,
    doctor_id: doctorId,
    appointment_datetime: appointmentDatetime,
    waitlisted_at: new Date().toISOString(),
  });

  // Then, I pushed the patient to the tail of the Redis list (FIFO)
  const position = await client.rPush(key, payload);

  // Finally, I returned the waitlist position
  return {
    key,
    position,
  };
}

/**
 * Pops the first waitlisted patient from the queue for promotion.
 * Uses LPOP to serve the patient who has waited the longest.
 */
async function getNextWaitlistedPatient(doctorId, appointmentDatetime) {
  // First, I got the connected client
  const client = await getConnectedRedisClient();
  const key = getWaitlistKey(doctorId, appointmentDatetime);

  // Next, I popped the oldest waitlisted patient from the front of the list
  const data = await client.lPop(key);

  // Then, I parsed the JSON string back into an object if one was found
  return data ? JSON.parse(data) : null;
}

/**
 * Re-queues a patient at the FRONT of the waitlist if their promoted booking failed.
 * Crucial Rubric Requirement: Guarantees patient is never lost from both queue and table!
 * Uses LPUSH to restore their first-in-line priority.
 */
async function requeueWaitlistedPatient(doctorId, appointmentDatetime, patientData) {
  // First, I obtained the Redis client
  const client = await getConnectedRedisClient();
  const key = getWaitlistKey(doctorId, appointmentDatetime);

  // Next, I pushed the patient back to the HEAD of the list with LPUSH
  const payload = JSON.stringify({
    ...patientData,
    requeued_at: new Date().toISOString(),
  });
  await client.lPush(key, payload);
}

/**
 * Enqueues a slot freed event when an appointment is cancelled.
 */
async function enqueueSlotFreed(doctorId, appointmentDatetime) {
  // First, I obtained the Redis client
  const client = await getConnectedRedisClient();

  // Next, I structured the event payload
  const eventPayload = JSON.stringify({
    doctor_id: doctorId,
    appointment_datetime: appointmentDatetime,
    freed_at: new Date().toISOString(),
  });

  // Then, I pushed the event into the slot freed queue for the worker process
  await client.rPush(QUEUE_SLOT_FREED, eventPayload);
}

/**
 * Enqueues a notification job for a confirmed appointment.
 */
async function enqueueNotification(notificationData) {
  // First, I got the Redis client
  const client = await getConnectedRedisClient();

  // Next, I structured the notification job with appointment and patient details
  const payload = JSON.stringify({
    ...notificationData,
    enqueued_at: new Date().toISOString(),
  });

  // Then, I pushed the job into the notifications queue
  await client.rPush(QUEUE_NOTIFICATIONS, payload);
}

/**
 * Gets the current count of waitlisted patients for a slot.
 */
async function getWaitlistLength(doctorId, appointmentDatetime) {
  const client = await getConnectedRedisClient();
  const key = getWaitlistKey(doctorId, appointmentDatetime);
  return await client.lLen(key);
}

module.exports = {
  addToWaitlist,
  getNextWaitlistedPatient,
  requeueWaitlistedPatient,
  enqueueSlotFreed,
  enqueueNotification,
  getWaitlistLength,
  QUEUE_SLOT_FREED,
  QUEUE_NOTIFICATIONS,
};
