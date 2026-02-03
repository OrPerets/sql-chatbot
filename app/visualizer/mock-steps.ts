import { QueryStep } from './types';

export const mockSteps: QueryStep[] = [
  {
    id: 'step-select',
    title: '1. Load source tables',
    summary: 'Start with Students and Enrollments tables.',
    narration:
      'We begin by loading the source tables into memory so we can reference them throughout the query.',
    caption: 'Load the input tables that the query will read.',
    glossary: [
      {
        term: 'FROM',
        definition: 'Specifies the tables or sources that provide rows to the query.'
      }
    ],
    quiz: {
      id: 'quiz-select',
      question: 'Which tables are we pulling rows from at the start?',
      answer: 'Students and Enrollments are the two source tables loaded for this query.',
      hint: 'Check the table names in the step title.'
    },
    nodes: [
      {
        id: 'students',
        label: 'Students',
        kind: 'table',
        data: {
          columns: ['id', 'name'],
          rows: [
            { id: 1, name: 'Ada' },
            { id: 2, name: 'Linus' },
            { id: 3, name: 'Grace' }
          ]
        }
      },
      {
        id: 'enrollments',
        label: 'Enrollments',
        kind: 'table',
        data: {
          columns: ['student_id', 'course'],
          rows: [
            { student_id: 1, course: 'SQL 101' },
            { student_id: 2, course: 'Databases' },
            { student_id: 4, course: 'Intro to CS' }
          ]
        }
      }
    ],
    animations: [
      {
        id: 'highlight-inputs',
        label: 'Highlight input tables',
        style: 'highlight',
        durationMs: 700,
        targetNodeIds: ['students', 'enrollments']
      }
    ]
  },
  {
    id: 'step-join',
    title: '2. Match rows (INNER JOIN)',
    summary: 'Pair rows where Students.id = Enrollments.student_id.',
    narration:
      'An INNER JOIN keeps only the rows where the join keys match, producing combined rows for matching students.',
    caption: 'Match rows on the join keys and build combined rows.',
    glossary: [
      {
        term: 'INNER JOIN',
        definition: 'Keeps only rows where the join condition matches between two tables.'
      },
      {
        term: 'ON',
        definition: 'Defines the join condition that decides which rows match.'
      }
    ],
    quiz: {
      id: 'quiz-join',
      question: 'What happens to rows that do not find a match in an INNER JOIN?',
      answer: 'Unmatched rows are excluded from the result.',
      hint: 'INNER joins only keep matches.'
    },
    nodes: [
      {
        id: 'join-output',
        label: 'חיבור טבלאות',
        kind: 'join',
        detail: 'מתאימים סטודנטים עם הקורסים שלהם לפי מפתח החיבור.',
        joinType: 'INNER',
        joinCondition: 'Students.id = Enrollments.student_id',
        leftSource: {
          tableName: 'Students',
          columns: ['id', 'name'],
          rows: [
            { id: 1, name: 'Ada' },
            { id: 2, name: 'Linus' },
            { id: 3, name: 'Grace' }
          ],
          matchedRowIndices: [0, 1],
          joinColumn: 'id'
        },
        rightSource: {
          tableName: 'Enrollments',
          columns: ['student_id', 'course'],
          rows: [
            { student_id: 1, course: 'SQL 101' },
            { student_id: 2, course: 'Databases' },
            { student_id: 4, course: 'Intro to CS' }
          ],
          matchedRowIndices: [0, 1],
          joinColumn: 'student_id'
        },
        pairs: [
          {
            id: 'pair-1',
            left: 'Students[0]: id=1',
            right: 'Enrollments[0]: student_id=1',
            matched: true,
            leftRowIndex: 0,
            rightRowIndex: 0,
            explanation: 'מתאים Ada (id=1) עם הקורס SQL 101 (student_id=1)'
          },
          {
            id: 'pair-2',
            left: 'Students[1]: id=2',
            right: 'Enrollments[1]: student_id=2',
            matched: true,
            leftRowIndex: 1,
            rightRowIndex: 1,
            explanation: 'מתאים Linus (id=2) עם הקורס Databases (student_id=2)'
          },
          {
            id: 'pair-3',
            left: 'Students[2]: id=3',
            right: 'אין התאמה',
            matched: false,
            leftRowIndex: 2,
            explanation: 'Grace (id=3) אין רישום בטבלת Enrollments - נשמט מהתוצאה'
          }
        ],
        data: {
          columns: ['Students.id', 'Students.name', 'Enrollments.student_id', 'Enrollments.course'],
          rows: [
            { 'Students.id': 1, 'Students.name': 'Ada', 'Enrollments.student_id': 1, 'Enrollments.course': 'SQL 101' },
            {
              'Students.id': 2,
              'Students.name': 'Linus',
              'Enrollments.student_id': 2,
              'Enrollments.course': 'Databases'
            }
          ],
          rowStates: ['matched', 'matched']
        }
      }
    ],
    animations: [
      {
        id: 'pair-rows',
        label: 'Pair matching rows',
        style: 'move',
        durationMs: 900,
        targetNodeIds: ['join-output']
      }
    ]
  },
  {
    id: 'step-project',
    title: '3. Project columns',
    summary: 'Select the final columns for output.',
    narration:
      'Projection chooses which columns to keep, shaping the final output table for the user.',
    caption: 'Keep only the columns requested in SELECT.',
    glossary: [
      {
        term: 'SELECT',
        definition: 'Lists the columns or expressions you want in the final output.'
      }
    ],
    quiz: {
      id: 'quiz-project',
      question: 'Which columns make it into the final result?',
      answer: 'Only name and course are included in the projection.',
      hint: 'Look at the highlighted columns.'
    },
    nodes: [
      {
        id: 'projection-output',
        label: 'Final Result',
        kind: 'projection',
        data: {
          columns: ['name', 'course'],
          rows: [
            { name: 'Ada', course: 'SQL 101' },
            { name: 'Linus', course: 'Databases' }
          ],
          highlightColumns: ['name', 'course']
        }
      }
    ],
    animations: [
      {
        id: 'highlight-result',
        label: 'Reveal result columns',
        style: 'pulse',
        durationMs: 800,
        targetNodeIds: ['projection-output']
      }
    ]
  }
];
