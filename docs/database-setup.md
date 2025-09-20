# Database Setup Guide

This guide explains how to set up the MongoDB database for the homework system.

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Database Configuration
DB_USERNAME=sql-admin
DB_PASSWORD=SMff5PqhhoVbX6z7
DB_NAME=experiment
MONGODB_URI=mongodb+srv://sql-admin:SMff5PqhhoVbX6z7@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor

# OpenAI Configuration (if needed)
OPENAI_API_KEY=your_openai_api_key_here

# Feature Flags
FEATURE_VOICE=1
```

## Setup Steps

### 1. Install Dependencies

Make sure you have the required dependencies installed:

```bash
npm install mongodb tsx
```

### 2. Set Up Database

Run the database setup script to create collections and indexes:

```bash
npx tsx scripts/setup-database.ts
```

This will:
- Create the necessary collections
- Set up database indexes for optimal performance
- Validate the database connection

### 3. Migrate Data

Run the migration script to move hardcoded data to the database:

```bash
npx tsx scripts/migrate-to-database.ts
```

This will:
- Migrate datasets from the mock store
- Migrate homework sets and questions
- Migrate existing submissions
- Create proper database indexes

### 4. Verify Setup

After running the scripts, you should see:
- Database collections created
- Indexes properly set up
- Sample data migrated successfully

## Database Collections

The system uses the following MongoDB collections:

- **datasets**: Stores dataset definitions and metadata
- **homework_sets**: Stores homework set configurations
- **questions**: Stores individual questions for homework sets
- **submissions**: Stores student submissions and answers
- **analytics_events**: Stores analytics and tracking data
- **audit_logs**: Stores audit trail for compliance

## API Endpoints

The following API endpoints are now database-backed:

### Datasets
- `GET /api/datasets` - List datasets with filtering
- `POST /api/datasets` - Create new dataset
- `GET /api/datasets/[id]` - Get specific dataset
- `PUT /api/datasets/[id]` - Update dataset
- `DELETE /api/datasets/[id]` - Delete dataset

### Homework Sets
- `GET /api/homework` - List homework sets with filtering
- `POST /api/homework` - Create new homework set
- `GET /api/homework/[setId]` - Get specific homework set
- `PUT /api/homework/[setId]` - Update homework set
- `DELETE /api/homework/[setId]` - Delete homework set
- `PATCH /api/homework/[setId]` - Publish/unpublish homework set

### Questions
- `GET /api/homework/[setId]/questions` - List questions for homework set
- `POST /api/homework/[setId]/questions` - Create new question
- `GET /api/homework/[setId]/questions/[questionId]` - Get specific question
- `PUT /api/homework/[setId]/questions/[questionId]` - Update question
- `DELETE /api/homework/[setId]/questions/[questionId]` - Delete question

### Submissions
- `GET /api/submissions/[setId]` - Get submission for student or list summaries
- `POST /api/submissions/[setId]` - Save draft or submit submission

### SQL Execution
- `POST /api/sql/execute` - Execute SQL queries (database-backed)

## Admin Panel Integration

The admin panel now works with the database-backed APIs:

1. **Database Management**: Create, edit, and delete datasets
2. **Homework Management**: Create, edit, and publish homework sets
3. **Question Management**: Add and edit questions within homework sets
4. **Submission Management**: View and grade student submissions

## Troubleshooting

### Connection Issues

If you encounter connection issues:

1. Verify the MongoDB URI is correct
2. Check that the database credentials are valid
3. Ensure the database is accessible from your network

### Migration Issues

If migration fails:

1. Check that the database setup was successful
2. Verify all collections were created
3. Check for any duplicate data that might cause conflicts

### Performance Issues

For performance optimization:

1. Ensure all indexes are created properly
2. Monitor query performance using MongoDB tools
3. Consider adding additional indexes based on usage patterns

## Development vs Production

- **Development**: Uses the same MongoDB instance with test data
- **Production**: Should use a separate MongoDB instance with proper security settings
- **Environment Variables**: Different values for each environment

## Security Considerations

- Database credentials are stored in environment variables
- Connection strings use MongoDB Atlas security features
- All API endpoints include proper error handling and validation
- Database operations use parameterized queries to prevent injection
