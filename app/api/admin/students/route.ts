import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const knowledgeScore = searchParams.get('knowledgeScore') || ''
    const riskLevel = searchParams.get('riskLevel') || ''

    const skip = (page - 1) * limit

    const result = await executeWithRetry(async (db) => {
      // Build query filters
      const query: any = {}
      
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }
      
      if (knowledgeScore) {
        query.knowledgeScore = knowledgeScore
      }
      
      if (riskLevel) {
        query['riskFactors.riskLevel'] = riskLevel
      }

      // Get total count
      const total = await db.collection(COLLECTIONS.STUDENT_PROFILES).countDocuments(query)
      
      // Get profiles with pagination
      const profiles = await db.collection(COLLECTIONS.STUDENT_PROFILES)
        .find(query)
        .skip(skip)
        .limit(limit)
        .sort({ issueCount: -1 })
        .toArray()

      // Use the names and emails that are already stored in the profiles
      const enrichedProfiles = profiles.map(profile => ({
        ...profile,
        name: profile.name || 'ללא שם',
        email: profile.email || 'ללא אימייל'
      }))

      return {
        profiles: enrichedProfiles,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      }
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error fetching student profiles:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch student profiles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}