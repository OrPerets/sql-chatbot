import { NextRequest, NextResponse } from 'next/server'
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'
import { parseAcademicPeriodFromSearchParams } from '@/lib/academic-period'
import {
  buildAdminStudentProfileSummaries,
  buildProfileScopeQuery,
  getScopedStudentUsers,
} from '@/lib/admin-student-profile-summary'
import { executeWithRetry, COLLECTIONS } from '@/lib/database'
import type { StudentProfile } from '@/lib/student-profiles'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 100
const MAX_PROFILE_CANDIDATES = 1000

type OperationalFilter =
  | ''
  | 'needs_review'
  | 'missing_submissions'
  | 'stale_profile'
  | 'needs_recalculation'
  | 'low_activity'
  | 'no_evidence'

function parsePositiveInteger(value: string | null, fallback: number, max?: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return max ? Math.min(parsed, max) : parsed
}

function parseOperationalFilter(value: string | null): OperationalFilter {
  const allowed = new Set<OperationalFilter>([
    '',
    'needs_review',
    'missing_submissions',
    'stale_profile',
    'needs_recalculation',
    'low_activity',
    'no_evidence',
  ])
  return allowed.has((value || '') as OperationalFilter) ? (value || '') as OperationalFilter : ''
}

function getProfileKey(profile: StudentProfile) {
  return String(profile._id?.toString?.() || profile.userId)
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const page = parsePositiveInteger(searchParams.get('page'), 1)
    const limit = parsePositiveInteger(searchParams.get('limit'), 20, MAX_LIMIT)
    const search = (searchParams.get('search') || '').trim().slice(0, 80)
    const knowledgeScore = searchParams.get('knowledgeScore') || ''
    const riskLevel = searchParams.get('riskLevel') || ''
    const operationalFilter = parseOperationalFilter(searchParams.get('status'))
    const topic = (searchParams.get('topic') || '').trim()
    const sort = searchParams.get('sort') || 'priority'

    const academicPeriod = parseAcademicPeriodFromSearchParams(searchParams)

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

      let scopedUsers = undefined
      if (academicPeriod) {
        scopedUsers = await getScopedStudentUsers(db, academicPeriod)
        if (scopedUsers.length === 0) {
          return {
            profiles: [],
            total: 0,
            totalPages: 1,
            currentPage: page,
            truncated: false,
          }
        }
        query.$and = [
          ...(query.$and || []),
          buildProfileScopeQuery(scopedUsers),
        ]
      }

      const candidateProfiles = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .find(query)
        .sort({ issueCount: -1, updatedAt: -1 })
        .limit(MAX_PROFILE_CANDIDATES + 1)
        .toArray()
      const truncated = candidateProfiles.length > MAX_PROFILE_CANDIDATES
      const profilesForFiltering = candidateProfiles.slice(0, MAX_PROFILE_CANDIDATES)
      const summaries = await buildAdminStudentProfileSummaries(db, profilesForFiltering, {
        academicPeriod,
        scopedUsers,
      })

      const filteredProfiles = profilesForFiltering.filter((profile) => {
        const summary = summaries.get(getProfileKey(profile))
        if (!summary) return false

        if (operationalFilter === 'needs_review' && !summary.flags.needsReview) return false
        if (operationalFilter === 'missing_submissions' && !summary.flags.missingSubmissions) return false
        if (operationalFilter === 'stale_profile' && !summary.flags.staleProfile) return false
        if (operationalFilter === 'needs_recalculation' && summary.freshnessStatus !== 'needs_recalculation') return false
        if (operationalFilter === 'low_activity' && !summary.flags.lowActivity) return false
        if (operationalFilter === 'no_evidence' && !summary.flags.noEvidence) return false
        if (topic && !summary.weakTopics.some((weakTopic) => weakTopic.topic === topic || weakTopic.label === topic)) return false

        return true
      })

      const riskRank = { high: 3, medium: 2, low: 1 }
      filteredProfiles.sort((left, right) => {
        const leftSummary = summaries.get(getProfileKey(left))
        const rightSummary = summaries.get(getProfileKey(right))
        if (!leftSummary || !rightSummary) return 0

        if (sort === 'last_activity') {
          return new Date(right.lastActivity || 0).getTime() - new Date(left.lastActivity || 0).getTime()
        }
        if (sort === 'missing_submissions') {
          return rightSummary.homeworkCompletion.missing - leftSummary.homeworkCompletion.missing
        }
        if (sort === 'grade_asc') {
          return (leftSummary.scoreSummary.average ?? 101) - (rightSummary.scoreSummary.average ?? 101)
        }
        if (sort === 'freshness') {
          const order = { needs_recalculation: 4, stale: 3, no_evidence: 2, current: 1 }
          return order[rightSummary.freshnessStatus] - order[leftSummary.freshnessStatus]
        }

        const reviewDelta = Number(rightSummary.flags.needsReview) - Number(leftSummary.flags.needsReview)
        if (reviewDelta !== 0) return reviewDelta
        const riskDelta = riskRank[rightSummary.riskSummary.level] - riskRank[leftSummary.riskSummary.level]
        if (riskDelta !== 0) return riskDelta
        return right.issueCount - left.issueCount
      })

      const total = filteredProfiles.length
      const skip = (page - 1) * limit
      const pageProfiles = filteredProfiles.slice(skip, skip + limit)

      // Use the names and emails that are already stored in the profiles
      const enrichedProfiles = pageProfiles.map(profile => ({
        ...profile,
        name: profile.name || 'ללא שם',
        email: profile.email || 'ללא אימייל',
        adminSummary: summaries.get(getProfileKey(profile)),
      }))

      return {
        profiles: enrichedProfiles,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        currentPage: page,
        truncated,
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
