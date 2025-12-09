# Semester Calendar Setup

## Overview
The semester calendar system allows the admin to configure weekly content that provides context to the MCP Michael AI assistant. This helps the AI understand which topics students are currently learning and provide more relevant assistance.

## Database Structure

### Collections
1. **`semester_config`** - Stores the semester start date
2. **`weekly_content`** - Stores weekly topics and content for each week

### Schema

#### Semester Config Document
```typescript
{
  type: 'semester_start',
  startDate: string,  // ISO date format (YYYY-MM-DD)
  updatedAt: string   // ISO timestamp
}
```

#### Weekly Content Document
```typescript
{
  week: number,        // Week number (1-14)
  content: string,     // Weekly topics and content
  dateRange: string,   // e.g., "5.11.2025 - 11.11.2025"
  updatedBy: string,   // User who updated this
  updatedAt: string    // ISO timestamp
}
```

## Current Semester: Winter 2025-2026

### Semester Details
- **Start Date**: November 5, 2025 (5.11.2025)
- **Duration**: 13 weeks
- **End Date**: February 3, 2026 (3.2.2026)

### Weekly Schedule

| Week | Dates | Topics |
|------|-------|--------|
| 1 | 5.11.2025 - 11.11.2025 | הגדרות בסיסיות / DDL / יצירת טבלאות |
| 2 | 12.11.2025 - 18.11.2025 | אילוצים / SELECT / MYSQL |
| 3 | 19.11.2025 - 25.11.2025 | FROM / WHERE / BETWEEN / LIKE |
| 4 | 26.11.2025 - 2.12.2025 | צירוף יחסיים / GROUP BY |
| 5 | 3.12.2025 - 9.12.2025 | משתנים ופונקציות ב-SQL |
| 6 | 10.12.2025 - 16.12.2025 | COUNT / DISTINCT / GROUP BY |
| 7 | 17.12.2025 - 23.12.2025 | JOIN / ON / USING |
| 8 | 24.12.2025 - 30.12.2025 | NULL / DML: INSERT, UPDATE, DELETE |
| 9 | 31.12.2025 - 6.1.2026 | תתי שאילות / תרגול Holmes Place |
| 10 | 7.1.2026 - 13.1.2026 | מפתח ראשי / מפתח זר / DDL |
| 11 | 14.1.2026 - 20.1.2026 | ALTER / אינדקס / תרגול |
| 12 | 21.1.2026 - 27.1.2026 | DROP / VIEWS / טבלאות זמניות |
| 13 | 28.1.2026 - 3.2.2026 | טריגרים / טבלאות וירטואליות |

## Admin Panel

### Access
Navigate to `/admin/mcp-michael` in the admin panel to view and edit the semester calendar.

### Features
- View all 14 weeks of content (configurable)
- Edit content for each week
- Set semester start date
- Preview how the AI assistant will see the current week's context
- Automatic date range calculation based on semester start date

## How It Works

### Current Week Calculation
The system automatically calculates the current week based on:
1. The semester start date
2. The current date
3. Formula: `weekNumber = floor((today - startDate) / 7) + 1`
4. Clamped between weeks 1-14

### AI Assistant Integration
The MCP Michael AI assistant:
1. Queries the current week's content via `/api/mcp-michael/current-week`
2. Receives the week number, content, and date range
3. Uses this context when helping students with questions
4. Provides more relevant examples and explanations based on what students are currently learning

## API Endpoints

### Get Current Week Content
```http
GET /api/mcp-michael/current-week
```

Response:
```json
{
  "weekNumber": 1,
  "content": "הגדרות בסיסיות / DDL / יצירת טבלאות...",
  "dateRange": "5.11.2025 - 11.11.2025"
}
```

### Get All Weekly Content
```http
GET /api/mcp-michael
```

Response:
```json
[
  {
    "week": 1,
    "content": "...",
    "dateRange": "5.11.2025 - 11.11.2025",
    "updatedBy": "admin",
    "updatedAt": "2025-10-10T07:21:57.158Z"
  },
  ...
]
```

### Update Weekly Content
```http
POST /api/mcp-michael
Content-Type: application/json

{
  "week": 1,
  "content": "Updated content...",
  "dateRange": "5.11.2025 - 11.11.2025"
}
```

### Set Semester Start Date
```http
POST /api/mcp-michael/semester-start
Content-Type: application/json

{
  "startDate": "2025-11-05"
}
```

## Migration Script

### Location
`scripts/populate-semester-calendar.ts`

### Usage
To re-populate or update the semester calendar:

```bash
npx tsx scripts/populate-semester-calendar.ts
```

### Customization
Edit the script to:
1. Change the semester start date
2. Modify weekly content
3. Add or remove weeks

## Benefits

1. **Context-Aware Help**: AI assistant knows what students are currently learning
2. **Targeted Examples**: Provides examples relevant to the current week's topics
3. **Progress Tracking**: Clear view of curriculum progression
4. **Easy Updates**: Admin can update content for any week through the UI
5. **Automatic Date Management**: No need to manually calculate date ranges

## Future Enhancements

Potential improvements:
- Support for multiple semesters (archive old semesters)
- Import/export semester calendars
- Template system for common semester structures
- Integration with homework assignments
- Student view to see upcoming topics
- Email reminders for weekly topics

## Populated Date
**October 10, 2025** - Initial population of Winter 2025-2026 semester data

