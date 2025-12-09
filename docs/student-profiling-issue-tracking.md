# Student Profiling Issue Tracking System

## Overview

The Student Profiling Issue Tracking System is an enhanced version of the existing student profiling system that automatically detects, tracks, and manages learning issues for students. This system provides educators with early warning indicators and actionable insights to help struggling students.

## Key Features

### 1. Issue Detection
- **AI-Powered Analysis**: Uses the Michael assistant to analyze student behavior patterns
- **Rule-Based Detection**: Backup detection using predefined rules for common issues
- **Severity Classification**: Issues are classified as low, medium, or high severity
- **Automatic Triggering**: Analysis is triggered based on student activity patterns

### 2. Issue Tracking
- **Issue History**: Complete history of all detected issues for each student
- **Resolution Tracking**: Track which issues have been resolved and when
- **Issue Counter**: Real-time count of total and unresolved issues
- **Timestamp Tracking**: When issues were detected and resolved

### 3. Profile Transition Logic
- **Dynamic Updates**: Knowledge scores are automatically updated based on issue patterns
- **Empty State Management**: Students start with "empty" profiles until sufficient data is collected
- **Attention Escalation**: Students with high issue counts get prioritized attention

## Database Schema

### StudentProfile Interface
```typescript
interface StudentProfile {
  // ... existing fields
  issueCount: number; // Total number of identified issues
  issueHistory: Array<{
    issueId: string;
    description: string;
    detectedAt: Date;
    resolvedAt?: Date;
    severity: 'low' | 'medium' | 'high';
  }>;
  lastIssueUpdate: Date;
}
```

## API Endpoints

### 1. Analyze Issues
- **Endpoint**: `POST /api/admin/students/analyze-issues`
- **Purpose**: Trigger manual issue analysis for a student
- **Body**: `{ studentId: string, analysisType?: string, triggerReason?: string }`

### 2. Get Student Issues
- **Endpoint**: `GET /api/admin/students/{studentId}/issues`
- **Purpose**: Retrieve complete issue history for a student
- **Response**: Issue summary with total, unresolved, and resolved counts

### 3. Resolve Issue
- **Endpoint**: `PUT /api/admin/students/{studentId}/resolve-issue`
- **Purpose**: Mark a specific issue as resolved
- **Body**: `{ issueId: string }`

## User Interface

### Student Profiles Table
- **Issue Counter Column**: Shows total number of issues for each student
- **View Issues Button**: Click to open detailed issue history modal
- **Analyze Issues Button**: Manual trigger for issue analysis

### Issue History Modal
- **Issue Summary**: Overview of total, unresolved, and resolved issues
- **Detailed History**: Complete list of all issues with severity indicators
- **Resolution Actions**: Buttons to resolve individual issues
- **Timeline View**: When issues were detected and resolved

## Workflow

### 1. Student Registration
1. New student profile created with `knowledgeScore: 'empty'`
2. `issueCount: 0`, `issueHistory: []`, `lastIssueUpdate: now()`
3. No special attention required until sufficient data is collected

### 2. Activity Monitoring
1. System continuously monitors student activities
2. Conversation summaries are analyzed for patterns
3. Performance data is tracked and evaluated

### 3. Issue Detection
1. AI analysis engine processes student data
2. Issues are detected based on:
   - Low comprehension levels
   - Declining performance trends
   - High help request frequency
   - Multiple difficulty areas
   - Error patterns
3. Issues are added to student profile with severity classification

### 4. Profile Updates
1. Knowledge score is updated based on issue patterns:
   - `struggling`: 2+ high severity issues OR 1 high + 2+ medium
   - `needs_attention`: 1+ high severity OR 3+ medium severity
   - `good`: No issues + sufficient data + good performance
   - `empty`: Default state until sufficient data collected
2. Issue count and history are updated
3. Last issue update timestamp is set

### 5. Attention Escalation
1. Students with high issue counts appear prominently in admin interface
2. Visual indicators show unresolved issues
3. Admin can manually analyze and resolve issues
4. System provides recommendations for intervention

## AI Analysis Engine Enhancements

### Issue Detection Rules
- **Comprehension Issues**: Low comprehension level in conversations
- **Performance Issues**: Declining grade trends
- **Help Seeking**: High frequency of help requests
- **Difficulty Areas**: Multiple areas of struggle
- **Engagement Issues**: Low engagement combined with poor performance
- **Error Patterns**: Repeated error types

### Severity Assessment
- **High Severity**: Critical issues requiring immediate attention
- **Medium Severity**: Issues that need monitoring and intervention
- **Low Severity**: Minor concerns that should be tracked

### Knowledge Score Logic
- **Empty → Good**: No issues + 5+ questions + 70%+ average grade
- **Empty → Needs Attention**: 1+ high severity OR 3+ medium severity issues
- **Empty → Struggling**: 2+ high severity OR 1 high + 2+ medium issues
- **Any → Struggling**: 2+ high severity OR 1 high + 2+ medium issues
- **Any → Needs Attention**: 1+ high severity OR 3+ medium severity issues

## Migration

### Existing Profiles
Run the migration script to add new fields to existing profiles:
```bash
npx ts-node scripts/migrate-student-profiles-issues.ts
```

### New Profiles
All new profiles automatically include the issue tracking fields with default values.

## Success Metrics

- **Reduced Time to Identify Struggling Students**: Early detection of issues
- **Improved Accuracy**: AI-powered analysis with rule-based backup
- **Better Tracking**: Complete history of issues and resolutions
- **Enhanced Support**: Targeted interventions based on specific issues

## Privacy and Best Practices

- All issue tracking respects student privacy
- Issues are stored securely with proper access controls
- Analysis is performed on aggregated, anonymized data when possible
- Educators have full control over issue resolution and management

## Future Enhancements

- **Predictive Analytics**: Predict which students are likely to struggle
- **Intervention Recommendations**: Specific suggestions for addressing issues
- **Progress Tracking**: Monitor improvement after interventions
- **Reporting**: Detailed reports on issue patterns and resolution rates
