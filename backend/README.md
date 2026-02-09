# Credit Card Tracker Backend

A FastAPI-based backend application for tracking credit card benefits, point multipliers, and maximizing credit card value.

## Features

- 🎯 Track multiple credit cards and their benefits
- 📊 Monitor point multipliers and spending categories
- 🔔 Automated notifications for benefit usage and renewals
- 🤖 AI-powered card recommendations using Google Gemini
- 📧 Email notifications via SendGrid
- 📅 Scheduled tasks for benefit tracking and notifications

## Tech Stack

- **FastAPI** - Modern web framework
- **PostgreSQL** - Database
- **SQLAlchemy** - ORM
- **APScheduler** - Background task scheduling
- **SendGrid** - Email notifications
- **Google Gemini** - AI recommendations
- **Uvicorn** - ASGI server

## Prerequisites

- Python 3.8+
- PostgreSQL database
- SendGrid API key (for email notifications)
- Google Gemini API key (for AI features)

## Installation

### 1. Clone the repository and navigate to the backend directory

```bash
cd backend
```

### 2. Create a virtual environment

```bash
python -m venv venv
```

### 3. Activate the virtual environment

**macOS/Linux:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Set up PostgreSQL database

Create a PostgreSQL database:

```bash
# Connect to PostgreSQL
psql postgres

# Create the database
CREATE DATABASE credit_cards;

# Exit psql
\q
```

### 6. Configure environment variables

Create a `.env` file in the backend directory with the following variables:

```env
# Database
DATABASE_URL=postgresql+psycopg://your_username@localhost:5432/credit_cards

# SendGrid Email
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=your_email@example.com
FROM_NAME=Your Name

# Notification Settings
NOTIFICATION_TIMEZONE=America/Los_Angeles
NOTIFICATION_HOUR=9

# AI (Gemini)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash

# Date Simulation (optional - comment out to use real date)
# SIMULATED_DATE=2026-03-15
```

**Note:** Replace the placeholder values with your actual credentials.

### 7. Seed the database (optional)

Load initial data from JSON files:

```bash
python seed.py
```

This will populate the database with:
- Credit card templates (Amex Gold, Amex Platinum, Bilt Palladium, etc.)
- Owner data
- Benefits and point multipliers

## Running the Application

### Development Mode

Start the FastAPI development server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API Base**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

### Production Mode

For production, run without the `--reload` flag:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

Once running, visit http://localhost:8000/docs to see all available endpoints including:

- **Owners** - Manage card owners
- **Cards** - CRUD operations for credit cards
- **Benefits** - Track and manage card benefits
- **Multipliers** - Point multiplier management
- **Dashboard** - Analytics and insights
- **Notifications** - Notification preferences and history
- **AI** - AI-powered recommendations

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app initialization
│   ├── database.py          # Database configuration
│   ├── utils.py             # Utility functions
│   ├── models/              # SQLAlchemy models
│   ├── routers/             # API route handlers
│   ├── schemas/             # Pydantic schemas
│   ├── services/            # Business logic services
│   └── workers/             # Background schedulers
├── data/                    # Seed data (JSON files)
├── requirements.txt         # Python dependencies
├── seed.py                  # Database seeding script
└── .env                     # Environment variables
```

## Background Services

The application includes an APScheduler that runs:
- **Daily benefit checks** - Monitors benefit usage and renewals
- **Email notifications** - Sends scheduled reminders

The scheduler starts automatically with the application and runs tasks based on the configured timezone and hour.

## Testing

Run the test suite:

```bash
python test_march_simulation.py
```

## Database Migrations

If you need to make database schema changes, use Alembic:

```bash
# Create a new migration
alembic revision --autogenerate -m "description of changes"

# Apply migrations
alembic upgrade head
```

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:
1. Ensure PostgreSQL is running: `pg_isready`
2. Verify your DATABASE_URL in `.env` matches your PostgreSQL credentials
3. Check that the database exists: `psql -l`

### Import Errors

If you get import errors:
1. Make sure you're in the backend directory
2. Ensure your virtual environment is activated
3. Reinstall dependencies: `pip install -r requirements.txt`

### Port Already in Use

If port 8000 is already in use, specify a different port:
```bash
uvicorn app.main:app --reload --port 8001
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| SENDGRID_API_KEY | SendGrid API key for emails | Yes (for notifications) |
| FROM_EMAIL | Email sender address | Yes (for notifications) |
| FROM_NAME | Email sender name | Yes (for notifications) |
| NOTIFICATION_TIMEZONE | Timezone for scheduled tasks | No (default: UTC) |
| NOTIFICATION_HOUR | Hour to send daily notifications | No (default: 9) |
| GEMINI_API_KEY | Google Gemini API key | Yes (for AI features) |
| GEMINI_MODEL | Gemini model name | No (default: gemini-2.0-flash) |
| SIMULATED_DATE | Override current date for testing | No |

## License

[Add your license here]

## Support

For issues or questions, please [open an issue](link-to-issues) or contact the development team.
