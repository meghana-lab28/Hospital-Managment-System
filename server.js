require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// MySQL Database Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'root',
    database: process.env.DB_NAME || 'hospital_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'careplus_default_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2 hours session duration
}));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Helper to check if a date is in the past
function isDateInPast(dateStr) {
    const inputDate = new Date(dateStr);
    inputDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inputDate < today;
}

// ----------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ----------------------------------------------------

// POST login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }

    try {
        const [rows] = await pool.execute(
            'SELECT username, role FROM users WHERE username = ? AND password = ?',
            [username, password]
        );

        if (rows.length > 0) {
            // Set session context
            req.session.username = rows[0].username;
            req.session.role = rows[0].role;
            return res.json({ success: true, username: rows[0].username, role: rows[0].role });
        } else {
            return res.status(401).json({ error: "Invalid username or password credentials." });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error during login transaction." });
    }
});

// POST logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Failed to log out session." });
        }
        res.json({ success: true });
    });
});

// GET current session info
app.get('/api/session', (req, res) => {
    if (req.session.username) {
        res.json({ loggedIn: true, username: req.session.username, role: req.session.role });
    } else {
        res.json({ loggedIn: false });
    }
});

// Session Gate Middleware for Protected APIs
const authenticate = (req, res, next) => {
    if (!req.session.username) {
        return res.status(401).json({ error: "Unauthorized access. Please log in first." });
    }
    next();
};

// Admin Gate Middleware for Administrative Actions
const requireAdmin = (req, res, next) => {
    if (req.session.role !== 'Admin') {
        return res.status(403).json({ error: "Access Denied: This operation is restricted to Administrators." });
    }
    next();
};

// ----------------------------------------------------
// PATIENT APIS (CRUD)
// ----------------------------------------------------

// GET all/search patients
app.get('/api/patients', authenticate, async (req, res) => {
    const { query } = req.query;
    try {
        if (query) {
            // Search by ID or Phone number
            let idVal = -1;
            if (/^\d+$/.test(query)) {
                idVal = parseInt(query);
            }
            const [rows] = await pool.execute(
                'SELECT * FROM patients WHERE patient_id = ? OR phone LIKE ? ORDER BY name ASC',
                [idVal, `%${query}%`]
            );
            res.json(rows);
        } else {
            const [rows] = await pool.execute('SELECT * FROM patients ORDER BY name ASC');
            res.json(rows);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch patients list." });
    }
});

// POST save patient
app.post('/api/patients', authenticate, async (req, res) => {
    const { name, age, gender, phone, email, address, blood_group } = req.body;
    
    // Validations
    if (!name || !age || !gender || !phone || !email || !address || !blood_group) {
        return res.status(400).json({ error: "All fields are mandatory." });
    }
    if (parseInt(age) <= 0) {
        return res.status(400).json({ error: "Patient age must be greater than 0." });
    }
    if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({ error: "Phone number must contain exactly 10 digits." });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: "Please provide a valid email address." });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO patients (name, age, gender, phone, email, address, blood_group) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, parseInt(age), gender, phone, email, address, blood_group]
        );
        res.json({ success: true, patientId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save patient record in database." });
    }
});

// PUT update patient
app.put('/api/patients/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { name, age, gender, phone, email, address, blood_group } = req.body;

    // Validations
    if (!name || !age || !gender || !phone || !email || !address || !blood_group) {
        return res.status(400).json({ error: "All fields are mandatory." });
    }
    if (parseInt(age) <= 0) {
        return res.status(400).json({ error: "Patient age must be greater than 0." });
    }
    if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({ error: "Phone number must contain exactly 10 digits." });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: "Please provide a valid email address." });
    }

    try {
        const [result] = await pool.execute(
            'UPDATE patients SET name=?, age=?, gender=?, phone=?, email=?, address=?, blood_group=? WHERE patient_id=?',
            [name, parseInt(age), gender, phone, email, address, blood_group, id]
        );
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Patient record not found." });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update patient record." });
    }
});

// DELETE patient
app.delete('/api/patients/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.execute('DELETE FROM patients WHERE patient_id = ?', [id]);
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Patient record not found." });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete patient record." });
    }
});

// ----------------------------------------------------
// DOCTOR APIS (CRUD)
// ----------------------------------------------------

// GET all doctors
app.get('/api/doctors', authenticate, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM doctors ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch doctors list." });
    }
});

// POST save doctor
app.post('/api/doctors', authenticate, requireAdmin, async (req, res) => {
    const { name, specialization, experience, available_time, consultation_fee } = req.body;

    if (!name || !specialization || experience === undefined || !available_time || consultation_fee === undefined) {
        return res.status(400).json({ error: "All fields are mandatory." });
    }
    if (parseInt(experience) < 0) {
        return res.status(400).json({ error: "Experience must be a non-negative integer." });
    }
    if (parseFloat(consultation_fee) < 0) {
        return res.status(400).json({ error: "Consultation fee must be a positive value." });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO doctors (name, specialization, experience, available_time, consultation_fee) VALUES (?, ?, ?, ?, ?)',
            [name, specialization, parseInt(experience), available_time, parseFloat(consultation_fee)]
        );
        res.json({ success: true, doctorId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save doctor record." });
    }
});

// PUT update doctor
app.put('/api/doctors/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, specialization, experience, available_time, consultation_fee } = req.body;

    if (!name || !specialization || experience === undefined || !available_time || consultation_fee === undefined) {
        return res.status(400).json({ error: "All fields are mandatory." });
    }
    if (parseInt(experience) < 0) {
        return res.status(400).json({ error: "Experience must be a non-negative integer." });
    }
    if (parseFloat(consultation_fee) < 0) {
        return res.status(400).json({ error: "Consultation fee must be a positive value." });
    }

    try {
        const [result] = await pool.execute(
            'UPDATE doctors SET name=?, specialization=?, experience=?, available_time=?, consultation_fee=? WHERE doctor_id=?',
            [name, specialization, parseInt(experience), available_time, parseFloat(consultation_fee), id]
        );
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Doctor record not found." });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update doctor record." });
    }
});

// DELETE doctor
app.delete('/api/doctors/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.execute('DELETE FROM doctors WHERE doctor_id = ?', [id]);
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Doctor record not found." });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete doctor record." });
    }
});

// ----------------------------------------------------
// APPOINTMENT APIS (CRUD & VALIDATION)
// ----------------------------------------------------

// GET all/filtered appointments
app.get('/api/appointments', authenticate, async (req, res) => {
    const { patient, doctor, date } = req.query;

    let sql = `
        SELECT a.*, p.name AS patient_name, d.name AS doctor_name 
        FROM appointments a
        JOIN patients p ON a.patient_id = p.patient_id
        JOIN doctors d ON a.doctor_id = d.doctor_id
        WHERE 1=1
    `;
    const params = [];

    if (patient) {
        sql += ' AND p.name LIKE ?';
        params.push(`%${patient}%`);
    }
    if (doctor) {
        sql += ' AND d.name LIKE ?';
        params.push(`%${doctor}%`);
    }
    if (date) {
        sql += ' AND a.appointment_date = ?';
        params.push(date);
    }
    sql += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

    try {
        const [rows] = await pool.execute(sql, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch appointments list." });
    }
});

// POST book appointment
app.post('/api/appointments', authenticate, requireAdmin, async (req, res) => {
    const { patient_id, doctor_id, appointment_date, appointment_time, reason } = req.body;

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time || !reason) {
        return res.status(400).json({ error: "All fields are required to book an appointment." });
    }

    // 1. Business Validation: Date in past check
    if (isDateInPast(appointment_date)) {
        return res.status(400).json({ error: "Appointment date cannot be in the past." });
    }

    try {
        // 2. Business Validation: Doctor calendar conflict check
        const [conflictRows] = await pool.execute(
            'SELECT COUNT(*) AS count FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status <> "Cancelled"',
            [doctor_id, appointment_date, appointment_time]
        );
        if (conflictRows[0].count > 0) {
            return res.status(400).json({ error: "The selected doctor is already booked at this date and time." });
        }

        // 3. Business Validation: Duplicate booking check
        const [dupRows] = await pool.execute(
            'SELECT COUNT(*) AS count FROM appointments WHERE patient_id = ? AND doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status <> "Cancelled"',
            [patient_id, doctor_id, appointment_date, appointment_time]
        );
        if (dupRows[0].count > 0) {
            return res.status(400).json({ error: "This patient already has an active appointment with this doctor at this date and time." });
        }

        // Save appointment
        const [result] = await pool.execute(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, "Booked")',
            [patient_id, doctor_id, appointment_date, appointment_time, reason]
        );
        res.json({ success: true, appointmentId: result.insertId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to book appointment." });
    }
});

// PUT update appointment
app.put('/api/appointments/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { doctor_id, appointment_date, appointment_time, reason } = req.body;

    if (!doctor_id || !appointment_date || !appointment_time || !reason) {
        return res.status(400).json({ error: "All fields are required to update appointment details." });
    }

    // 1. Date check
    if (isDateInPast(appointment_date)) {
        return res.status(400).json({ error: "Appointment date cannot be in the past." });
    }

    try {
        // Fetch patient_id for conflict duplicate checks
        const [appRow] = await pool.execute('SELECT patient_id FROM appointments WHERE appointment_id = ?', [id]);
        if (appRow.length === 0) {
            return res.status(404).json({ error: "Appointment not found." });
        }
        const patient_id = appRow[0].patient_id;

        // 2. Doctor conflict check (excluding current appointment ID)
        const [conflictRows] = await pool.execute(
            'SELECT COUNT(*) AS count FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status <> "Cancelled" AND appointment_id <> ?',
            [doctor_id, appointment_date, appointment_time, id]
        );
        if (conflictRows[0].count > 0) {
            return res.status(400).json({ error: "The selected doctor is already booked at this date and time." });
        }

        // 3. Duplicate check (excluding current appointment ID)
        const [dupRows] = await pool.execute(
            'SELECT COUNT(*) AS count FROM appointments WHERE patient_id = ? AND doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status <> "Cancelled" AND appointment_id <> ?',
            [patient_id, doctor_id, appointment_date, appointment_time, id]
        );
        if (dupRows[0].count > 0) {
            return res.status(400).json({ error: "This patient already has an active appointment with this doctor at this date and time." });
        }

        // Update appointment details
        await pool.execute(
            'UPDATE appointments SET doctor_id = ?, appointment_date = ?, appointment_time = ?, reason = ? WHERE appointment_id = ?',
            [doctor_id, appointment_date, appointment_time, reason, id]
        );
        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update appointment record." });
    }
});

// PUT cancel appointment (Sets status to Cancelled)
app.put('/api/appointments/:id/cancel', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.execute(
            'UPDATE appointments SET status = "Cancelled" WHERE appointment_id = ?',
            [id]
        );
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Appointment not found." });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to cancel appointment." });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running locally at http://localhost:${PORT}`);
});
