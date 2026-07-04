import { config } from 'dotenv'
import { resolve } from 'path'
import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { getUsersService } from '../lib/users'
import { getSubmissionsService } from '../lib/submissions'
import { getHomeworkSetById } from '../lib/homework'
import { getRenderedQuestionsForStudent } from '../lib/student-questions'
import { generateSubmissionPdf } from '../lib/submission-pdf'
import { sendEmail } from '../app/utils/email-service'
import { ObjectId } from 'mongodb'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

async function testSubmissionEmail() {
  const submissionId = '695799ce867518148db4f4f2'
  
  try {
    const { db } = await connectToDatabase()
    const usersService = await getUsersService()
    const submissionsService = await getSubmissionsService()
    
    const submission = await submissionsService.getSubmissionById(submissionId)
    if (!submission) {
      console.error('❌ Submission not found')
      process.exit(1)
    }
    
    console.log('📋 Submission:')
    console.log(`   ID: ${submission.id}`)
    console.log(`   Student ID: ${submission.studentId}`)
    console.log(`   Status: ${submission.status}`)
    
    // Try to find user with submission.studentId
    const user = await usersService.findUserByIdOrEmail(submission.studentId)
    console.log(`\n👤 User lookup with submission.studentId (${submission.studentId}):`)
    if (user) {
      console.log(`   ✅ Found: ${user.email}`)
    } else {
      console.log(`   ❌ NOT FOUND`)
    }
    
    // Test email sending
    if (user && user.email) {
      console.log(`\n📧 Testing email send to: ${user.email}`)
      
      const homeworkSet = await getHomeworkSetById(submission.homeworkSetId)
      const questions = await getRenderedQuestionsForStudent(submission.homeworkSetId, submission.studentId)
      
      const pdfBuffer = await generateSubmissionPdf({
        submission,
        questions,
        homework: homeworkSet!,
        studentName: user.name,
      })
      
      const emailSent = await sendEmail({
        to: user.email,
        subject: `${homeworkSet?.title || 'Homework'} הוגש בהצלחה - Michael SQL Assistant`,
        text: 'Test email',
        html: '<p>Test email</p>',
        attachments: [{
          filename: `submission-${submission.id}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        }],
      })
      
      if (emailSent) {
        console.log('✅ Email sent successfully!')
      } else {
        console.log('❌ Email failed')
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testSubmissionEmail().catch(console.error)
