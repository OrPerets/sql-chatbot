import { config } from 'dotenv'
import { resolve } from 'path'
import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { getUsersService } from '../lib/users'
import { getSubmissionsService } from '../lib/submissions'
import { getHomeworkSetById } from '../lib/homework'
import { getQuestionsByHomeworkSet } from '../lib/questions'
import { generateSubmissionPdf } from '../lib/submission-pdf'
import { sendEmail } from '../app/utils/email-service'
import { ObjectId } from 'mongodb'

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

// Usage: npx tsx scripts/send-emails-to-remaining-submissions.ts <homeworkSetId>
async function sendEmailsToRemainingSubmissions() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('Usage:')
    console.log('  npx tsx scripts/send-emails-to-remaining-submissions.ts <homeworkSetId>')
    console.log('\nExample:')
    console.log('  npx tsx scripts/send-emails-to-remaining-submissions.ts 693d8a930a7ebe39f7099c88')
    process.exit(1)
  }
  
  const homeworkSetId = args[0]
  
  // Already sent emails list
  const alreadySentEmails = [
    'rotemtzubara1@gmail.com',
    'stavshahar99@gmail.com',
    'ravid820@gmail.com',
    'alma666s666@gmail.com'
  ]
  
  console.log('🚫 Excluding already sent emails:')
  alreadySentEmails.forEach(email => console.log(`   - ${email}`))
  console.log('')
  
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
  console.log(`   From: ${process.env.SMTP_FROM}\n`)
  
  try {
    const { db } = await connectToDatabase()
    const usersService = await getUsersService()
    const submissionsService = await getSubmissionsService()
    
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
    
    // Get questions once (same for all submissions)
    const questions = await getQuestionsByHomeworkSet(homeworkSetId)
    console.log(`📝 Found ${questions.length} questions\n`)
    
    if (questions.length === 0) {
      console.error('❌ No questions found for this homework set')
      process.exit(1)
    }
    
    // Get user info for each submission and filter out already sent
    const submissionsToProcess: Array<{
      submissionDoc: any
      user: any
      email: string
    }> = []
    
    console.log('🔍 Processing submissions and filtering...\n')
    
    for (const submissionDoc of submissions) {
      const studentId = submissionDoc.studentId
      
      try {
        // Get user by studentId
        const user = await usersService.findUserByIdOrEmail(studentId)
        
        if (!user || !user.email) {
          console.log(`⏭️  Skipping submission ${submissionDoc._id}: No email found for studentId ${studentId}`)
          continue
        }
        
        // Check if already sent
        if (alreadySentEmails.includes(user.email.toLowerCase())) {
          console.log(`⏭️  Skipping ${user.email}: Already sent`)
          continue
        }
        
        submissionsToProcess.push({
          submissionDoc,
          user,
          email: user.email
        })
        
      } catch (error: any) {
        console.error(`❌ Error processing submission ${submissionDoc._id}: ${error.message}`)
        continue
      }
    }
    
    console.log(`\n📧 Found ${submissionsToProcess.length} submission(s) to send emails to\n`)
    
    if (submissionsToProcess.length === 0) {
      console.log('✅ No remaining submissions to process (all already sent)')
      process.exit(0)
    }
    
    // Process each submission
    let successCount = 0
    let failureCount = 0
    
    for (let i = 0; i < submissionsToProcess.length; i++) {
      const { submissionDoc, user, email } = submissionsToProcess[i]
      const submissionId = submissionDoc._id.toString()
      
      console.log(`\n📧 [${i + 1}/${submissionsToProcess.length}] Processing submission ${submissionId}`)
      console.log(`   Student ID: ${submissionDoc.studentId}`)
      console.log(`   📬 Sending to: ${email}`)
      
      try {
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
        const pdfBuffer = await generateSubmissionPdf({
          submission,
          questions,
          homework: homeworkSet,
          studentName: user.name,
        })
        console.log(`   ✅ PDF generated (${pdfBuffer.length} bytes)`)
        
        // Send email
        const homeworkTitle = homeworkSet.title || "שיעורי בית"
        const emailSent = await sendEmail({
          to: email,
          subject: `${homeworkTitle} הוגש בהצלחה - Michael SQL Assistant`,
          text: `${homeworkTitle} הוגש בהצלחה בקורס בסיסי נתונים.\n\nתודה על ההגשה!`,
          html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981;">${homeworkTitle} הוגש בהצלחה</h2>
            <p>שלום${user.name ? ` ${user.name}` : ''},</p>
            <p>${homeworkTitle} הוגש בהצלחה בקורס בסיסי נתונים.</p>
            <p>ההגשה ננעלה ועפ״י תקנון שנקר, ואינה ניתנת לעריכה נוספת.</p>
            <p>הקובץ המצורף כולל את כל התשובות שנשלחו.</p>
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
          console.log(`   ✅ Email sent successfully!`)
          successCount++
        } else {
          console.error(`   ❌ Failed to send email`)
          failureCount++
        }
        
        // Add small delay to avoid overwhelming SMTP server
        if (i < submissionsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
      } catch (error: any) {
        console.error(`   ❌ Error processing submission: ${error.message}`)
        failureCount++
      }
    }
    
    // Summary
    console.log(`\n\n📊 Summary:`)
    console.log(`   ✅ Successfully sent: ${successCount}`)
    console.log(`   ❌ Failed: ${failureCount}`)
    console.log(`   ⏭️  Skipped (already sent): ${submissions.length - submissionsToProcess.length - (submissions.length - submissions.length)}`)
    console.log(`   📋 Total processed: ${successCount + failureCount}/${submissionsToProcess.length}`)
    
    if (failureCount > 0) {
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

sendEmailsToRemainingSubmissions().catch(console.error)
