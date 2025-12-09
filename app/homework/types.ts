export type HomeworkVisibility = "draft" | "published" | "archived";

export interface DatasetTablePreview {
  name: string;
  columns: string[];
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  scenario?: string;
  story?: string;
  connectionUri: string;
  previewTables: DatasetTablePreview[];
  tags: string[];
  updatedAt: string;
}

export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
  weight: number;
  autoGraded: boolean;
}

export interface Question {
  id: string;
  prompt: string;
  instructions: string;
  starterSql?: string;
  expectedResultSchema: Array<{ column: string; type: string }>;
  gradingRubric: RubricCriterion[];
  datasetId?: string;
  maxAttempts: number;
  points: number;
  evaluationMode?: "auto" | "manual" | "custom";
  // Parametric question fields
  isTemplate?: boolean;
  templateId?: string;
  variables?: any[]; // VariableValue[] for instantiated questions
}

export interface HomeworkSet {
  id: string;
  title: string;
  courseId: string;
  dueAt: string;
  published: boolean;
  datasetPolicy: "shared" | "custom";
  questionOrder: string[];
  visibility: HomeworkVisibility;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  overview?: string;
  selectedDatasetId?: string;
  backgroundStory?: string;
}

export interface SqlResultRow {
  [column: string]: unknown;
}

export interface SqlResult {
  columns: string[];
  rows: SqlResultRow[];
  executionMs: number;
  truncated: boolean;
}

export interface FeedbackEntry {
  criterionId: string;
  earned: number;
  comments?: string;
}

export interface Feedback {
  questionId: string;
  score: number;
  autoNotes?: string;
  instructorNotes?: string;
  rubricBreakdown: FeedbackEntry[];
}

export interface SqlAnswer {
  sql: string;
  resultPreview?: SqlResult;
  feedback?: Feedback;
  lastExecutedAt?: string;
  executionCount?: number;
}

export interface Submission {
  id: string;
  homeworkSetId: string;
  studentId: string;
  attemptNumber: number;
  answers: Record<string, SqlAnswer>;
  overallScore: number;
  status: "in_progress" | "submitted" | "graded";
  submittedAt?: string;
  gradedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubmissionSummary {
  id: string;
  studentId: string;
  status: Submission["status"];
  overallScore: number;
  submittedAt?: string;
  gradedAt?: string;
  attemptNumber: number;
  progress: number;
}

export interface QuestionProgress {
  questionId: string;
  attempts: number;
  lastExecutedAt?: string;
  completed: boolean;
  earnedScore?: number;
}

export interface SqlExecutionRequest {
  setId: string;
  questionId: string;
  sql: string;
  attemptNumber: number;
  submissionId: string;
  studentId: string;
  preview?: boolean;
}

export interface SqlExecutionResponse extends SqlResult {
  feedback?: Feedback;
}

export interface AnalyticsEvent {
  id: string;
  type:
    | "runner.view"
    | "runner.execute_sql"
    | "runner.save_draft"
    | "runner.submit"
    | "builder.grade_update"
    | "builder.publish_grades"
    | "builder.preview_execute";
  actorId: string;
  setId: string;
  questionId?: string;
  submissionId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface PublishGradesResult {
  updated: number;
  submissions: Submission[];
  message: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: "create" | "update" | "publish" | "execute_sql" | "grade" | "preview_execute_sql";
  targetId: string;
  targetType: "homeworkSet" | "question" | "submission";
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
}

export interface HomeworkSummary extends HomeworkSet {
  draftQuestionCount: number;
  submissionCount: number;
  averageScore?: number;
}

export type HomeworkStatusFilter = "draft" | "scheduled" | "published" | "archived";

export interface HomeworkQueryParams {
  courseId?: string;
  status?: HomeworkStatusFilter[];
}

export interface ApiError {
  code: string;
  message: string;
  remediation?: string;
}

// Added to support submission draft saving
export interface SaveSubmissionDraftPayload {
  studentId: string;
  answers: Record<string, SqlAnswer>;
}

// Template system types
export type VariableType = 
  | 'number' 
  | 'string' 
  | 'date' 
  | 'list' 
  | 'range' 
  | 'sql_value'
  | 'table_name'
  | 'column_name';

export interface VariableConstraints {
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: string[];
  start?: number;
  end?: number;
  minDate?: string;
  maxDate?: string;
  format?: string;
  tableNames?: string[];
  columnNames?: string[];
  dataTypes?: string[];
}

export interface VariableDefinition {
  id: string;
  name: string;
  type: VariableType;
  description?: string;
  constraints?: VariableConstraints;
  defaultValue?: any;
  required?: boolean;
}

export interface VariableValue {
  variableId: string;
  value: any;
  generatedAt: string;
}

export interface QuestionTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  variables: VariableDefinition[];
  expectedResultSchema?: Array<{ column: string; type: string }>;
  starterSql?: string;
  instructions?: string;
  gradingRubric?: any[];
  datasetId?: string;
  maxAttempts?: number;
  points?: number;
  evaluationMode?: "auto" | "manual" | "custom";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstantiatedQuestion {
  id: string;
  templateId: string;
  studentId: string;
  homeworkSetId: string;
  variables: VariableValue[];
  prompt: string;
  instructions: string;
  starterSql?: string;
  expectedResultSchema: Array<{ column: string; type: string }>;
  gradingRubric: any[];
  datasetId?: string;
  maxAttempts: number;
  points: number;
  evaluationMode?: "auto" | "manual" | "custom";
  createdAt: string;
}
