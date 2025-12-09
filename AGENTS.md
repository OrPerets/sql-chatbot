# AI Agents & System Tasks

## Student Profiling System Refinement

### Current State
- All student profiles start as "empty" (ריק) and don't require special attention
- Basic profiling system exists but needs refinement for better attention tracking

### Required Improvements

#### 1. Initial Profile State
- **Default State**: All new student profiles should start with `knowledgeScore: 'empty'`
- **No Special Attention**: Empty profiles should not trigger any alerts or special handling
- **Clean Slate**: Students begin with a neutral state until sufficient data is collected

#### 2. Dynamic Profile Updates
- **Activity-Based Updates**: When student activities or conversation summaries are updated, the system should:
  - Analyze the new data for potential issues or concerns
  - Update the student's knowledge score if attention is needed
  - Transition from "empty" to appropriate status ("good", "needs_attention", "struggling")

#### 3. Issue Tracking System
- **Count of Issues**: Implement a counter system that tracks:
  - Number of identified problems or concerns for each student
  - Incremental updates when new issues are detected
  - Historical tracking of issue resolution

#### 4. Implementation Requirements

##### Database Schema Updates
```typescript
interface StudentProfile {
  // ... existing fields
  knowledgeScore: 'empty' | 'good' | 'needs_attention' | 'struggling';
  issueCount: number; // New field to track total issues
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

##### AI Analysis Engine Updates
- **Issue Detection**: Enhance the AI analysis to identify specific problems
- **Severity Assessment**: Classify issues by severity level
- **Profile Transition Logic**: Automatically update knowledge scores based on issue patterns

##### API Endpoints
- `POST /api/admin/students/analyze-issues` - Trigger issue analysis for a student
- `GET /api/admin/students/{id}/issues` - Retrieve student's issue history
- `PUT /api/admin/students/{id}/resolve-issue` - Mark an issue as resolved

#### 5. User Interface Updates
- **Issue Counter Display**: Show issue count in the student profiles table
- **Issue History Modal**: Detailed view of all issues for a student
- **Alert System**: Visual indicators when students have unresolved issues

#### 6. Workflow
1. **Student Registration**: Profile created with `knowledgeScore: 'empty'`, `issueCount: 0`
2. **Activity Monitoring**: System continuously monitors student activities
3. **Issue Detection**: AI identifies potential problems during activity/summary updates
4. **Profile Update**: Knowledge score and issue count updated based on findings
5. **Attention Escalation**: Students with high issue counts get prioritized attention

#### 7. Success Metrics
- Reduced time to identify struggling students
- Improved accuracy in knowledge score assessments
- Better tracking of student progress and intervention needs
- Enhanced ability to provide targeted support

---

*This task should be implemented with careful consideration of student privacy and educational best practices.*
