import { NextResponse } from 'next/server';
import initSqlJs from 'sql.js';

export async function POST(request: Request) {
  try {
    const { searchType, searchValue } = await request.json();

    // Initialize SQL.js
    const SQL = await initSqlJs();
    
    // TODO: Load your database file
    // For now using in-memory database with mock data
    const db = new SQL.Database();
    
    // Create a mock users table and insert sample data
    db.run(`
      CREATE TABLE users (id TEXT, full_name TEXT, email TEXT, password TEXT);
      INSERT INTO users VALUES 
        ('1', 'John Doe', 'john@example.com', 'hashedpassword'),
        ('2', 'Jane Smith', 'jane@example.com', 'hashedpassword');
    `);

    let query = '';
    const params: any = {};

    switch (searchType) {
      case 'id':
        query = 'SELECT id, full_name, email FROM users WHERE id = $id';
        params.$id = searchValue;
        break;
      case 'name':
        query = 'SELECT id, full_name, email FROM users WHERE full_name LIKE $name';
        params.$name = `%${searchValue}%`;
        break;
      case 'email':
        query = 'SELECT id, full_name, email FROM users WHERE email LIKE $email';
        params.$email = `%${searchValue}%`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid search type' }, { status: 400 });
    }

    const result = db.exec(query, params);
    
    if (!result.length || !result[0].values.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Convert the first row to an object
    const columns = result[0].columns;
    const values = result[0].values[0];
    const user = columns.reduce((obj: any, col: string, i: number) => {
      obj[col] = values[i];
      return obj;
    }, {});

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Error searching for user' },
      { status: 500 }
    );
  }
}
