import { QueryStep } from './types';

export const mockSteps: QueryStep[] = [
  {
    id: 'step-select',
    title: '1. Load source tables',
    summary: 'Start with customers and orders tables.',
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
      answer: 'customers and orders are the two source tables loaded for this query.',
      hint: 'Check the table names in the step title.'
    },
    nodes: [
      {
        id: 'customers',
        label: 'customers',
        kind: 'table',
        data: {
          columns: ['id', 'full_name', 'city'],
          rows: [
            { id: 1, full_name: 'Maya Cohen', city: 'Tel Aviv' },
            { id: 2, full_name: 'Daniel Levi', city: 'Haifa' },
            { id: 3, full_name: 'Noa Mizrahi', city: 'Jerusalem' }
          ]
        }
      },
      {
        id: 'orders',
        label: 'orders',
        kind: 'table',
        data: {
          columns: ['customer_id', 'product_id', 'status'],
          rows: [
            { customer_id: 1, product_id: 101, status: 'delivered' },
            { customer_id: 2, product_id: 102, status: 'processing' },
            { customer_id: 4, product_id: 101, status: 'cancelled' }
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
        targetNodeIds: ['customers', 'orders']
      }
    ]
  },
  {
    id: 'step-join',
    title: '2. Match rows (INNER JOIN)',
    summary: 'Pair rows where customers.id = orders.customer_id.',
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
        joinCondition: 'customers.id = orders.customer_id',
        leftSource: {
          tableName: 'customers',
          columns: ['id', 'full_name'],
          rows: [
            { id: 1, full_name: 'Maya Cohen' },
            { id: 2, full_name: 'Daniel Levi' },
            { id: 3, full_name: 'Noa Mizrahi' }
          ],
          matchedRowIndices: [0, 1],
          joinColumn: 'id'
        },
        rightSource: {
          tableName: 'orders',
          columns: ['customer_id', 'product_id'],
          rows: [
            { customer_id: 1, product_id: 101 },
            { customer_id: 2, product_id: 102 },
            { customer_id: 4, product_id: 101 }
          ],
          matchedRowIndices: [0, 1],
          joinColumn: 'customer_id'
        },
        pairs: [
          {
            id: 'pair-1',
            left: 'customers[0]: id=1',
            right: 'orders[0]: customer_id=1',
            matched: true,
            leftRowIndex: 0,
            rightRowIndex: 0,
            explanation: 'מתאים Maya Cohen (id=1) להזמנה (customer_id=1)'
          },
          {
            id: 'pair-2',
            left: 'customers[1]: id=2',
            right: 'orders[1]: customer_id=2',
            matched: true,
            leftRowIndex: 1,
            rightRowIndex: 1,
            explanation: 'מתאים Daniel Levi (id=2) להזמנה (customer_id=2)'
          },
          {
            id: 'pair-3',
            left: 'customers[2]: id=3',
            right: 'אין התאמה',
            matched: false,
            leftRowIndex: 2,
            explanation: 'Noa Mizrahi (id=3) אין רישום בטבלת orders - נשמט מהתוצאה'
          }
        ],
        data: {
          columns: ['customers.id', 'customers.full_name', 'orders.customer_id', 'orders.product_id'],
          rows: [
            { 'customers.id': 1, 'customers.full_name': 'Maya Cohen', 'orders.customer_id': 1, 'orders.product_id': 101 },
            {
              'customers.id': 2,
              'customers.full_name': 'Daniel Levi',
              'orders.customer_id': 2,
              'orders.product_id': 102
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
      answer: 'Only full_name and product_id are included in the projection.',
      hint: 'Look at the highlighted columns.'
    },
    nodes: [
      {
        id: 'projection-output',
        label: 'Final Result',
        kind: 'projection',
        data: {
          columns: ['full_name', 'product_id'],
          rows: [
            { full_name: 'Maya Cohen', product_id: 101 },
            { full_name: 'Daniel Levi', product_id: 102 }
          ],
          highlightColumns: ['full_name', 'product_id']
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
