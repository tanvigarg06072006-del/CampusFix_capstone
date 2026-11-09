# CampusFix – Campus Complaint Management System

CampusFix is a web-based platform that allows students to report campus-related problems and track their progress. It helps college administrators manage, assign, and resolve complaints efficiently.

## Features

- Student registration and login.
- Secure Firebase authentication.
- Submit and track campus complaints.
- Categorize complaints by type and priority.
- Admin and staff complaint management.
- Assign complaints to departments or staff.
- Update complaint statuses.
- Store user and complaint data in Supabase.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | React.js, JavaScript, CSS |
| Backend | Node.js, Express.js |
| Database | Supabase PostgreSQL |
| Authentication | Firebase Authentication |
| Version Control | Git and GitHub |

## Project Structure

```text
CampusFix/
├── frontend/
├── backend/
│   ├── middleware/
│   ├── routes/
│   ├── firebaseAdmin.js
│   ├── supabase.js
│   ├── server.js
│   └── syncFirebaseUsers.js
├── README.md
└── .gitignore
```

## Installation

**1. Clone the repository**

```bash
git clone https://github.com/tanvigarg06072006-del/CampusFix-Capstone_project.git
cd CampusFix-Capstone_project
```

**2. Install dependencies**

Frontend:

```bash
cd frontend
npm install
```

Backend (in a separate terminal):

```bash
cd backend
npm install
```

**3. Configure environment variables**

Create `backend/.env`:

```env
PORT=5000
DATABASE_URL=your_supabase_connection_string
JWT_SECRET=your_jwt_secret
```

Configure Firebase credentials and frontend Firebase settings separately.

## Running the Project

**Start the backend:**

```bash
cd backend
npm start
```

**Start the frontend:**

```bash
cd frontend
npm run dev
```

**Start Firebase user synchronization:**

```bash
cd backend
node syncFirebaseUsers.js
```

The synchronization script checks Firebase users every 60 seconds while running.

## Complaint Statuses

- PENDING
- REVIEWED
- ASSIGNED
- IN_PROGRESS
- RESOLVED
- CONFIRMED
- REJECTED

## API Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/register` | POST | User registration |
| `/api/auth/login` | POST | User login |
| `/api/auth/me` | GET | Get user details |
| `/api/issues` | GET | View complaints |
| `/api/issues` | POST | Submit complaint |
| `/api/issues/:id` | GET | View complaint details |
| `/api/issues/:id/status` | PATCH | Update status |
| `/api/issues/:id/assign` | PATCH | Assign complaint |

## Security

- Firebase-based authentication.
- Protected backend routes.
- Role-based authorization.
- Environment variables for sensitive credentials.
- Parameterized SQL queries.

**Note:** Never commit `.env` files or Firebase service account credentials.

## Contributors

Developed as a Capstone Project.

---

**CampusFix – Making Campus Problem Reporting Easier!**
