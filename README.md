# Michael - SQL Teaching Assistant

An AI-powered SQL teaching assistant platform designed to help students master database queries through interactive learning, personalized homework assignments, and intelligent AI analysis.

## Project Overview

Michael is a comprehensive web-based learning platform that provides:

- **Interactive SQL Chat Assistant**: Real-time AI-powered chat interface that helps students learn SQL through conversation and guided assistance
- **Homework Management System**: Create, assign, and grade SQL homework assignments with automatic grading capabilities
- **Student Profiling & Analytics**: Track student progress, analyze learning patterns, and identify areas for improvement using AI-powered analysis
- **Admin Dashboard**: Comprehensive administrative interface for managing students, homework, datasets, and system analytics
- **AI-Powered Learning Insights**: Automatic analysis of student behavior, performance trends, and knowledge gaps using OpenAI's GPT models
- **Practice Mode**: Interactive SQL practice sessions with immediate feedback
- **Voice Interface**: Voice-enabled interactions for enhanced accessibility

### Technology Stack

- **Framework**: Next.js 14 (React 18)
- **Language**: TypeScript
- **Database**: MongoDB
- **AI Integration**: OpenAI API (GPT-4)
- **SQL Execution**: sql.js
- **UI Libraries**: Styled Components, React Three Fiber (3D avatars), Monaco Editor (code editor)
- **Testing**: Jest, Playwright, React Testing Library

## Installation Guide

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm** or **yarn**: Package manager
- **MongoDB**: Access to a MongoDB instance (local or cloud)
- **OpenAI API Key**: For AI assistant functionality

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd sql-chatbot
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Configuration

Create a `.env.local` file in the project root directory:

```bash
cp .env.example .env.local
```

Configure the following environment variables in `.env.local`:

```bash
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_MODE=responses
OPENAI_MODEL=gpt-4.1-mini
OPENAI_VECTOR_STORE_ID=
OPENAI_ASSISTANT_ID_GPT5=
USE_GPT5_ASSISTANT=false

# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor
# OR use individual credentials:
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password
DB_NAME=your_database_name

# Feature Flags (optional)
FEATURE_VOICE=1
```

**Important**: 
- Replace all placeholder values with your actual credentials
- Never commit `.env.local` to version control
- The `.env.local` file is already included in `.gitignore`

### Step 4: Database Setup

If you're setting up a new database instance, run the database setup script:

```bash
npm run setup-database
```

This script will:
- Create necessary database collections
- Set up indexes for optimal performance
- Validate the database connection

### Step 5: Run the Development Server

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Step 6: Verify Installation

1. Open your browser and navigate to `http://localhost:3000`
2. You should see the login page
3. If everything is configured correctly, you should be able to access the application

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:e2e` - Run Playwright end-to-end tests
- `npm run test:component` - Run component tests
- `npm run test:api` - Run API tests
- `npm run setup-database` - Set up database collections and indexes
- `npm run verify-deployment` - Verify deployment configuration
- `npm run cleanup-tokens` - Clean up expired tokens
- `npm run maintenance` - Run maintenance tasks

## Project Structure

```
sql-chatbot/
├── app/                    # Next.js app directory (pages, components, API routes)
│   ├── api/               # API endpoints
│   ├── components/        # React components
│   └── [routes]/          # Application routes
├── lib/                   # Core libraries and services
│   ├── database.ts        # MongoDB connection and utilities
│   ├── ai-analysis.ts     # AI analysis engine
│   ├── homework.ts        # Homework service
│   └── ...                # Other service modules
├── scripts/               # Utility scripts
├── docs/                  # Documentation
├── public/                # Static assets
└── __tests__/             # Test files
```

## Features Documentation

For detailed documentation on specific features, see the `docs/` directory:

- [Database Setup](./docs/database-setup.md) - Database configuration and migration
- [Sprint 2 Implementation](./docs/sprint2-implementation.md) - Student profiling system
- [Sprint 3 Implementation](./docs/sprint3-implementation.md) - AI-powered knowledge score updates
- [Conversation Summary System](./docs/conversation-summary-system.md) - AI conversation analysis
- [Admin Panel Enhancement](./docs/admin-panel-enhancement.md) - Admin dashboard features
- [Responses API Runbook](./docs/responses-api-runbook.md) - rollout, monitoring, rollback

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Verify your MongoDB connection string is correct
2. Ensure your IP address is whitelisted (for MongoDB Atlas)
3. Check that your database credentials are valid
4. Verify network connectivity

### OpenAI API Issues

If the AI assistant is not working:

1. Verify your `OPENAI_API_KEY` is set correctly
2. Verify `OPENAI_API_MODE=responses`
3. Check your OpenAI account has available credits
4. Ensure the API key has proper permissions

### Port Already in Use

If port 3000 is already in use:

```bash
# Kill the process using port 3000 (macOS/Linux)
lsof -ti:3000 | xargs kill -9

# Or specify a different port
PORT=3001 npm run dev
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

## License

See the [LICENSE](./LICENSE) file for details.
