-- Create Database
CREATE DATABASE IF NOT EXISTS hospital_management;
USE hospital_management;

-- Table: users
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    username VARCHAR(50) NOT NULL PRIMARY KEY,
    password VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'User'
);

-- Table: patients
CREATE TABLE patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    gender VARCHAR(10) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(100) NOT NULL,
    address TEXT,
    blood_group VARCHAR(10) NOT NULL
);

-- Table: doctors
CREATE TABLE doctors (
    doctor_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    experience INT NOT NULL,
    available_time VARCHAR(50) NOT NULL,
    consultation_fee DECIMAL(10,2) NOT NULL
);

-- Table: appointments
CREATE TABLE appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    doctor_id INT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY(doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE
);

-- Seed Data

-- Insert admin and staff users
INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'Admin');
INSERT INTO users (username, password, role) VALUES ('staff', 'staff123', 'User');

-- Insert sample patients
INSERT INTO patients (name, age, gender, phone, email, address, blood_group) VALUES
('John Doe', 35, 'Male', '9876543210', 'john.doe@email.com', '123 Main St, New York', 'O+'),
('Jane Smith', 28, 'Female', '8765432109', 'jane.smith@email.com', '456 Elm St, Los Angeles', 'A-'),
('Robert Johnson', 45, 'Male', '7654321098', 'robert.j@email.com', '789 Oak Rd, Chicago', 'B+');

-- Insert sample doctors
INSERT INTO doctors (name, specialization, experience, available_time, consultation_fee) VALUES
('Dr. Alice Cooper', 'Cardiology', 12, '09:00 AM - 01:00 PM', 150.00),
('Dr. Bob Marley', 'Dermatology', 8, '02:00 PM - 06:00 PM', 100.00),
('Dr. Charlie Brown', 'Pediatrics', 15, '10:00 AM - 04:00 PM', 120.00),
('Dr. Diana Prince', 'Neurology', 10, '01:00 PM - 05:00 PM', 200.00);

-- Insert sample appointments
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES
(1, 1, '2026-08-10', '09:30:00', 'Routine heart checkup', 'Booked'),
(2, 2, '2026-08-11', '14:30:00', 'Skin allergy consultation', 'Booked'),
(3, 3, '2026-08-12', '11:00:00', 'Child wellness visit', 'Cancelled');
