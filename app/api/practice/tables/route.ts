import { NextResponse } from 'next/server'
import { getPracticeTables } from '@/lib/practice'

export async function GET() {
  try {
    const result = await getPracticeTables()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching practice tables:', error)
    return NextResponse.json({ error: 'Failed to fetch practice tables' }, { status: 500 })
  }
}


