-- MediBook Clinic Appointment System
-- Sample Seed Data (Part B)
-- Requirement Checklist:
-- [x] At least 3 patients (4 provided)
-- [x] At least 3 doctors, including one with zero appointments (Dr. Osei has 0)
-- [x] At least 8 appointments (12 provided)
-- [x] One doctor-day at or near the 12-slot daily cap (Dr. Boateng has 10 on 2026-08-10 = 83.3% capacity)

USE medibook;

-- Clean existing data
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE appointments;
TRUNCATE TABLE doctors;
TRUNCATE TABLE patients;
SET FOREIGN_KEY_CHECKS = 1;

-- -------------------------------------------------------------
-- Seed Patients
-- -------------------------------------------------------------
INSERT INTO patients (id, name, email, phone, created_at) VALUES
(1, 'Ama Mensah', 'ama@mail.com', '0244-111-222', '2026-06-15 08:30:00'),
(2, 'Kojo Owusu', 'kojo@mail.com', '0555-333-444', '2026-06-20 09:15:00'),
(3, 'Kwame Asante', 'kwame@mail.com', '0200-555-666', '2026-07-01 10:00:00'),
(4, 'Akua Mensah', 'akua@mail.com', '0277-888-999', '2026-07-10 11:45:00');

-- -------------------------------------------------------------
-- Seed Doctors
-- Doctor 1: Dr. Boateng (Dermatology) - has 10 appointments on 2026-08-10 (near cap)
-- Doctor 2: Dr. Adjei (Paediatrics) - has 2 appointments on 2026-08-15
-- Doctor 3: Dr. Osei (General Practice) - has 0 appointments (required by spec)
-- -------------------------------------------------------------
INSERT INTO doctors (id, name, specialty, consultation_fee, room, created_at) VALUES
(1, 'Dr. Boateng', 'Dermatology', 150.00, 'R-12', '2026-05-01 08:00:00'),
(2, 'Dr. Adjei', 'Paediatrics', 100.00, 'R-03', '2026-05-15 08:00:00'),
(3, 'Dr. Osei', 'General Practice', 80.00, 'R-05', '2026-06-01 08:00:00');

-- -------------------------------------------------------------
-- Seed Appointments
-- Fixed 30-minute slots between 09:00 and 17:00
-- -------------------------------------------------------------

-- Dr. Boateng (Doctor 1) on 2026-08-10: 10 appointments (10 / 12 = 83.3% of cap -> triggers busy day report)
INSERT INTO appointments (id, patient_id, doctor_id, appointment_datetime, status, amount_paid, refund_amount, booked_on) VALUES
(1,  1, 1, '2026-08-10 09:00:00', 'confirmed', 150.00, 0.00, '2026-07-01 09:00:00'),
(2,  2, 1, '2026-08-10 09:30:00', 'confirmed', 150.00, 0.00, '2026-07-02 10:15:00'),
(3,  3, 1, '2026-08-10 10:00:00', 'confirmed', 150.00, 0.00, '2026-07-03 11:20:00'),
(4,  4, 1, '2026-08-10 10:30:00', 'confirmed', 150.00, 0.00, '2026-07-04 14:00:00'),
(5,  1, 1, '2026-08-10 11:00:00', 'confirmed', 150.00, 0.00, '2026-07-05 08:45:00'),
(6,  2, 1, '2026-08-10 11:30:00', 'confirmed', 150.00, 0.00, '2026-07-06 12:30:00'),
(7,  3, 1, '2026-08-10 12:00:00', 'confirmed', 150.00, 0.00, '2026-07-07 15:10:00'),
(8,  4, 1, '2026-08-10 12:30:00', 'confirmed', 150.00, 0.00, '2026-07-08 16:00:00'),
(9,  1, 1, '2026-08-10 13:00:00', 'confirmed', 150.00, 0.00, '2026-07-09 10:00:00'),
(10, 2, 1, '2026-08-10 13:30:00', 'confirmed', 150.00, 0.00, '2026-07-10 09:30:00');

-- Dr. Adjei (Doctor 2) on 2026-08-15: 2 appointments
INSERT INTO appointments (id, patient_id, doctor_id, appointment_datetime, status, amount_paid, refund_amount, booked_on) VALUES
(11, 1, 2, '2026-08-15 10:00:00', 'confirmed', 100.00, 0.00, '2026-07-03 14:15:00'),
(12, 3, 2, '2026-08-15 10:30:00', 'confirmed', 100.00, 0.00, '2026-07-05 16:40:00');
