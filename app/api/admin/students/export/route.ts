import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const includeActivities = searchParams.get('includeActivities') === 'true'

    const result = await executeWithRetry(async (db) => {
      // Get all student profiles
      const profiles = await db.collection(COLLECTIONS.STUDENT_PROFILES).find({}).toArray()
      
      // If including activities, fetch activity data for each student
      if (includeActivities) {
        for (const profile of profiles) {
          const activities = await db.collection(COLLECTIONS.STUDENT_ACTIVITIES)
            .find({ userId: profile.userId })
            .sort({ timestamp: -1 })
            .limit(50) // Limit to last 50 activities
            .toArray()
          
          profile.recentActivities = activities
        }
      }
      
      return {
        profiles,
        exportedAt: new Date().toISOString(),
        totalProfiles: profiles.length
      }
    })

    const filename = `student-profiles-export-${new Date().toISOString().split('T')[0]}.${format}`

    if (format === 'excel') {
      // For now, return JSON data that can be converted to Excel on the frontend
      return NextResponse.json({
        success: true,
        data: result,
        filename,
        message: 'Data ready for Excel export'
      })
    } else {
      return NextResponse.json({
        success: true,
        data: result,
        filename,
        message: 'Student profiles exported successfully'
      })
    }

  } catch (error) {
    console.error('Error exporting student profiles:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to export student profiles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}