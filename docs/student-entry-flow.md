# Student Entry Flow

## Overview
A multi-step entry process for students before starting homework: optionally choose a homework set (when several are published), log in with email and password, read instructions, then start the runner.

## Flow

### Optional: Choose homework set
**When multiple published sets exist** (e.g. "תרגיל 3" and "הכנה למבחן"):
- Students see a "בחר מטלה" screen listing all published sets.
- They pick one, then continue to the login step.
- If only one set is published, this step is skipped.

### Step 1: Login
**Route:** `/homework/start` or `/homework/start?setId={homeworkSetId}`

- Student enters **email** and **password** (login).
- If they came from "בחר מטלה", the chosen set is shown; they can click "החלף מטלה" to go back.
- If the URL has `?setId=...`, that set is used (no chooser).

### Step 2: Instructions
After successful login:
- Shows homework title and metadata (questions count, due date).
- Displays background story (סיפור הרקע).
- General instructions (SQL queries, run & test, submit when complete).
- Buttons: "חזרה" (Back) to login, "התחל את שיעור הבית" to start.

### Step 3: Runner
Redirects to:
`/homework/runner/{setId}?studentId={studentId}`

## Usage

### For teachers: how students enter a published homework

1. **Direct link (recommended for "הכנה למבחן")**  
   Share:
   ```
   https://your-domain.com/homework/start?setId={homeworkSetId}
   ```
   Get `homeworkSetId` from the builder: open the set → copy from the URL, e.g. `/homework/builder/6789.../edit` → `6789...` is the setId.

2. **Generic student page**  
   Share:
   ```
   https://your-domain.com/homework/start
   ```
   - If only one set is published, students go straight to login for that set.
   - If several are published (e.g. תרגיל 3 + הכנה למבחן), students first choose the homework, then log in.

### For students
1. Open the link from the teacher (`/homework/start` or `/homework/start?setId=...`).
2. If you see "בחר מטלה", choose the homework (e.g. "הכנה למבחן").
3. Enter email and password → "התחבר".
4. Read instructions and click "התחל את שיעור הבית".
5. Solve questions in the runner and submit when done.

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

