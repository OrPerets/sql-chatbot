import { NextRequest } from 'next/server'
import { getCurrentWeekContextNormalized, getWeekContextByNumberNormalized } from '@/lib/content'

export const runtime = 'nodejs'

type GetCourseWeekContextParams = {
  week?: number
}

export async function POST(req: NextRequest) {
  try {
    const { functionName, parameters } = await req.json()
    console.log('[course-context] request', {
      functionName,
      hasParams: !!parameters,
      requestedWeek: parameters?.week,
      ts: new Date().toISOString(),
    })

    switch (functionName) {
      case 'get_course_week_context':
        return await handleGetCourseWeekContext(parameters)
      case 'list_course_week_summaries':
        return await handleListCourseWeekSummaries()
      default:
        console.warn('[course-context] unknown function', { functionName })
        return Response.json({ error: `Unknown function: ${functionName}` }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Course-context function handler error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

async function handleGetCourseWeekContext(params: GetCourseWeekContextParams) {
  const week = typeof params?.week === 'number' ? params.week : undefined

  try {
    const payload = week
      ? await getWeekContextByNumberNormalized(week)
      : await getCurrentWeekContextNormalized(null)

    // The Assistants API expects a STRING output for tool calls
    const out = JSON.stringify({
      weekNumber: payload.weekNumber,
      content: payload.content,
      dateRange: payload.dateRange,
      updatedAt: payload.updatedAt || null,
      updatedBy: payload.updatedBy || null,
      fetchedAt: new Date().toISOString(),
    })
    return new Response(out, { headers: { 'Content-Type': 'text/plain' } })
  } catch (error: any) {
    console.error('get_course_week_context error:', { message: error.message, requestedWeek: week })
    const out = JSON.stringify({
      weekNumber: null,
      content: null,
      dateRange: null,
      error: 'Failed to retrieve course week context',
    })
    return new Response(out, { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }
}

async function handleListCourseWeekSummaries() {
  try {
    // Reuse existing weekly content list for debugging/admin usage
    const { getWeeklyContent } = await import('@/lib/content')
    const all = await getWeeklyContent()
    const summaries = all
      .sort((a, b) => a.week - b.week)
      .map((w) => ({
        weekNumber: w.week,
        hasContent: !!(w.content && w.content.trim()),
        updatedAt: w.updatedAt || null,
        updatedBy: w.updatedBy || null,
        dateRange: w.dateRange || null,
      }))

    const out = JSON.stringify({ weeks: summaries, fetchedAt: new Date().toISOString() })
    return new Response(out, { headers: { 'Content-Type': 'text/plain' } })
  } catch (error: any) {
    console.error('list_course_week_summaries error:', { message: error.message })
    const out = JSON.stringify({ error: 'Failed to list week summaries' })
    return new Response(out, { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }
}


