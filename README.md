# Vyapar Pro POS — Cloud Billing & Analytics

A Point of Sale (POS) application designed to support billing workflows and business operations through a modern web interface and a Python backend.

**Built with:** React · FastAPI · Python · PostgreSQL

## Overview

Vyapar Pro POS is a web-based POS project focused on providing a foundation for digital billing and business management. It combines a React frontend, a FastAPI backend, and a PostgreSQL database.

This project is being developed as a hands-on learning and software engineering project, with AI-assisted development, debugging, integration, and testing.

## Features

- **POS Interface:** Web-based user interface for point-of-sale workflows.
- **Backend API:** Python backend built with FastAPI.
- **Database Integration:** PostgreSQL connectivity through SQLAlchemy and Psycopg.
- **Configuration Management:** Environment variables for application settings and secrets.
- **Authentication and Access Control:** Authentication and role-based access features, subject to the current implementation.
- **API Testing:** Automated tests for supported backend functionality.
- **Deployment Preparation:** Configuration for running the frontend and backend as separate services.

> Note: Feature availability depends on the current implementation. Verify each feature in the running application before presenting it as production-ready.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Database Driver | Psycopg |
| Schema Migrations | Alembic, if configured |
| Testing | Pytest |
| Version Control | Git and GitHub |

## Architecture

```text
User
  |
  v
React Frontend
  |
  | HTTP / API Requests
  v
FastAPI Backend
  |
  v
SQLAlchemy
  |
  v
PostgreSQL Database
```

## Project Structure

The project is organized into frontend and backend components.

```text
vyapar-pro-pos/
├── frontend/
│   ├── package.json
│   └── src/
├── backend/
│   ├── app/
│   ├── requirements.txt
│   ├── .env.example
│   └── alembic.ini
├── .gitignore
└── README.md
```

*The directory tree above is illustrative. Update it to match the actual repository structure.*

## Getting Started

### Prerequisites

Install the following tools:

- Python 3.12 or a compatible project-supported version
- Node.js and npm
- PostgreSQL, or access to a hosted PostgreSQL database
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/vyapar-pro-pos.git
cd vyapar-pro-pos
```

Replace `YOUR_USERNAME` with your GitHub username.

### 2. Set Up the Backend

Open a terminal in the project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

If PowerShell blocks virtual environment activation, use the Python executable directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a local `.env` file using the project's example file, if available:

```powershell
Copy-Item .env.example .env
```

Configure the variables according to the actual backend settings:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE
SECRET_KEY=REPLACE_WITH_A_SECURE_RANDOM_SECRET
ADMIN_EMAILS=admin@example.com
FRONTEND_ORIGINS=http://localhost:5173
SESSION_DAYS=1
REMEMBER_SESSION_DAYS=30
COOKIE_SECURE=false
APP_TIMEZONE=Asia/Kolkata
```

Important:

- Replace the example database connection with your own PostgreSQL credentials.
- Generate a unique, strong `SECRET_KEY`.
- URL-encode special characters in database connection URLs when required.
- Keep `.env` out of version control.
- Use secure cookie settings when deploying over HTTPS, according to the application's authentication implementation.

### 4. Initialize the Database

If the project has Alembic migrations configured, run the following from the `backend` directory:

```powershell
$env:PYTHONPATH = (Get-Location).Path
alembic upgrade head
```

If the project provides an admin initialization command, follow its implementation and prompts:

```powershell
python -m app.create_admin
```

Do not assume an administrator password has been created merely because an admin email is configured.

### 5. Start the Backend

From the `backend` directory:

```powershell
$env:PYTHONPATH = (Get-Location).Path
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend URL:

`http://127.0.0.1:8000`

If enabled by the application, interactive API documentation is available at:

`http://127.0.0.1:8000/docs`

### 6. Start the Frontend

Open a second terminal in the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, commonly:

`http://localhost:5173`

Ensure the frontend API configuration points to the local backend and that the backend permits the frontend origin.

## Testing

Run backend tests from the `backend` directory:

```powershell
python -m pytest -q
```

Tests may require a correctly configured test database and environment variables. Review the test configuration before running tests against a database containing important data.

## Deployment

The application can be deployed using separate frontend, backend, and database services.

A possible hosting setup is:

- **Frontend:** Vercel or Render
- **Backend:** Render
- **PostgreSQL:** Neon or another PostgreSQL hosting provider

Before deployment:

1. Push the project to GitHub without secrets or local database files.
2. Create a hosted PostgreSQL database.
3. Configure the backend environment variables in the hosting dashboard.
4. Apply the database migrations.
5. Deploy the FastAPI backend.
6. Configure the frontend API base URL to use the deployed backend.
7. Configure CORS for the deployed frontend origin.
8. Test authentication, database operations, and the main user workflows.

Free hosting plans may have resource limits, inactivity-related delays, and database restrictions. Confirm current provider terms before relying on a free deployment for business use.

## Security

- Never commit `.env` files, passwords, API keys, or production secrets.
- Do not commit customer information, invoices, or database backups.
- Use separate credentials for development and production.
- Rotate credentials that have been exposed.
- Validate authentication, authorization, session handling, and input validation before production use.
- Restrict administrative access and configure CORS for trusted origins only.

## Current Status

This repository represents an actively developed project. Setup instructions, feature descriptions, and deployment configuration should be kept aligned with the current implementation.

## Development Approach

The project has been developed through a combination of independent implementation, AI-assisted coding, debugging, and iterative testing.

The goal is to strengthen practical skills in frontend development, backend APIs, database integration, application configuration, and deployment.

## Future Improvements

Potential improvements, depending on project requirements:

- Improved sales and billing workflows
- Inventory and stock management
- Business analytics and reporting
- Automated test coverage
- Improved error handling and observability
- Production deployment and backup procedures

## License

No license has been specified yet. Unless a license is added, do not assume that others have permission to reuse, modify, or redistribute this code.

---

**Project:** Vyapar Pro POS — Cloud Billing & Analytics  
**Purpose:** POS application development and practical software engineering  
**Repository:** Add your GitHub repository URL here
