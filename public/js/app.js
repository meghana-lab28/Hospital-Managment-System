// Global State Variable for current login session
let currentUserSession = null;

// Track selected rows in JTable equivalents
let selectedPatientId = null;
let selectedDoctorId = null;
let selectedAppointmentId = null;
let selectedAppointmentStatus = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session verification & redirection
    await checkSession();

    // 2. Sidebar Navigation panel switching
    initNavigation();

    // 3. Initialize Modules
    initPatientsModule();
    initDoctorsModule();
    initAppointmentsBookingModule();
    initAppointmentsListModule();
});

// Check Session logic
async function checkSession() {
    try {
        const res = await fetch('/api/session');
        const session = await res.json();
        if (!session.loggedIn) {
            window.location.href = 'index.html';
            return;
        }
        currentUserSession = session;
        
        // Display user details on Sidebar Tagline
        document.getElementById('user-tagline').textContent = `Role: ${session.role} (${session.username})`;

        // Enforce role-based access rules globally
        applyRoleRestrictions(session.role);
    } catch (err) {
        console.error("Session fetch error:", err);
        window.location.href = 'index.html';
    }
}

// Disable/Hide fields based on role privileges
function applyRoleRestrictions(role) {
    if (role !== 'Admin') {
        // Hide Doctors Directory and Book Appointment tabs on sidebar
        const menuDoctors = document.getElementById('menu-doctors');
        if (menuDoctors) menuDoctors.parentElement.style.display = 'none';

        const menuBook = document.getElementById('menu-book-appt');
        if (menuBook) menuBook.parentElement.style.display = 'none';

        // Patient Module locks (Hide delete button)
        const btnDeletePat = document.getElementById('pat-btn-delete');
        if (btnDeletePat) btnDeletePat.style.display = 'none';

        // Appointment list controls (Hide update/cancel buttons for staff)
        const btnUpdateAppt = document.getElementById('btn-appt-update');
        if (btnUpdateAppt) btnUpdateAppt.style.display = 'none';

        const btnCancelAppt = document.getElementById('btn-appt-cancel');
        if (btnCancelAppt) btnCancelAppt.style.display = 'none';
    }
}

// Navigation Sidebar routing
function initNavigation() {
    const navButtons = document.querySelectorAll('.menu-btn');
    const panels = document.querySelectorAll('.panel');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            if (!target) return; // logout button has no data-target

            // Toggle menu buttons active style
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Swap visible content panel
            panels.forEach(p => p.classList.remove('active'));
            const activePanel = document.getElementById(`panel-${target}`);
            if (activePanel) activePanel.classList.add('active');

            // Reload data triggers on tab changes
            if (target === 'patients') {
                loadPatientsTable();
            } else if (target === 'doctors') {
                loadDoctorsTable();
            } else if (target === 'book-appt') {
                loadBookingDropdowns();
            } else if (target === 'appt-records') {
                loadAppointmentsTable();
            }
        });
    });

    // Logout trigger
    const btnLogout = document.getElementById('btn-logout');
    btnLogout.addEventListener('click', async () => {
        const confirm = window.confirm("Are you sure you want to log out of the portal?");
        if (confirm) {
            try {
                const res = await fetch('/api/logout', { method: 'POST' });
                if (res.ok) {
                    window.location.href = 'index.html';
                }
            } catch (err) {
                alert("Database communication error during logout transaction.");
            }
        }
    });
}

// ----------------------------------------------------
// PATIENTS MODULE LOGIC
// ----------------------------------------------------
function initPatientsModule() {
    const form = document.getElementById('form-patient');
    const btnSave = document.getElementById('pat-btn-save');
    const btnUpdate = document.getElementById('pat-btn-update');
    const btnDelete = document.getElementById('pat-btn-delete');
    const btnClear = document.getElementById('pat-btn-clear');
    const btnSearch = document.getElementById('pat-btn-search');
    const btnRefresh = document.getElementById('pat-btn-refresh');
    const searchInput = document.getElementById('pat-search-input');

    loadPatientsTable();

    // Form submit maps to Save patient
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = getPatientFormValues();
        try {
            const res = await fetch('/api/patients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert("Patient details saved successfully!");
                clearPatientForm();
                loadPatientsTable();
            } else {
                alert(data.error || "Failed to save patient.");
            }
        } catch (err) {
            alert("Connection error: could not insert patient.");
        }
    });

    // Update patient details
    btnUpdate.addEventListener('click', async () => {
        if (!selectedPatientId) {
            alert("Please select a patient from the database table to update.");
            return;
        }
        const payload = getPatientFormValues();
        try {
            const res = await fetch(`/api/patients/${selectedPatientId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert("Patient details updated successfully!");
                clearPatientForm();
                loadPatientsTable();
            } else {
                alert(data.error || "Failed to update patient.");
            }
        } catch (err) {
            alert("Connection error: could not update patient.");
        }
    });

    // Delete patient details
    if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
            if (!selectedPatientId) {
                alert("Please select a patient from the database table to delete.");
                return;
            }
            const confirm = window.confirm(`Are you sure you want to delete Patient ID: ${selectedPatientId}?\nThis will remove all associated appointments.`);
            if (confirm) {
                try {
                    const res = await fetch(`/api/patients/${selectedPatientId}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        alert("Patient deleted successfully.");
                        clearPatientForm();
                        loadPatientsTable();
                    } else {
                        alert(data.error || "Failed to delete patient.");
                    }
                } catch (err) {
                    alert("Connection error: could not delete patient.");
                }
            }
        });
    }

    btnClear.addEventListener('click', clearPatientForm);

    // Search patient
    btnSearch.addEventListener('click', () => {
        const query = searchInput.value.trim();
        loadPatientsTable(query);
    });
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadPatientsTable(searchInput.value.trim());
        }
    });

    btnRefresh.addEventListener('click', () => {
        searchInput.value = '';
        loadPatientsTable();
    });
}

async function loadPatientsTable(query = '') {
    const tbody = document.querySelector('#table-patients tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading patients database...</td></tr>';

    try {
        let url = '/api/patients';
        if (query) url += `?query=${encodeURIComponent(query)}`;
        
        const res = await fetch(url);
        const patients = await res.json();

        tbody.innerHTML = '';
        if (patients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No patients found in database.</td></tr>';
            return;
        }

        patients.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align: center; font-weight: bold;">${p.patient_id}</td>
                <td>${escapeHtml(p.name)}</td>
                <td style="text-align: center;">${p.age}</td>
                <td style="text-align: center;">${p.gender}</td>
                <td style="text-align: center;">${p.blood_group}</td>
                <td>${escapeHtml(p.phone)}</td>
                <td>${escapeHtml(p.email)}</td>
            `;

            // Row click listener to auto-populate form
            tr.addEventListener('click', () => {
                document.querySelectorAll('#table-patients tbody tr').forEach(r => r.classList.remove('selected'));
                tr.classList.add('selected');
                populatePatientForm(p);
            });
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error communicating with server.</td></tr>';
    }
}

function getPatientFormValues() {
    return {
        name: document.getElementById('pat-name').value.trim(),
        age: document.getElementById('pat-age').value.trim(),
        gender: document.getElementById('pat-gender').value,
        phone: document.getElementById('pat-phone').value.trim(),
        blood_group: document.getElementById('pat-blood').value,
        email: document.getElementById('pat-email').value.trim(),
        address: document.getElementById('pat-address').value.trim()
    };
}

function populatePatientForm(p) {
    selectedPatientId = p.patient_id;
    document.getElementById('pat-id').value = p.patient_id;
    document.getElementById('pat-name').value = p.name;
    document.getElementById('pat-age').value = p.age;
    document.getElementById('pat-gender').value = p.gender;
    document.getElementById('pat-phone').value = p.phone;
    document.getElementById('pat-blood').value = p.blood_group;
    document.getElementById('pat-email').value = p.email;
    document.getElementById('pat-address').value = p.address;
}

function clearPatientForm() {
    selectedPatientId = null;
    document.getElementById('form-patient').reset();
    document.getElementById('pat-id').value = '';
    document.querySelectorAll('#table-patients tbody tr').forEach(r => r.classList.remove('selected'));
}

// ----------------------------------------------------
// DOCTORS MODULE LOGIC
// ----------------------------------------------------
function initDoctorsModule() {
    const form = document.getElementById('form-doctor');
    const btnSave = document.getElementById('doc-btn-save');
    const btnUpdate = document.getElementById('doc-btn-update');
    const btnDelete = document.getElementById('doc-btn-delete');
    const btnClear = document.getElementById('doc-btn-clear');

    loadDoctorsTable();

    // Save doctor
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = getDoctorFormValues();
        try {
            const res = await fetch('/api/doctors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert("Doctor details saved successfully!");
                clearDoctorForm();
                loadDoctorsTable();
            } else {
                alert(data.error || "Failed to save doctor.");
            }
        } catch (err) {
            alert("Connection error: could not insert doctor.");
        }
    });

    // Update doctor
    btnUpdate.addEventListener('click', async () => {
        if (!selectedDoctorId) {
            alert("Please select a doctor from the roster list to update.");
            return;
        }
        const payload = getDoctorFormValues();
        try {
            const res = await fetch(`/api/doctors/${selectedDoctorId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert("Doctor details updated successfully!");
                clearDoctorForm();
                loadDoctorsTable();
            } else {
                alert(data.error || "Failed to update doctor.");
            }
        } catch (err) {
            alert("Connection error: could not update doctor.");
        }
    });

    // Delete doctor
    btnDelete.addEventListener('click', async () => {
        if (!selectedDoctorId) {
            alert("Please select a doctor from the roster list to delete.");
            return;
        }
        const confirm = window.confirm(`Are you sure you want to delete Doctor ID: ${selectedDoctorId}?\nThis will remove all associated appointments.`);
        if (confirm) {
            try {
                const res = await fetch(`/api/doctors/${selectedDoctorId}`, { method: 'DELETE' });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert("Doctor roster record deleted successfully.");
                    clearDoctorForm();
                    loadDoctorsTable();
                } else {
                    alert(data.error || "Failed to delete doctor.");
                }
            } catch (err) {
                alert("Connection error: could not delete doctor.");
            }
        }
    });

    btnClear.addEventListener('click', clearDoctorForm);
}

async function loadDoctorsTable() {
    const tbody = document.querySelector('#table-doctors tbody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading doctors list...</td></tr>';

    try {
        const res = await fetch('/api/doctors');
        const doctors = await res.json();

        tbody.innerHTML = '';
        if (doctors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No doctors found in database.</td></tr>';
            return;
        }

        doctors.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align: center; font-weight: bold;">${d.doctor_id}</td>
                <td>${escapeHtml(d.name)}</td>
                <td>${escapeHtml(d.specialization)}</td>
                <td style="text-align: center;">${d.experience} Years</td>
                <td>${escapeHtml(d.available_time)}</td>
                <td style="text-align: center; font-weight: 600;">$${parseFloat(d.consultation_fee).toFixed(2)}</td>
            `;

            // Row click listener (Only populate form if user is Admin)
            tr.addEventListener('click', () => {
                if (currentUserSession && currentUserSession.role === 'Admin') {
                    document.querySelectorAll('#table-doctors tbody tr').forEach(r => r.classList.remove('selected'));
                    tr.classList.add('selected');
                    populateDoctorForm(d);
                }
            });
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error communicating with server.</td></tr>';
    }
}

function getDoctorFormValues() {
    return {
        name: document.getElementById('doc-name').value.trim(),
        specialization: document.getElementById('doc-spec').value.trim(),
        experience: document.getElementById('doc-exp').value.trim(),
        available_time: document.getElementById('doc-time').value.trim(),
        consultation_fee: document.getElementById('doc-fee').value.trim()
    };
}

function populateDoctorForm(d) {
    selectedDoctorId = d.doctor_id;
    document.getElementById('doc-id').value = d.doctor_id;
    document.getElementById('doc-name').value = d.name;
    document.getElementById('doc-spec').value = d.specialization;
    document.getElementById('doc-exp').value = d.experience;
    document.getElementById('doc-fee').value = d.consultation_fee;
    document.getElementById('doc-time').value = d.available_time;
}

function clearDoctorForm() {
    selectedDoctorId = null;
    document.getElementById('form-doctor').reset();
    document.getElementById('doc-id').value = '';
    document.querySelectorAll('#table-doctors tbody tr').forEach(r => r.classList.remove('selected'));
}

// ----------------------------------------------------
// APPOINTMENTS BOOKING MODULE
// ----------------------------------------------------
function initAppointmentsBookingModule() {
    const form = document.getElementById('form-book-appt');
    const btnClear = document.getElementById('appt-btn-clear');

    loadBookingDropdowns();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            patient_id: document.getElementById('appt-patient').value,
            doctor_id: document.getElementById('appt-doctor').value,
            appointment_date: document.getElementById('appt-date').value,
            appointment_time: document.getElementById('appt-time').value,
            reason: document.getElementById('appt-reason').value.trim()
        };

        try {
            const res = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert("Appointment successfully booked!");
                form.reset();
                // Set date to today
                setDefaultBookingDate();
            } else {
                alert(data.error || "Failed to book appointment.");
            }
        } catch (err) {
            alert("Connection error: could not book appointment.");
        }
    });

    btnClear.addEventListener('click', () => {
        form.reset();
        setDefaultBookingDate();
    });
}

async function loadBookingDropdowns() {
    const patSelect = document.getElementById('appt-patient');
    const docSelect = document.getElementById('appt-doctor');

    patSelect.innerHTML = '<option value="">-- Choose Patient --</option>';
    docSelect.innerHTML = '<option value="">-- Choose Doctor --</option>';

    try {
        // Load Patients
        const patRes = await fetch('/api/patients');
        const patients = await patRes.json();
        patients.forEach(p => {
            patSelect.innerHTML += `<option value="${p.patient_id}">${escapeHtml(p.name)} (ID: ${p.patient_id})</option>`;
        });

        // Load Doctors
        const docRes = await fetch('/api/doctors');
        const doctors = await docRes.json();
        doctors.forEach(d => {
            docSelect.innerHTML += `<option value="${d.doctor_id}">${escapeHtml(d.name)} (${escapeHtml(d.specialization)} - ID: ${d.doctor_id})</option>`;
        });

        setDefaultBookingDate();
    } catch (err) {
        console.error("Failed to populate dropdown options", err);
    }
}

function setDefaultBookingDate() {
    const dateInput = document.getElementById('appt-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().substring(0, 10);
    }
    const timeInput = document.getElementById('appt-time');
    if (timeInput) {
        timeInput.value = "10:00";
    }
}

// ----------------------------------------------------
// APPOINTMENT RECORDS LIST MODULE
// ----------------------------------------------------
function initAppointmentsListModule() {
    const btnSearch = document.getElementById('filter-btn-search');
    const btnReset = document.getElementById('filter-btn-reset');
    const btnUpdate = document.getElementById('btn-appt-update');
    const btnCancel = document.getElementById('btn-appt-cancel');

    // Modal Components
    const modal = document.getElementById('modal-edit-appt');
    const formEdit = document.getElementById('form-edit-appt');
    const btnDiscardModal = document.getElementById('btn-close-modal');

    loadAppointmentsTable();

    // Table Filter Search
    btnSearch.addEventListener('click', () => {
        const patient = document.getElementById('filter-patient').value.trim();
        const doctor = document.getElementById('filter-doctor').value.trim();
        const date = document.getElementById('filter-date').value;
        loadAppointmentsTable(patient, doctor, date);
    });

    btnReset.addEventListener('click', () => {
        document.getElementById('filter-patient').value = '';
        document.getElementById('filter-doctor').value = '';
        document.getElementById('filter-date').value = '';
        loadAppointmentsTable();
    });

    // Cancel Selected Appointment
    btnCancel.addEventListener('click', async () => {
        if (!selectedAppointmentId) {
            alert("Please select an appointment from the table to cancel.");
            return;
        }
        if (selectedAppointmentStatus === 'Cancelled') {
            alert("This appointment is already cancelled.");
            return;
        }

        const confirm = window.confirm(`Are you sure you want to cancel appointment #${selectedAppointmentId}?`);
        if (confirm) {
            try {
                const res = await fetch(`/api/appointments/${selectedAppointmentId}/cancel`, { method: 'PUT' });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert("Appointment successfully cancelled.");
                    loadAppointmentsTable();
                    selectedAppointmentId = null;
                    selectedAppointmentStatus = null;
                } else {
                    alert(data.error || "Failed to cancel appointment.");
                }
            } catch (err) {
                alert("Connection error: could not cancel appointment.");
            }
        }
    });

    // Open Update Dialog Modal
    btnUpdate.addEventListener('click', async () => {
        if (!selectedAppointmentId) {
            alert("Please select an appointment from the table to update.");
            return;
        }
        if (selectedAppointmentStatus === 'Cancelled') {
            alert("Cancelled appointments cannot be edited.");
            return;
        }

        // Open Dialog & prefill it
        try {
            // Load doctors edit list
            const docSelect = document.getElementById('edit-appt-doctor');
            docSelect.innerHTML = '';
            const docRes = await fetch('/api/doctors');
            const doctors = await docRes.json();
            doctors.forEach(d => {
                docSelect.innerHTML += `<option value="${d.doctor_id}">${escapeHtml(d.name)} (${escapeHtml(d.specialization)} - ID: ${d.doctor_id})</option>`;
            });

            // Prefill with selection info
            const tr = document.querySelector(`#table-appointments tbody tr[data-id="${selectedAppointmentId}"]`);
            if (tr) {
                document.getElementById('modal-title').textContent = `Modify Appointment #${selectedAppointmentId}`;
                document.getElementById('edit-appt-id').value = selectedAppointmentId;
                
                // Read from data attributes
                document.getElementById('edit-appt-date').value = tr.getAttribute('data-date');
                document.getElementById('edit-appt-time').value = tr.getAttribute('data-time');
                document.getElementById('edit-appt-reason').value = tr.getAttribute('data-reason');
                
                const doctorId = tr.getAttribute('data-doctor-id');
                docSelect.value = doctorId;
            }

            modal.classList.add('active');
        } catch (err) {
            alert("Failed to build edit details popup modal.");
        }
    });

    // Discard Modal
    btnDiscardModal.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Save Changes in Modal
    formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('edit-appt-id').value;
        const payload = {
            doctor_id: document.getElementById('edit-appt-doctor').value,
            appointment_date: document.getElementById('edit-appt-date').value,
            appointment_time: document.getElementById('edit-appt-time').value,
            reason: document.getElementById('edit-appt-reason').value.trim()
        };

        try {
            const res = await fetch(`/api/appointments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert("Appointment details updated successfully!");
                modal.classList.remove('active');
                loadAppointmentsTable();
                selectedAppointmentId = null;
                selectedAppointmentStatus = null;
            } else {
                alert(data.error || "Failed to update appointment.");
            }
        } catch (err) {
            alert("Connection error: could not update appointment details.");
        }
    });
}

async function loadAppointmentsTable(patient = '', doctor = '', date = '') {
    const tbody = document.querySelector('#table-appointments tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading appointments records...</td></tr>';

    try {
        let url = '/api/appointments';
        const params = [];
        if (patient) params.push(`patient=${encodeURIComponent(patient)}`);
        if (doctor) params.push(`doctor=${encodeURIComponent(doctor)}`);
        if (date) params.push(`date=${encodeURIComponent(date)}`);

        if (params.length > 0) {
            url += '?' + params.join('&');
        }

        const res = await fetch(url);
        const appts = await res.json();

        tbody.innerHTML = '';
        if (appts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No appointment matches found.</td></tr>';
            return;
        }

        appts.forEach(a => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', a.appointment_id);
            tr.setAttribute('data-doctor-id', a.doctor_id);
            tr.setAttribute('data-date', a.appointment_date.substring(0, 10));
            tr.setAttribute('data-time', a.appointment_time.substring(0, 5));
            tr.setAttribute('data-reason', a.reason);

            const badgeClass = a.status === 'Booked' ? 'badge-success' : 'badge-danger';
            
            tr.innerHTML = `
                <td style="text-align: center; font-weight: bold;">${a.appointment_id}</td>
                <td>${escapeHtml(a.patient_name)}</td>
                <td>${escapeHtml(a.doctor_name)}</td>
                <td style="text-align: center;">${a.appointment_date.substring(0, 10)}</td>
                <td style="text-align: center;">${a.appointment_time.substring(0, 5)}</td>
                <td>${escapeHtml(a.reason)}</td>
                <td style="text-align: center;"><span class="badge ${badgeClass}">${a.status}</span></td>
            `;

            // Row select action
            tr.addEventListener('click', () => {
                document.querySelectorAll('#table-appointments tbody tr').forEach(r => r.classList.remove('selected'));
                tr.classList.add('selected');
                selectedAppointmentId = a.appointment_id;
                selectedAppointmentStatus = a.status;
            });

            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error communicating with server.</td></tr>';
    }
}

// ----------------------------------------------------
// SANITIZATION UTILITIES
// ----------------------------------------------------
function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
