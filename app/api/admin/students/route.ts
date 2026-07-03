import { NextRequest, NextResponse } from 'next/server'
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'
import { buildAcademicPeriodUserQuery, parseAcademicPeriodFromSearchParams } from '@/lib/academic-period'
import { executeWithRetry, COLLECTIONS } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const knowledgeScore = searchParams.get('knowledgeScore') || ''
    const riskLevel = searchParams.get('riskLevel') || ''

    const academicPeriod = parseAcademicPeriodFromSearchParams(searchParams)
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

      if (academicPeriod) {
        const scopedUsers = await db
          .collection(COLLECTIONS.USERS)
          .find(buildAcademicPeriodUserQuery(academicPeriod) as any, { projection: { email: 1, id: 1 } })
          .toArray()
        const scopedEmails = scopedUsers
          .map((user: any) => String(user.email || '').trim().toLowerCase())
          .filter(Boolean)
        const scopedIds = scopedUsers
          .map((user: any) => user.id || user._id?.toString?.())
          .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
        query.$and = [
          ...(query.$and || []),
          {
            $or: [
              { email: { $in: scopedEmails } },
              { userId: { $in: Array.from(new Set([...scopedEmails, ...scopedIds])) } },
            ],
          },
        ]
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
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
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
