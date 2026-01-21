import { QueryStep } from './types';

export const mockSteps: QueryStep[] = [
  {
    id: 'step-select',
    title: '1. Load source tables',
    summary: 'Start with Students and Enrollments tables.',
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
    nodes: [
      {
        id: 'join-output',
        label: 'Joined rows',
        kind: 'join',
        detail: 'Match students with their courses.',
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
