import { NextResponse } from 'next/server'

// Optional stub endpoint to support admin UI; replace with real data source if needed
export async function GET() {
  try {
    const classes = [
      { id: 0, name: 'כל הכיתות' },
      { id: 1, name: 'A' },
      { id: 2, name: 'B' }
    ]
    return NextResponse.json(classes)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 })
  }
}


