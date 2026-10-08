# Hospital Appointment Management System

A web-based Hospital Appointment Management System built with Node.js, Express.js, and MySQL.

## Features
- **Role-based Authentication**: Support for Admin and Staff/User roles.
- **Patient Management**: Add, update, view, and search patient records.
- **Doctor Management**: Manage doctor profiles, specializations, schedules, and consultation fees.
- **Appointment Scheduling**: Booking, scheduling conflict validation, updates, and cancellations.

## Technology Stack
- **Backend**: Node.js, Express.js
- **Database**: MySQL (`mysql2` connection pool)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Session Management**: `express-session`

## Project Structure
```text
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   ├── index.html
│   └── dashboard.html
├── hospital_management.sql
├── package.json
├── server.js
├── .env.example
└── .gitignore
```

## Getting Started

### 1. Prerequisites
- Node.js (v16+)
- MySQL Server

### 2. Database Setup
Import the provided SQL schema into your MySQL server:
```bash
mysql -u root -p < hospital_management.sql
```

### 3. Environment Configuration
Copy `.env.example` to create a `.env` file:
```bash
cp .env.example .env
```
Update `.env` with your local database credentials and session secret:
```env
PORT=8080
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=hospital_management
SESSION_SECRET=your_secret_key
```

### 4. Installation & Running
Install dependencies:
```bash
npm install
```

Start the application:
```bash
npm start
```
Visit `http://localhost:8080` in your browser.
