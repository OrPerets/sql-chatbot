export type QueryType = 'create' | 'insert';

export type ColumnType = 'VARCHAR' | 'INT' | 'DECIMAL' | 'DATE' | 'BOOLEAN' | 'TEXT' | 'DATETIME' | 'TIMESTAMP';

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  length?: number;
  precision?: number; // For DECIMAL
  scale?: number; // For DECIMAL
  nullable: boolean;
  primaryKey: boolean;
  autoIncrement: boolean;
  defaultValue?: string;
  unique?: boolean;
}

export interface Constraint {
  id: string;
  type: 'FOREIGN_KEY' | 'UNIQUE' | 'CHECK';
  name?: string;
  definition: string;
}

export interface CreateTableData {
  tableName: string;
  columns: Column[];
  constraints: Constraint[];
}

export interface InsertData {
  tableName: string;
  columns: string[];
  values: string[][];
  useTransaction: boolean;
  onConflict: 'IGNORE' | 'UPDATE' | 'NONE';
}

export interface SqlQueryBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onQueryGenerated: (query: string) => void;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidation {
  isValid: boolean;
  errors: ValidationError[];
}

export const COLUMN_TYPES: { value: ColumnType; label: string; hasLength: boolean; hasPrecision: boolean }[] = [
  { value: 'VARCHAR', label: 'VARCHAR (טקסט)', hasLength: true, hasPrecision: false },
  { value: 'TEXT', label: 'TEXT (טקסט ארוך)', hasLength: false, hasPrecision: false },
  { value: 'INT', label: 'INT (מספר שלם)', hasLength: false, hasPrecision: false },
  { value: 'DECIMAL', label: 'DECIMAL (מספר עשרוני)', hasLength: false, hasPrecision: true },
  { value: 'DATE', label: 'DATE (תאריך)', hasLength: false, hasPrecision: false },
  { value: 'DATETIME', label: 'DATETIME (תאריך ושעה)', hasLength: false, hasPrecision: false },
  { value: 'TIMESTAMP', label: 'TIMESTAMP (חותמת זמן)', hasLength: false, hasPrecision: false },
  { value: 'BOOLEAN', label: 'BOOLEAN (אמת/שקר)', hasLength: false, hasPrecision: false },
];

export const CONFLICT_OPTIONS = [
  { value: 'NONE', label: 'אין טיפול בהתנגשויות' },
  { value: 'IGNORE', label: 'התעלם מהתנגשויות' },
  { value: 'UPDATE', label: 'עדכן בהתנגשויות' },
];
