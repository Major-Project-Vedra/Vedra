# 🎓 Vedra LMS — Complete System

A fully gamified Learning Management System built with **React** (frontend) and **Flask** (backend).

---

## 🏗️ Architecture

```
vedra/
├── backend/     # Flask REST API
└── frontend/    # React App
```

---

## ⚡ Quick Start

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — by default uses SQLite (no config needed for dev)

# Run the server
python run.py
# → API running at http://localhost:5000
```

**Default Admin Account (auto-seeded):**
- Email: `admin@vedra.com`
- Password: `Admin@123`

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# REACT_APP_API_URL=http://localhost:5000 (default)

# Start the dev server
npm start
# → App running at http://localhost:3000
```

---

## 🌟 Features

### Student
- 📚 Browse & enroll in courses
- 📹 Watch video lessons
- ✅ Mark lessons complete
- 🎯 Take quizzes & earn XP
- 🏆 Earn badges & level up
- 📊 Track progress
- 🥇 Compete on leaderboard

### Admin
- ⚙️ Admin dashboard with stats
- 📚 Create/edit/delete courses
- 👥 Manage users (activate/deactivate)
- 📋 View enrollment reports

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login → JWT token |
| GET | `/auth/me` | Current user profile |
| GET | `/courses/` | List courses (with filters) |
| POST | `/courses/` | Create course (admin) |
| PUT | `/courses/:id` | Update course (admin) |
| DELETE | `/courses/:id` | Delete course (admin) |
| POST | `/enroll/` | Enroll in course |
| GET | `/enroll/my` | My enrollments |
| POST | `/enroll/lesson/:id/complete` | Complete lesson + earn XP |
| GET | `/progress/analytics` | User analytics |
| GET | `/progress/leaderboard` | XP leaderboard |
| GET | `/quiz/:id` | Get quiz |
| POST | `/quiz/:id/submit` | Submit quiz answers |
| GET | `/gamify/badges` | All badges |
| GET | `/gamify/my-badges` | User's badges |
| GET | `/admin/dashboard` | Admin stats |
| GET | `/admin/users` | All users |

---

## 🗄️ Database

- **Default (dev):** SQLite (`vedra.db`) — no setup needed
- **Production:** MySQL — set `DATABASE_URL` in `.env`

```
DATABASE_URL=mysql+pymysql://user:password@localhost/vedra_db
```

---

## 🚀 Deployment

### Backend
```bash
gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"
```

### Frontend
```bash
npm run build
# Deploy /build folder to Vercel, Netlify, or any static host
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router, Framer Motion |
| Backend | Flask, Flask-JWT-Extended, SQLAlchemy |
| Database | SQLite (dev) / MySQL (prod) |
| Auth | JWT Tokens |
| Styling | Custom CSS (no frameworks) |

---
REPORT Below⬇️
[Vedra Team-85.docx](https://github.com/user-attachments/files/27490750/Vedra.Team-85.docx)
