import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { ObjectId } from 'mongodb'

// Specific homework set ID to check (from the problem statement)
const TARGET_HOMEWORK_SET_ID = '693d8a930a7ebe39f7099c88'

async function countAIReviews() {
  console.log('🔍 Counting AI-generated reviews in database...\n')
  
  try {
    const { db } = await connectToDatabase()
    
    // Get all submissions
    const allSubmissions = await db.collection(COLLECTIONS.SUBMISSIONS).find({}).toArray()
    
    console.log(`📊 Total submissions in database: ${allSubmissions.length}\n`)
    
    // Filter for target homework set
    const targetSubmissions = allSubmissions.filter((sub: any) => {
      const hwId = sub.homeworkSetId || sub.homeworkSet?._id?.toString() || sub.homeworkSet?.id
      return hwId === TARGET_HOMEWORK_SET_ID || 
             hwId?.toString() === TARGET_HOMEWORK_SET_ID ||
             (sub.homeworkSet?._id && new ObjectId(sub.homeworkSet._id).toString() === TARGET_HOMEWORK_SET_ID)
    })
    
    console.log(`🎯 Target Homework Set: ${TARGET_HOMEWORK_SET_ID}`)
    console.log(`   Submissions for this set: ${targetSubmissions.length}\n`)
    
    // Use target submissions if found, otherwise use all
    const submissions = targetSubmissions.length > 0 ? targetSubmissions : allSubmissions
    
    let totalSubmissionsWithReviews = 0
    let totalAnswersWithReviews = 0
    let totalAnswersWithEmptyReviews = 0
    let totalAnswers = 0
    
    const submissionsWithReviews: Array<{
      submissionId: string
      studentId: string
      homeworkSetId: string
      answersWithReviews: number
      totalAnswers: number
    }> = []
    
    for (const submission of submissions) {
      const answers = submission.answers || {}
      const answerEntries = Object.entries(answers)
      totalAnswers += answerEntries.length
      
      let answersWithReviews = 0
      let answersWithEmptyReviews = 0
      
      for (const [questionId, answer] of answerEntries) {
        const feedback = (answer as any)?.feedback
        const instructorNotes = feedback?.instructorNotes?.trim() || ''
        
        if (instructorNotes) {
          answersWithReviews++
          totalAnswersWithReviews++
        } else if (feedback?.instructorNotes !== undefined) {
          // Has field but is empty
          answersWithEmptyReviews++
          totalAnswersWithEmptyReviews++
        }
      }
      
      if (answersWithReviews > 0) {
        totalSubmissionsWithReviews++
        submissionsWithReviews.push({
          submissionId: submission._id?.toString() || submission.id || 'unknown',
          studentId: submission.studentId || 'unknown',
          homeworkSetId: submission.homeworkSetId || 'unknown',
          answersWithReviews,
          totalAnswers: answerEntries.length
        })
      }
    }
    
    console.log('📈 Summary:')
    console.log(`   Total submissions: ${submissions.length}`)
    console.log(`   Submissions with AI reviews: ${totalSubmissionsWithReviews}`)
    console.log(`   Total answers: ${totalAnswers}`)
    console.log(`   Answers with reviews: ${totalAnswersWithReviews}`)
    console.log(`   Answers with empty reviews field: ${totalAnswersWithEmptyReviews}`)
    console.log(`   Answers without reviews: ${totalAnswers - totalAnswersWithReviews - totalAnswersWithEmptyReviews}`)
    console.log(`\n   Coverage: ${((totalAnswersWithReviews / totalAnswers) * 100).toFixed(1)}% of answers have reviews`)
    console.log(`   Submission coverage: ${((totalSubmissionsWithReviews / submissions.length) * 100).toFixed(1)}% of submissions have at least one review\n`)
    
    // Group by homework set
    const byHomeworkSet = new Map<string, { submissions: number, answers: number }>()
    for (const sub of submissionsWithReviews) {
      const hwId = sub.homeworkSetId
      if (!byHomeworkSet.has(hwId)) {
        byHomeworkSet.set(hwId, { submissions: 0, answers: 0 })
      }
      const stats = byHomeworkSet.get(hwId)!
      stats.submissions++
      stats.answers += sub.answersWithReviews
    }
    
    console.log('📚 By Homework Set:')
    for (const [hwId, stats] of Array.from(byHomeworkSet.entries())) {
      // Try to get homework set title
      let title = 'Unknown'
      try {
        const hwSet = await db.collection(COLLECTIONS.HOMEWORK_SETS).findOne({
          $or: [
            { _id: new ObjectId(hwId) },
            { id: hwId }
          ]
        })
        if (hwSet) {
          title = hwSet.title || 'Untitled'
        }
      } catch (e) {
        // Ignore
      }
      console.log(`   ${title} (${hwId.substring(0, 8)}...): ${stats.submissions} submissions, ${stats.answers} answers with reviews`)
    }
    
    // Show sample submissions with reviews
    if (submissionsWithReviews.length > 0) {
      console.log(`\n📝 Sample submissions with reviews (first 5):`)
      for (let i = 0; i < Math.min(5, submissionsWithReviews.length); i++) {
        const sub = submissionsWithReviews[i]
        console.log(`   ${i + 1}. Submission ${sub.submissionId.substring(0, 8)}... (Student: ${sub.studentId}): ${sub.answersWithReviews}/${sub.totalAnswers} answers have reviews`)
      }
    }
    
    // Detailed check for target homework set
    if (targetSubmissions.length > 0) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`🎯 DETAILED CHECK FOR HOMEWORK SET: ${TARGET_HOMEWORK_SET_ID}`)
      console.log(`${'='.repeat(60)}\n`)
      
      const targetWithReviews = submissionsWithReviews.filter(s => {
        const sub = targetSubmissions.find((t: any) => 
          (t._id?.toString() || t.id) === s.submissionId
        )
        return !!sub
      })
      
      console.log(`📊 Target Set Statistics:`)
      console.log(`   Total submissions: ${targetSubmissions.length}`)
      console.log(`   Submissions with reviews: ${targetWithReviews.length}`)
      console.log(`   Coverage: ${((targetWithReviews.length / targetSubmissions.length) * 100).toFixed(1)}%`)
      
      // Count answers with reviews for target set
      let targetAnswersWithReviews = 0
      let targetTotalAnswers = 0
      const sampleNotes: Array<{ submissionId: string, questionId: string, notes: string, score: number }> = []
      
      for (const submission of targetSubmissions) {
        const answers = submission.answers || {}
        const answerEntries = Object.entries(answers)
        targetTotalAnswers += answerEntries.length
        
        for (const [questionId, answer] of answerEntries) {
          const feedback = (answer as any)?.feedback
          const instructorNotes = feedback?.instructorNotes?.trim() || ''
          
          if (instructorNotes) {
            targetAnswersWithReviews++
            if (sampleNotes.length < 3) {
              sampleNotes.push({
                submissionId: submission._id?.toString() || submission.id || 'unknown',
                questionId,
                notes: instructorNotes.substring(0, 150),
                score: feedback?.score || 0
              })
            }
          }
        }
      }
      
      console.log(`\n   Total answers: ${targetTotalAnswers}`)
      console.log(`   Answers with reviews: ${targetAnswersWithReviews}`)
      console.log(`   Answer coverage: ${targetTotalAnswers > 0 ? ((targetAnswersWithReviews / targetTotalAnswers) * 100).toFixed(1) : 0}%`)
      
      if (sampleNotes.length > 0) {
        console.log(`\n   📝 Sample AI Comments (first ${sampleNotes.length}):`)
        sampleNotes.forEach((note, idx) => {
          console.log(`      ${idx + 1}. Submission ${note.submissionId.substring(0, 8)}..., Question ${note.questionId.substring(0, 8)}...`)
          console.log(`         Score: ${note.score}`)
          console.log(`         Comment: "${note.notes}${note.notes.length >= 150 ? '...' : ''}"`)
        })
      }
      
      // Check recent updates (gradedAt timestamp)
      const recentlyGraded = targetSubmissions
        .filter((s: any) => s.gradedAt)
        .sort((a: any, b: any) => {
          const timeA = new Date(a.gradedAt).getTime()
          const timeB = new Date(b.gradedAt).getTime()
          return timeB - timeA
        })
        .slice(0, 5)
      
      if (recentlyGraded.length > 0) {
        console.log(`\n   ⏰ Recently Graded Submissions (last 5):`)
        recentlyGraded.forEach((sub: any, idx: number) => {
          const subId = sub._id?.toString() || sub.id || 'unknown'
          const gradedAt = new Date(sub.gradedAt).toLocaleString()
          const answers = sub.answers || {}
          const answersWithNotes = Object.entries(answers).filter(([_, ans]: [string, any]) => 
            ans.feedback?.instructorNotes?.trim()
          ).length
          console.log(`      ${idx + 1}. ${subId.substring(0, 8)}... - Graded: ${gradedAt} - ${answersWithNotes} answers with notes`)
        })
      }
      
      // Final verdict
      console.log(`\n${'='.repeat(60)}`)
      if (targetWithReviews.length === 0) {
        console.log(`❌ VERDICT: NO AI REVIEWS FOUND IN DATABASE`)
        console.log(`   The onSuccess handler likely did not execute.`)
        console.log(`   Check browser console for client-side logs.`)
      } else if (targetWithReviews.length < targetSubmissions.length * 0.5) {
        console.log(`⚠️  VERDICT: PARTIAL SAVE - Only ${targetWithReviews.length}/${targetSubmissions.length} submissions have reviews`)
        console.log(`   Some saves may have failed. Check logs for errors.`)
      } else {
        console.log(`✅ VERDICT: DATABASE UPDATED SUCCESSFULLY`)
        console.log(`   ${targetWithReviews.length}/${targetSubmissions.length} submissions have AI reviews saved.`)
      }
      console.log(`${'='.repeat(60)}\n`)
    }
    
  } catch (error) {
    console.error('❌ Error counting reviews:', error)
    if (error instanceof Error) {
      console.error('   Error message:', error.message)
      console.error('   Stack:', error.stack)
    }
  }
}

countAIReviews().catch(console.error)
