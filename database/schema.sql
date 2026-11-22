-- MediBook Clinic Appointment System
-- Database Schema DDL (Part B)
-- Matches schema-diagram.png exactly

CREATE DATABASE IF NOT EXISTS medibook;
USE medibook;

-- Drop child tables first to respect foreign key constraints
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS patients;

-- -------------------------------------------------------------
-- 1. Patients Table
-- -------------------------------------------------------------
CREATE TABLE patients (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 2. Doctors Table
-- -------------------------------------------------------------
CREATE TABLE doctors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    consultation_fee DECIMAL(10, 2) NOT NULL,
    room VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 3. Appointments Table
-- -------------------------------------------------------------
CREATE TABLE appointments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id INT UNSIGNED NOT NULL,
    doctor_id INT UNSIGNED NOT NULL,
    appointment_datetime DATETIME NOT NULL,
    status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
    amount_paid DECIMAL(10, 2) NOT NULL,
    refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    booked_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Key constraints
    CONSTRAINT fk_appointments_patient
        FOREIGN KEY (patient_id) REFERENCES patients(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_appointments_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Business Rule: A doctor cannot have two appointments at the same date/time
    CONSTRAINT unique_doctor_datetime
        UNIQUE (doctor_id, appointment_datetime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
