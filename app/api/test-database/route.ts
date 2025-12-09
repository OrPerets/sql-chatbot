import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase, COLLECTIONS } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing database connection...')
    
    // Test database connection
    const { db } = await connectToDatabase()
    console.log('Database connected successfully')
    
    // Test ping
    await db.admin().ping()
    console.log('Database ping successful')
    
    // Test collections
    const collections = await db.listCollections().toArray()
    console.log('Available collections:', collections.map(c => c.name))
    
    // Test users collection
    const usersCount = await db.collection(COLLECTIONS.USERS).countDocuments()
    console.log('Users count:', usersCount)
    
    // Test password reset tokens collection
    const tokensCount = await db.collection(COLLECTIONS.PASSWORD_RESET_TOKENS).countDocuments()
    console.log('Password reset tokens count:', tokensCount)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database test completed successfully',
      collections: collections.map(c => c.name),
      usersCount,
      tokensCount
    })

  } catch (error) {
    console.error('Error in database test:', error)
    return NextResponse.json({ 
      error: 'Database test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
