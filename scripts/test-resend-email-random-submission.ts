import { config } from 'dotenv'
import { resolve } from 'path'
import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { getUsersService } from '../lib/users'
import { getHomeworkSetById } from '../lib/homework'
import { getRenderedQuestionsForStudent } from '../lib/student-questions'
import { generateSubmissionPdfWithFeedback } from '../lib/submission-pdf'
import { sendEmail } from '../app/utils/email-service'

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

// Usage: npx tsx scripts/test-resend-email-random-submission.ts <homeworkSetId>
async function testResendEmailRandomSubmission() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('Usage:')
    console.log('  npx tsx scripts/test-resend-email-random-submission.ts <homeworkSetId>')
    console.log('\nExample:')
    console.log('  npx tsx scripts/test-resend-email-random-submission.ts 693d8a930a7ebe39f7099c88')
    process.exit(1)
  }

  const homeworkSetId = args[0]
  const TEST_EMAIL = 'orperets11@gmail.com'

  // Check SMTP configuration
  const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

  if (missingVars.length > 0) {
    console.error('❌ Missing SMTP environment variables:')
    missingVars.forEach(varName => console.error(`   - ${varName}`))
    process.exit(1)
  }

  console.log('✅ SMTP configuration found')
  console.log(`   Host: ${process.env.SMTP_HOST}`)
  console.log(`   Port: ${process.env.SMTP_PORT}`)
  console.log(`   From: ${process.env.SMTP_FROM}`)
  console.log(`   📬 Test email will be sent to: ${TEST_EMAIL}\n`)

  try {
    const { db, client } = await connectToDatabase()
    const usersService = await getUsersService()
    
    // Get homework set info
    const homeworkSet = await getHomeworkSetById(homeworkSetId)
    if (!homeworkSet) {
      console.error(`❌ Homework set not found: ${homeworkSetId}`)
      process.exit(1)
    }

    console.log(`📚 Homework: ${homeworkSet.title || homeworkSetId}\n`)

    // Get all submitted submissions for this homework set
    const submissions = await db.collection(COLLECTIONS.SUBMISSIONS).find({
      homeworkSetId: homeworkSetId,
      status: { $in: ['submitted', 'graded'] }
    }).toArray()

    console.log(`📋 Found ${submissions.length} submitted submission(s)\n`)

    if (submissions.length === 0) {
      console.log('✅ No submissions to process')
      process.exit(0)
    }

    // Randomly select one submission
    const randomIndex = Math.floor(Math.random() * submissions.length)
    const submissionDoc = submissions[randomIndex]
    const submissionId = submissionDoc._id.toString()
    const studentId = submissionDoc.studentId

    console.log(`🎲 Randomly selected submission ${randomIndex + 1} of ${submissions.length}`)
    console.log(`📧 Processing submission ${submissionId}`)
    console.log(`   Student ID: ${studentId}`)

    try {
      // Get user by studentId (to get student name for PDF)
      const user = await usersService.findUserByIdOrEmail(studentId)

      if (!user) {
        console.error(`   ❌ Could not find user for studentId: ${studentId}`)
        process.exit(1)
      }

      console.log(`   👤 Original student: ${user.name || 'Unknown'} (${user.email || 'No email'})`)
      console.log(`   📬 Sending to test email: ${TEST_EMAIL}`)
      const questions = await getRenderedQuestionsForStudent(homeworkSetId, studentId)
      console.log(`   📝 Found ${questions.length} rendered questions`)

      if (questions.length === 0) {
        console.error('   ❌ No questions found for this homework set')
        process.exit(1)
      }

      const unrenderedQuestion = questions.find(
        question => question.prompt.includes('{{') || question.instructions?.includes('{{')
      )
      if (unrenderedQuestion) {
        console.error(`   ❌ Question still has unresolved placeholders: ${unrenderedQuestion.id}`)
        process.exit(1)
      }

      // Convert submission document to Submission type
      const submission = {
        id: submissionId,
        homeworkSetId: submissionDoc.homeworkSetId,
        studentId: submissionDoc.studentId,
        attemptNumber: submissionDoc.attemptNumber || 0,
        answers: submissionDoc.answers || {},
        overallScore: submissionDoc.overallScore || 0,
        status: submissionDoc.status,
        submittedAt: submissionDoc.submittedAt,
        gradedAt: submissionDoc.gradedAt,
        studentTableData: submissionDoc.studentTableData,
        aiCommitment: submissionDoc.aiCommitment,
      }

      // Generate PDF
      const pdfBuffer = await generateSubmissionPdfWithFeedback({
        submission,
        questions,
        homework: homeworkSet,
        studentName: user.name,
        studentEmail: user.email,
      })
      console.log(`   ✅ PDF generated (${pdfBuffer.length} bytes)`)

      // Send email to test email address
      const homeworkTitle = homeworkSet.title || "שיעורי בית"
      const emailSent = await sendEmail({
        to: TEST_EMAIL,
        subject: `[TEST] ${homeworkTitle} הוגש בהצלחה - Michael SQL Assistant`,
        text: `[TEST EMAIL] ${homeworkTitle} הוגש בהצלחה בקורס בסיסי נתונים.\n\nמצורף קובץ עם התשובות, הערות וציון לכל שאלה.\nתודה על ההגשה!`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981;">[TEST EMAIL] ${homeworkTitle} הוגש בהצלחה</h2>
            <p style="background-color: #fef3c7; padding: 10px; border-radius: 5px; margin-bottom: 20px;">
              <strong>⚠️ זהו אימייל בדיקה</strong><br>
              Original student: ${user.name || 'Unknown'} (${user.email || 'No email'})<br>
              Submission ID: ${submissionId}
            </p>
            <p>שלום${user.name ? ` ${user.name}` : ''},</p>
            <p>${homeworkTitle} הוגש בהצלחה בקורס בסיסי נתונים.</p>
            <p>ההגשה ננעלה ועפ״י תקנון שנקר, ואינה ניתנת לעריכה נוספת.</p>
            <p>הקובץ המצורף כולל את כל התשובות שנשלחו, יחד עם הערות וציון לכל שאלה שנבדקה.</p>
            <p>תודה על ההגשה!</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 12px; color: #666;">Michael SQL Assistant Team</p>
          </div>
        `,
        attachments: [
          {
            filename: `submission-${submission.id}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      })

      if (emailSent) {
        console.log(`   ✅ Email sent successfully to ${TEST_EMAIL}!`)
        console.log(`\n📊 Summary:`)
        console.log(`   ✅ Successfully sent: 1`)
        console.log(`   📋 Total submissions available: ${submissions.length}`)
        console.log(`   🎲 Selected submission: ${submissionId}`)
        await client.close()
        process.exit(0)
      } else {
        console.error(`   ❌ Failed to send email`)
        process.exit(1)
      }
    } catch (error: any) {
      console.error(`   ❌ Error processing submission: ${error.message}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testResendEmailRandomSubmission().catch(console.error)
