export type MockTable = {
  name: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
};

export type DemoDatabase = {
  name: string;
  tables: MockTable[];
};

const tables: MockTable[] = [
  {
    name: 'customers',
    columns: ['id', 'full_name', 'email', 'city', 'segment'],
    rows: [
      { id: 1, full_name: 'Maya Cohen', email: 'maya.cohen@example.com', city: 'Tel Aviv', segment: 'Premium' },
      { id: 2, full_name: 'Daniel Levi', email: 'daniel.levi@example.com', city: 'Haifa', segment: 'Standard' },
      { id: 3, full_name: 'Noa Mizrahi', email: 'noa.mizrahi@example.com', city: 'Jerusalem', segment: 'Premium' },
      { id: 4, full_name: 'Avi Shalev', email: 'avi.shalev@example.com', city: 'Beer Sheva', segment: 'Standard' }
    ]
  },
  {
    name: 'products',
    columns: ['id', 'name', 'category', 'price'],
    rows: [
      { id: 101, name: 'Wireless Mouse', category: 'Electronics', price: 129 },
      { id: 102, name: 'Mechanical Keyboard', category: 'Electronics', price: 349 },
      { id: 201, name: 'Desk Lamp', category: 'Home Office', price: 189 },
      { id: 202, name: 'Laptop Stand', category: 'Home Office', price: 159 }
    ]
  },
  {
    name: 'orders',
    columns: ['id', 'customer_id', 'product_id', 'quantity', 'order_date', 'status'],
    rows: [
      { id: 5001, customer_id: 1, product_id: 101, quantity: 2, order_date: '2026-02-11', status: 'delivered' },
      { id: 5002, customer_id: 1, product_id: 201, quantity: 1, order_date: '2026-02-20', status: 'delivered' },
      { id: 5003, customer_id: 2, product_id: 102, quantity: 1, order_date: '2026-03-02', status: 'processing' },
      { id: 5004, customer_id: 3, product_id: 202, quantity: 3, order_date: '2026-03-08', status: 'shipped' },
      { id: 5005, customer_id: 4, product_id: 101, quantity: 1, order_date: '2026-03-15', status: 'cancelled' }
    ]
  }
];

export const demoDatabase: DemoDatabase = {
  name: 'commerce_demo',
  tables
};

const tableRegistry = new Map(tables.map((table) => [table.name.toLowerCase(), table]));

export const getMockTable = (tableName: string): MockTable => {
  const table = tableRegistry.get(tableName.toLowerCase());

  if (!table) {
    throw new Error(`No mock data registered for table: ${tableName}`);
  }

  return table;
};

export const getAvailableTables = () => tables.map((table) => table.name);
