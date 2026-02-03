export type MockTable = {
  name: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
};

const tables: MockTable[] = [
  {
    name: 'Students',
    columns: ['id', 'name', 'cohort'],
    rows: [
      { id: 1, name: 'Ada', cohort: '2024A' },
      { id: 2, name: 'Linus', cohort: '2024B' },
      { id: 3, name: 'Grace', cohort: '2024A' },
      { id: 4, name: 'Ken', cohort: '2024C' }
    ]
  },
  {
    name: 'Enrollments',
    columns: ['student_id', 'course', 'status'],
    rows: [
      { student_id: 1, course: 'SQL 101', status: 'active' },
      { student_id: 2, course: 'Databases', status: 'active' },
      { student_id: 3, course: 'SQL 101', status: 'waitlist' },
      { student_id: 4, course: 'Intro to CS', status: 'active' }
    ]
  },
  {
    name: 'Courses',
    columns: ['course', 'instructor', 'room'],
    rows: [
      { course: 'SQL 101', instructor: 'Dr. Chen', room: 'Room 12' },
      { course: 'Databases', instructor: 'Prof. Kim', room: 'Room 14' },
      { course: 'Intro to CS', instructor: 'Dr. Patel', room: 'Room 9' }
    ]
  }
];

const tableRegistry = new Map(tables.map((table) => [table.name.toLowerCase(), table]));

export const getMockTable = (tableName: string): MockTable => {
  const table = tableRegistry.get(tableName.toLowerCase());

  if (!table) {
    throw new Error(`No mock data registered for table: ${tableName}`);
  }

  return table;
};

export const getAvailableTables = () => tables.map((table) => table.name);
