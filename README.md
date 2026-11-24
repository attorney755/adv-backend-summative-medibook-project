# Final Assessment — Backend Development

**Weight:** 30% of final grade
**Duration:** 2 weeks
**Mode:** Individual project
**Stack (mandatory):** Node.js, Express.js, MySQL (with parameterized queries only), Redis

---

## Scenario — "MediBook" Clinic Appointment System

A community clinic wants a backend service for booking doctor appointments. Doctors see patients in fixed 30-minute slots during working hours (09:00–17:00), each doctor can handle at most **12 appointments per day**, and the clinic administrator needs reports. You will design the database, build the API, and handle the operational concerns (background jobs, logging, testing).

**Entity limit:** Your database must contain **exactly 3 entities**:

| Entity | Purpose |
|---|---|
| `patients` | People who book appointments |
| `doctors` | Doctors with a specialty, consultation fee, and room |
| `appointments` | A patient's booking with a doctor at a specific date/time (links the other two) |

You may add columns as needed, but no additional tables (lookup/locale JSON files don't count).

---

## Part A — Database Design & Normalization

The clinic currently tracks everything in this single spreadsheet:

| appt_ref | patient_name | patient_email | patient_phone | doctor_name | specialty | consultation_fee | room | appt_datetime | amount_paid | booked_on |
|---|---|---|---|---|---|---|---|---|---|---|
| AP-001 | Ama Mensah | ama@mail.com | 0244-111-222 | Dr. Boateng | Dermatology | 150.00 | R-12 | 2026-08-10 09:00 | 150.00 | 2026-07-01 |
| AP-002 | Kojo Owusu | kojo@mail.com | 0555-333-444 | Dr. Boateng | Dermatology | 150.00 | R-12 | 2026-08-10 09:30 | 120.00 | 2026-07-02 |
| AP-003 | Ama Mensah | ama@mail.com | 0244-111-222 | Dr. Adjei | Paediatrics | 100.00 | R-03 | 2026-08-15 10:00 | 100.00 | 2026-07-03 |

Study the spreadsheet, then produce a **database schema diagram** of your design in fully normalized form (up to 3NF). The diagram must show **everything**:

- all 3 entities with every column and its MySQL data type,
- primary keys and foreign keys, clearly marked,
- the relationships between the entities and their cardinality (1:N, etc.),
- every constraint that enforces a business rule (`NOT NULL`, `UNIQUE`, `CHECK`) — in particular, it must be visible from the diagram that *a doctor cannot have two appointments at the same date/time*.

Use any tool you like (dbdiagram.io, draw.io) and include it in your repository as `schema-diagram` (image or PDF).

## Part B — Database Implementation & Project Setup

1. **Table creation.** Translate your Part A diagram into a MySQL DDL script, `database/schema.sql`, that creates the database and the 3 tables — data types, primary keys, foreign keys, and every constraint shown on the diagram. The script must run cleanly on a fresh MySQL server. Also provide `database/seed.sql` with realistic sample data: at least 3 patients, 3 doctors (including one with no appointments), and 8 appointments (including one doctor-day at or near the 12-slot daily cap).

2. **Project structure.** Set up the Express project in a **models / controllers / routes** structure:

```
├── database/          schema.sql and seed.sql (Part B.1)
└── src/
    ├── models/        all application SQL lives here — nowhere else
    ├── controllers/   business logic; calls model functions, never the DB directly
    └── routes/        maps URLs and HTTP methods to controllers
```

Every SQL statement in the application must use **parameterized queries** (`?` placeholders via `mysql2`). SQL found in a controller or route file loses marks. **Do not use any ORM for this assignment.**

## Part C — Controllers & Endpoints

Implement endpoints for the operations below. **Designing the API is part of the assessment**: you choose the URL paths, the HTTP methods, and how the endpoints are grouped into controllers and routes — your choices should follow REST conventions and will be marked. The business rules listed are **requirements** — *how* you satisfy them is your design decision, and you will be asked to defend it at the viva.

1. **Basic CRUD** — standard **C**reate, **R**ead (one and all), **U**pdate, and **D**elete operations for patients and for doctors, with sensible validation. (Appointments get their create/delete behaviour from the two operations below — no separate CRUD needed there.)

2. **Book an appointment**. Rules that must always hold:
   - Appointments can only be booked in the future, within working hours (09:00–17:00), on a 30-minute slot boundary.
   - A doctor never exceeds 12 appointments in a day.
   - Two patients can never hold the same doctor slot — even when both requests arrive at the same instant.

3. **Cancel an appointment**. Rules:
   - The refund is computed by the server from the notice given: more than 48 hours → 100%; 24–48 hours → 50%; less than 24 hours → 0%. The response states the refund amount.
   - The cancellation and its refund record succeed or fail together.
   - A cancelled slot becomes bookable by another patient, while the cancellation record is kept for refund history.
   - A cancellation notifies the waitlist (Part E).

4. **Doctor statistics** — for a given doctor: revenue collected, upcoming appointment count, appointments per day for the next 7 days, and utilization % against the 12-slot daily cap.

Operations 5 and 6 are where your **advanced SQL** is assessed: the results must be produced by the SQL in your models (joins, aggregates, etc) — not fetched raw and computed in JavaScript.

5. **Doctors report** — every doctor's total appointments and revenue collected, including doctors with zero appointments.
6. **Busy days report** — every (doctor, date) where more than 80% of the 12-slot daily capacity is booked.

### General requirements (all endpoints)

Input validation with meaningful `400` messages; correct status codes (`201`, `404`, `409`, `422`); a central error-handling middleware.

## Part D — Node.js `fs` Module

**Audit log:** every successful booking and cancellation must be appended as a JSON line to `logs/audit.log` using the `fs` module (async, non-blocking — no `*Sync` calls inside request handlers). The logger must create the `logs/` directory on first run if it doesn't exist, and a logging failure must **not** fail the user's request.

## Part E — Queues & Redis

1. **Waitlist queue:** when the requested slot (or the doctor's whole day) is fully booked, offer the patient a waitlist spot — push them onto a queue (Redis list, or Bull/BullMQ). When a cancellation frees a slot, a **worker process** (separate from the web server) pops the first waitlisted patient and books them in. Think through: what happens if the promoted booking itself fails? The patient must not simply vanish from both the queue and the appointments table.
2. **Notification jobs:** every confirmed appointment enqueues a "confirmation SMS/email" job; the worker processes it by writing the message to the audit log (no real sending needed).

## Part F — Unit Testing

Using Jest, write **at least 6 meaningful unit tests**:

- The refund calculator from Part C.3 — cover all three tiers **and both boundaries** (exactly 24 hours, exactly 48 hours). Boundary behaviour must match your documented policy.
- One validation function of your choice — e.g., the slot-alignment/working-hours check — including at least one edge case (17:00 exactly? 09:15? a malformed date?).

Tests must not require a live MySQL or Redis connection — that's the point of extracting pure functions. `npm test` must run them.

## Part G — i18n & l10n: Course Feedback Page

Create a **simple HTML page** (served by your Express app at `GET /feedback`) containing a short course-feedback form with **exactly 5 essay questions** (each answered in a `<textarea>`):

1. Which topic in this course did you find most challenging, and why?
2. Describe one concept you understood only after the practical assignments. What made it click?
3. How has your approach to designing databases or APIs changed since the start of the trimester?
4. What would you improve about how this course was taught or assessed?
5. How do you plan to apply what you learned in this course going forward?

**i18n/l10n requirement (keep it simple):** the page title, instructions, and all 5 questions must be loaded from locale files (e.g., `locales/en.json` and `locales/fr.json` — English plus one other language of your choice). Visiting `/feedback?lang=fr` shows the translated page; the default is English, and an unsupported `lang` value must fall back to English rather than crash. Display today's date on the page formatted for the active locale (e.g., using `Intl.DateTimeFormat`).

---

## Submission Requirements

- Git repository (with meaningful commit history — a single "final commit" will be questioned) containing:
  - `schema-diagram` (image or PDF), `schema.sql`, and `seed.sql` (as specified in Part B)
  - Application source, worker process, tests, locale files
  - `README.md` with: setup steps, `.env.example`, and the short written justifications requested in Parts C, D, and E
- The app must start with `npm install && npm start` (plus documented MySQL/Redis setup) and tests with `npm test`.
- A short **viva/demo (10 minutes)** walkthrough.

**Automatic penalties:** SQL injection vector anywhere in the app (−15), secrets committed to the repo (−5), app does not start per README instructions (−10), work the student cannot explain in the video (or at a follow-up viva if called) | Academic integrity referral; affected criteria re-scored at Developing or below |

---

# MediBook Project Implementation Documentation

## Video Walkthrough Link
- **Walkthrough Video:** [Watch MediBook Video Walkthrough (Recording 11-24 at 16.05.mp4)](https://byupathwayworldwideprod-my.sharepoint.com/:v:/g/personal/aniyigaba_byupathway_edu/IQD6v6Cg7UzXQoa2xdk8iGIPAYXdznkA6SKI0AqgnXCSzDw?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D&e=dZZhos)

---

## 1. System Setup & Running the Application

### Prerequisites
- **Node.js**: v18.0.0 or higher (built and verified on v26.13.0)
- **MySQL**: 8.0+
- **Redis**: 6.0+

### Step-by-Step Setup
1. **Clone your fork and navigate into the project:**
   ```bash
   git clone https://github.com/attorney755/adv-backend-summative-medibook-project.git
   cd adv-backend-summative-medibook-project
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create your own local `.env` file by copying the provided `.env.example` template:
   ```bash
   cp .env.example .env
   ```
   Open `.env` in any text editor and fill in your local MySQL credentials:
   ```env
   PORT=3000
   NODE_ENV=development

   # Set these to match your local MySQL credentials
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password_here
   DB_NAME=medibook

   # Redis configuration
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   ```

4. **Initialize MySQL Database and Seed Data:**
   Run the schema DDL and seed scripts on your local MySQL server (you will be prompted to enter your MySQL password):
   ```bash
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/seed.sql
   ```

5. **Start the Web Server:**
   ```bash
   npm start
   ```
   The Express API server starts on `http://localhost:3000`.

6. **Start the Background Worker Process (Separate Terminal):**
   ```bash
   npm run worker
   ```
   The dedicated background worker listens for freed slots to promote waitlisted patients and processes notification jobs.

7. **Run Automated Unit Tests:**
   ```bash
   npm test
   ```
   Executes all 16 Jest unit tests in memory with zero database or Redis dependencies.

---

## 2. Written Technical Justifications

### Part C — API Design & Concurrency Handling Justification
- **RESTful Resource Grouping:** URL paths are strictly resource-oriented (`/patients`, `/doctors`, `/appointments`, `/reports`, `/feedback`). Standard HTTP verbs match actions (`POST` to create, `GET` to read, `PUT` to update, `DELETE` to cancel/delete).
- **HTTP Status Codes:**
  - `200 OK`: Successful retrieval, update, or cancellation.
  - `201 Created`: Successful creation of a patient, doctor, appointment, or waitlist entry.
  - `400 Bad Request`: Client-side syntax error or missing mandatory fields.
  - `404 Not Found`: Unknown resource ID.
  - `409 Conflict`: Duplicate unique key (e.g. duplicate patient email, appointment slot collision, or attempting to delete a doctor/patient with active appointments).
  - `422 Unprocessable Entity`: Semantic business-rule violation (e.g. past appointment, outside 09:00–17:00 working hours, not on a 30-minute boundary, or doctor exceeding 12 daily appointments).
- **Concurrency & Race Condition Handling:** To ensure two patients can never hold the same doctor slot—even under simultaneous requests—we implement a two-tier defense:
  1. **Application-level pre-check:** `findActiveByDoctorAndSlot()` checks slot availability before attempting creation.
  2. **Database-level atomic constraint:** A composite unique index `UNIQUE(doctor_id, active_slot)` is enforced at the database engine level (using a virtual generated column `active_slot` that evaluates to `appointment_datetime` when confirmed and `NULL` when cancelled). Even if two concurrent requests race past the application check at the exact same millisecond, MySQL will atomically reject the second insert with `ER_DUP_ENTRY`, which the controller catches and transforms into a clean `409 Conflict` response with an offer to join the waitlist.
- **Atomic Cancellation & Refunds:** `cancelWithRefund()` executes inside a MySQL transaction with row-level locking (`SELECT ... FOR UPDATE`). This guarantees that updating the status to `'cancelled'` and setting the calculated `refund_amount` succeed or fail together as a single atomic unit.

### Part D — Node.js `fs` Module & Audit Logging Justification
- **Non-blocking Asynchronous Operations:** All audit logging uses `fs.promises.mkdir()` and `fs.promises.appendFile()`. By avoiding synchronous `*Sync` functions inside request handlers, the Node.js event loop remains unblocked, allowing the server to maintain high throughput and low response latency.
- **Fault-Tolerant Logging:** The logging utility wraps I/O operations in a non-fatal `try...catch` block. If the filesystem encounters an unexpected error (e.g. permission issue or disk full), the incident is caught and logged to the system error stream, but **never throws an unhandled error to the client**. A logging glitch must never fail an otherwise successful user booking or cancellation.

### Part E — Redis Queues & Background Worker Architecture Justification
- **Process Decoupling:** In production architectures, CPU-intensive or external I/O tasks (such as SMS/Email dispatching and queue polling) must not run inside the HTTP web server thread. MediBook runs the worker as an independent OS process (`src/workers/worker.js`) via `npm run worker`. If the web server crashes or restarts, queued background jobs remain safely persisted in Redis.
- **Waitlist Promotion & Failure Recovery Strategy:**
  - When an appointment is cancelled, the web server pushes an event to `medibook:queue:slot_freed`.
  - The worker process pops the first waitlisted patient from the Redis FIFO list (`LPOP`).
  - The worker attempts to promote the patient into a confirmed database booking.
  - **Failure Recovery Guarantee:** If the promoted booking fails (e.g. database disconnect or unexpected error), the catch block immediately re-queues the patient at the **head of the queue** via `LPUSH` (`queueService.requeueWaitlistedPatient`). This guarantees that a waitlisted patient is **never lost from both the queue and the appointments table**, preserving their priority for the next available opportunity.

