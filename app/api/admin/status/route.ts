import { NextResponse } from 'next/server'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from '@/lib/database'

export async function GET() {
  try {
    const result = await executeWithRetry(async (db) => {
      return db.collection(COLLECTIONS.STATUS).find({}).toArray()
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error getting status:', error)
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const val = body.newStatus
    const result = await executeWithRetry(async (db) => {
      return db.collection(COLLECTIONS.STATUS).updateOne({ sid: 'admin' }, { $set: { status: val } }, { upsert: true })
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error setting status:', error)
    return NextResponse.json({ error: 'Failed to set status' }, { status: 500 })
  }
}


