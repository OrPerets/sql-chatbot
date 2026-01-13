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

/**
 * Interface for documents in the "submitted" collection
 * Tracks students who have submitted homework and received PDF reports
 */
interface SubmittedStudent {
  _id?: ObjectId
  studentId: string
  email: string
  name?: string
  homeworkSetId: string
  submissionId: string
  receivedReport: boolean
  submittedAt: string | null
  createdAt: Date
  updatedAt?: Date
}

// Usage: npx tsx scripts/resend-submission-email.ts [--find-missing]
//   --find-missing: Find and send emails to students with status "submitted" but not in "submitted" collection
//   Otherwise: npx tsx scripts/resend-submission-email.ts <submissionId> or <studentEmail> <homeworkSetId>
async function resendSubmissionEmail() {
  const args = process.argv.slice(2)
  
  // Check if --find-missing flag is used
  if (args.includes('--find-missing')) {
    await findAndSendMissingSubmissions()
    return
  }
  
  if (args.length === 0) {
    console.log('Usage:')
    console.log('  npx tsx scripts/resend-submission-email.ts --find-missing')
    console.log('  npx tsx scripts/resend-submission-email.ts <submissionId>')
    console.log('  npx tsx scripts/resend-submission-email.ts <studentEmail> <homeworkSetId>')
    process.exit(1)
  }
  
  // Check SMTP configuration
  const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error('❌ Missing SMTP environment variables:')
    missingVars.forEach(varName => console.error(`   - ${varName}`))
    console.error('\n📝 Please set these in your .env.local or .env file:')
    console.error('   SMTP_HOST=smtp.gmail.com (or your email provider)')
    console.error('   SMTP_PORT=587')
    console.error('   SMTP_USER=your-email@example.com')
    console.error('   SMTP_PASS=your-app-password')
    console.error('   SMTP_FROM=your-email@example.com')
    console.error('\n💡 See docs/email-setup-guide.md for detailed setup instructions')
    process.exit(1)
  }
  
  console.log('✅ SMTP configuration found')
  console.log(`   Host: ${process.env.SMTP_HOST}`)
  console.log(`   Port: ${process.env.SMTP_PORT}`)
  console.log(`   From: ${process.env.SMTP_FROM}\n`)
  
  try {
    const { db } = await connectToDatabase()
    const submissionsService = await getSubmissionsService()
    const usersService = await getUsersService()
    
    let submission: any = null
    
    if (args.length === 1) {
      // Lookup by submission ID
      const submissionId = args[0]
      console.log(`🔍 Looking up submission by ID: ${submissionId}`)
      submission = await submissionsService.getSubmissionById(submissionId)
    } else {
      // Lookup by student email and homework set ID
      const studentEmail = args[0]
      const homeworkSetId = args[1]
      console.log(`🔍 Looking up submission by email: ${studentEmail}, homework: ${homeworkSetId}`)
      
      // First find user by email
      const user = await usersService.findUserByIdOrEmail(studentEmail)
      if (!user) {
        console.error(`❌ User not found: ${studentEmail}`)
        process.exit(1)
      }
      
      submission = await submissionsService.getSubmissionForStudent(homeworkSetId, user._id.toString())
    }
    
    if (!submission) {
      console.error('❌ Submission not found')
      process.exit(1)
    }
    
    console.log(`✅ Found submission:`)
    console.log(`   ID: ${submission.id}`)
    console.log(`   Student ID: ${submission.studentId}`)
    console.log(`   Status: ${submission.status}`)
    console.log(`   Submitted At: ${submission.submittedAt}`)
    
    // Get user email
    const user = await usersService.findUserByIdOrEmail(submission.studentId)
    if (!user || !user.email) {
      console.error(`❌ Could not find user email for studentId: ${submission.studentId}`)
      process.exit(1)
    }
    
    console.log(`\n📧 Sending email to: ${user.email}`)
    
    // Get homework set and questions
    const homeworkSet = await getHomeworkSetById(submission.homeworkSetId)
    if (!homeworkSet) {
      console.error(`❌ Homework set not found: ${submission.homeworkSetId}`)
      process.exit(1)
    }
    
    const questions = await getQuestionsByHomeworkSet(submission.homeworkSetId)
    console.log(`📚 Found ${questions.length} questions`)
    
    // Generate PDF
    console.log(`\n📄 Generating PDF...`)
    const pdfBuffer = await generateSubmissionPdf({
      submission,
      questions,
      homework: homeworkSet,
      studentName: user.name,
    })
    console.log(`✅ PDF generated (${pdfBuffer.length} bytes)`)
    
    // Send email
    const homeworkTitle = homeworkSet.title || "שיעורי בית"
    const emailSent = await sendEmail({
      to: user.email,
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
      console.log(`\n✅ Email sent successfully to ${user.email}!`)
    } else {
      console.error(`\n❌ Failed to send email to ${user.email}`)
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

async function findAndSendMissingSubmissions() {
  // Check SMTP configuration
  const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error('❌ Missing SMTP environment variables:')
    missingVars.forEach(varName => console.error(`   - ${varName}`))
    console.error('\n📝 Please set these in your .env.local or .env file')
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
    
    console.log('🔍 Finding submissions with status "submitted" that are NOT in the "submitted" collection...\n')
    
    // Get all submissions with status "submitted"
    const submittedSubmissions = await db.collection(COLLECTIONS.SUBMISSIONS).find({
      status: 'submitted'
    }).toArray()
    
    console.log(`📋 Found ${submittedSubmissions.length} submission(s) with status "submitted"\n`)
    
    if (submittedSubmissions.length === 0) {
      console.log('✅ No submitted submissions found')
      process.exit(0)
    }
    
    // Get the submitted collection
    const submittedCollection = db.collection<SubmittedStudent>(COLLECTIONS.SUBMITTED)
    
    // Find submissions that are NOT in the submitted collection
    const missingSubmissions: any[] = []
    
    for (const submission of submittedSubmissions) {
      const studentId = submission.studentId
      const homeworkSetId = submission.homeworkSetId
      
      // Check if this student+homework combination exists in submitted collection
      const existingRecord = await submittedCollection.findOne({
        studentId: studentId,
        homeworkSetId: homeworkSetId
      })
      
      if (!existingRecord) {
        missingSubmissions.push(submission)
      }
    }
    
    console.log(`📊 Found ${missingSubmissions.length} submission(s) missing from "submitted" collection\n`)
    
    if (missingSubmissions.length === 0) {
      console.log('✅ All submitted students are already in the "submitted" collection')
      process.exit(0)
    }
    
    // Process each missing submission
    let successCount = 0
    let failureCount = 0
    
    for (let i = 0; i < missingSubmissions.length; i++) {
      const submissionDoc = missingSubmissions[i]
      const submissionId = submissionDoc._id.toString()
      const studentId = submissionDoc.studentId
      const homeworkSetId = submissionDoc.homeworkSetId
      
      console.log(`\n📧 [${i + 1}/${missingSubmissions.length}] Processing submission ${submissionId}`)
      console.log(`   Student ID: ${studentId}`)
      console.log(`   Homework Set ID: ${homeworkSetId}`)
      
      try {
        // Get user by studentId
        const user = await usersService.findUserByIdOrEmail(studentId)
        
        if (!user || !user.email) {
          console.error(`   ❌ Could not find user email for studentId: ${studentId}`)
          failureCount++
          continue
        }
        
        console.log(`   📬 Sending to: ${user.email}`)
        
        // Get homework set and questions
        const homeworkSet = await getHomeworkSetById(homeworkSetId)
        if (!homeworkSet) {
          console.error(`   ❌ Homework set not found: ${homeworkSetId}`)
          failureCount++
          continue
        }
        
        const questions = await getQuestionsByHomeworkSet(homeworkSetId)
        console.log(`   📚 Found ${questions.length} questions`)
        
        if (questions.length === 0) {
          console.error(`   ❌ No questions found for this homework set`)
          failureCount++
          continue
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
        console.log(`   📄 Generating PDF...`)
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
          to: user.email,
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
          
          // Update the submitted collection
          const submittedRecord: SubmittedStudent = {
            studentId: studentId,
            email: user.email,
            name: user.name || undefined,
            homeworkSetId: homeworkSetId,
            submissionId: submissionId,
            receivedReport: true,
            submittedAt: submissionDoc.submittedAt || null,
            createdAt: new Date(),
          }
          
          const { createdAt, ...recordToUpdate } = submittedRecord
          
          await submittedCollection.updateOne(
            {
              studentId: studentId,
              homeworkSetId: homeworkSetId
            },
            {
              $set: {
                ...recordToUpdate,
                updatedAt: new Date()
              },
              $setOnInsert: {
                createdAt: new Date()
              }
            },
            { upsert: true }
          )
          
          console.log(`   ✅ Updated "submitted" collection`)
          successCount++
        } else {
          console.error(`   ❌ Failed to send email`)
          failureCount++
        }
        
        // Add small delay to avoid overwhelming SMTP server
        if (i < missingSubmissions.length - 1) {
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
    console.log(`   📋 Total processed: ${successCount + failureCount}/${missingSubmissions.length}`)
    
    if (failureCount > 0) {
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

resendSubmissionEmail().catch(console.error)
