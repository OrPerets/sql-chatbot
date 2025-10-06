# Student Entry Flow

## Overview
A 3-step entry process for students before starting homework exercises.

## Flow

### Step 1: Student ID Entry
**Route:** `/homework/start?setId={homeworkId}`

- Student enters their תעודת זהות (ID number)
- Validates 6-9 digits
- Beautiful card-based UI with gradient background
- Error handling for invalid IDs

### Step 2: Instructions Display
After ID validation:
- Shows homework title and metadata
  - Course ID
  - Number of questions
  - Due date
- Displays background story (סיפור הרקע)
- Shows general instructions:
  - Each question requires SQL query
  - Can run and see results
  - Auto-save functionality
  - Submit when complete
- Two buttons:
  - "חזרה" (Back) - returns to ID entry
  - "התחל את שיעור הבית" (Start Homework) - proceeds to runner

### Step 3: Redirect to Runner
Automatically redirects to:
`/homework/runner/{setId}?studentId={studentId}`

## Usage

### For Teachers
Share this link with students:
```
https://your-domain.com/homework/start?setId={homeworkSetId}
```

### For Students
1. Click the link from teacher
2. Enter ID number
3. Read instructions
4. Click "התחל" to start

## Features

✅ **Clean UX**: Modern, gradient-based design
✅ **Validation**: ID validation before proceeding
✅ **Context**: Shows homework details before starting
✅ **Responsive**: Works on mobile and desktop
✅ **RTL Support**: Full Hebrew right-to-left layout
✅ **Loading States**: Smooth transitions between steps
✅ **Error Handling**: Clear error messages

## Files Created

1. `/app/homework/start/page.tsx` - Route page
2. `/app/homework/StudentEntryClient.tsx` - Client component with flow logic
3. `/app/homework/student-entry.module.css` - Styles
4. `/docs/student-entry-flow.md` - This documentation

## Screenshots Flow

```
┌─────────────────────┐
│  Step 1: ID Entry   │
│                     │
│   [Play Icon]       │
│   שיעורי בית SQL     │
│                     │
│   תעודת זהות        │
│   [________]        │
│                     │
│   [   המשך   ]      │
└─────────────────────┘
           ↓
┌─────────────────────┐
│ Step 2: Instructions│
│                     │
│  [Book Icon]        │
│  הוראות שיעור הבית   │
│                     │
│  ┌───────────────┐  │
│  │ HW Title      │  │
│  │ 📚 Course     │  │
│  │ 📝 10 Q's     │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ 📖 Background │  │
│  │ Story...      │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ 💡 Instructions│ │
│  │ • SQL queries │  │
│  │ • Run & test  │  │
│  └───────────────┘  │
│                     │
│ [חזרה] [התחל →]     │
└─────────────────────┘
           ↓
┌─────────────────────┐
│ Step 3: Runner      │
│                     │
│  [Stepper: O-O-O]   │
│                     │
│  Question 1         │
│  [SQL Editor]       │
│  [הרץ שאילתה]       │
│                     │
│  Results table      │
└─────────────────────┘
```

## Integration

To integrate with builder, add to publish step:
- Display the shareable link
- Add copy-to-clipboard button
- Show QR code (optional)

