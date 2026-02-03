/**
 * Script to send PDF reports to all submissions of Homework 3 (תרגיל 3)
 * 
 * The PDF includes:
 * - Total score (סה"כ ציון)
 * - Table of student answers (SQL queries)
 * - Comments/feedback for each question
 * 
 * Usage: 
 *   npx tsx scripts/send-hw3-pdf-reports.ts [options]
 * 
 * Options:
 *   --test                    Test mode: process only the first submission
 *   --test-random             Test mode: process a random submission
 *   --test-student <email>    Test mode: process only a specific student
 *   --exclude-student <email> Exclude a student from sending
 * 
 * Examples:
 *   # Test with first submission
 *   npx tsx scripts/send-hw3-pdf-reports.ts --test
 * 
 *   # Test with random submission
 *   npx tsx scripts/send-hw3-pdf-reports.ts --test-random
 * 
 *   # Test with specific student
 *   npx tsx scripts/send-hw3-pdf-reports.ts --test-student orperets11@gmail.com
 * 
 *   # Send to all (production)
 *   npx tsx scripts/send-hw3-pdf-reports.ts
 * 
 *   # Exclude a student
 *   npx tsx scripts/send-hw3-pdf-reports.ts --exclude-student student@example.com
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { getUsersService } from '../lib/users'
import { getSubmissionsService } from '../lib/submissions'
import { getHomeworkService } from '../lib/homework'
import { getQuestionsByHomeworkSet } from '../lib/questions'
import { generateSubmissionPdfWithFeedback } from '../lib/submission-pdf'
import { sendEmail } from '../app/utils/email-service'

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

async function sendHw3PdfReports() {
  const args = process.argv.slice(2)
  
  // Parse command line arguments
  const isTestMode = args.includes('--test')
  const isTestRandom = args.includes('--test-random')
  const testStudentEmail = args.includes('--test-student')
    ? args[args.indexOf('--test-student') + 1]
    : null
  const excludeStudentEmail = args.includes('--exclude-student') 
    ? args[args.indexOf('--exclude-student') + 1]
    : null
  
  // Validate test mode usage
  const testModeCount = [isTestMode, isTestRandom, testStudentEmail].filter(Boolean).length
  if (testModeCount > 1) {
    console.error('❌ Cannot use multiple test modes. Use only one of: --test, --test-random, --test-student')
    process.exit(1)
  }
  
  if (isTestMode) {
    console.log('🧪 TEST MODE: Will process only the first submission\n')
  }
  
  if (isTestRandom) {
    console.log('🧪 TEST MODE: Will process a random submission\n')
  }
  
  if (testStudentEmail) {
    console.log(`🧪 TEST MODE: Will process only student: ${testStudentEmail}\n`)
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
    process.exit(1)
  }
  
  console.log('✅ SMTP configuration found')
  console.log(`   Host: ${process.env.SMTP_HOST}`)
  console.log(`   Port: ${process.env.SMTP_PORT}`)
  console.log(`   From: ${process.env.SMTP_FROM}\n`)
  
  if (excludeStudentEmail) {
    console.log(`🚫 Excluding student: ${excludeStudentEmail}\n`)
  }
  
  try {
    const { db } = await connectToDatabase()
    const usersService = await getUsersService()
    const submissionsService = await getSubmissionsService()
    const homeworkService = await getHomeworkService()
    
    // Find homework 3 (תרגיל 3 or תרגיל בית 3)
    console.log('🔍 Looking for Homework 3 (תרגיל 3)...\n')
    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 })
    const exercise3Set = allHomeworkSets.items.find(
      hw => hw.title === "תרגיל 3" || hw.title === "תרגיל בית 3"
    )
    
    if (!exercise3Set) {
      console.error('❌ Homework set "תרגיל 3" or "תרגיל בית 3" not found')
      console.error('\nAvailable homework sets:')
      allHomeworkSets.items.forEach((hw, index) => {
        console.error(`  ${index + 1}. ${hw.title} (ID: ${hw.id})`)
      })
      process.exit(1)
    }
    
    console.log(`✅ Found homework set: ${exercise3Set.title} (ID: ${exercise3Set.id})\n`)
    
    // Get all submitted submissions for this homework set
    const submissions = await db.collection(COLLECTIONS.SUBMISSIONS).find({
      homeworkSetId: exercise3Set.id,
      status: { $in: ['submitted', 'graded'] }
    }).toArray()
    
    console.log(`📋 Found ${submissions.length} submitted submission(s)\n`)
    
    if (submissions.length === 0) {
      console.log('✅ No submissions to process')
      process.exit(0)
    }
    
    // Get questions once (same for all submissions)
    const questions = await getQuestionsByHomeworkSet(exercise3Set.id)
    console.log(`📝 Found ${questions.length} questions\n`)
    
    if (questions.length === 0) {
      console.error('❌ No questions found for this homework set')
      process.exit(1)
    }
    
    // Get excluded user ID if provided
    let excludedUserId: string | null = null
    if (excludeStudentEmail) {
      const excludedUser = await usersService.findUserByIdOrEmail(excludeStudentEmail)
      if (excludedUser) {
        excludedUserId = excludedUser._id.toString()
        console.log(`🚫 Excluding user ID: ${excludedUserId}\n`)
      }
    }
    
    // Get test student ID if in test mode with specific student
    let testStudentId: string | null = null
    if (testStudentEmail) {
      const testUser = await usersService.findUserByIdOrEmail(testStudentEmail)
      if (testUser) {
        testStudentId = testUser._id.toString()
        console.log(`🧪 Test student ID: ${testStudentId}\n`)
      } else {
        console.error(`❌ Test student not found: ${testStudentEmail}`)
        process.exit(1)
      }
    }
    
    // Filter submissions based on test mode
    let submissionsToProcess = submissions
    
    if (isTestMode) {
      // Test mode: process only first submission
      submissionsToProcess = submissions.slice(0, 1)
      console.log(`🧪 TEST MODE: Processing only 1 submission (out of ${submissions.length} total)\n`)
    } else if (isTestRandom) {
      // Test mode: pick a random submission
      if (submissions.length === 0) {
        console.error('❌ No submissions available for random selection')
        process.exit(1)
      }
      const randomIndex = Math.floor(Math.random() * submissions.length)
      submissionsToProcess = [submissions[randomIndex]]
      console.log(`🧪 TEST MODE: Processing random submission #${randomIndex + 1} (out of ${submissions.length} total)\n`)
    } else if (testStudentEmail && testStudentId) {
      // Test mode with specific student: filter to that student only
      submissionsToProcess = submissions.filter(
        sub => sub.studentId === testStudentId || sub.studentId === testStudentEmail
      )
      console.log(`🧪 TEST MODE: Processing ${submissionsToProcess.length} submission(s) for test student (out of ${submissions.length} total)\n`)
      
      if (submissionsToProcess.length === 0) {
        console.error(`❌ No submissions found for test student: ${testStudentEmail}`)
        process.exit(1)
      }
    }
    
    // Process each submission
    let successCount = 0
    let failureCount = 0
    let skippedCount = 0
    
    for (let i = 0; i < submissionsToProcess.length; i++) {
      const submissionDoc = submissionsToProcess[i]
      const submissionId = submissionDoc._id.toString()
      const studentId = submissionDoc.studentId
      
      // Skip excluded student
      if (excludedUserId && (studentId === excludedUserId || studentId === excludeStudentEmail)) {
        console.log(`⏭️  [${i + 1}/${submissionsToProcess.length}] Skipping excluded student: ${studentId}`)
        skippedCount++
        continue
      }
      
      console.log(`\n📧 [${i + 1}/${submissionsToProcess.length}] Processing submission ${submissionId}`)
      console.log(`   Student ID: ${studentId}`)
      
      if (isTestMode || isTestRandom || testStudentEmail) {
        console.log(`   🧪 TEST MODE - This is a test run`)
      }
      
      try {
        // Get user by studentId
        const user = await usersService.findUserByIdOrEmail(studentId)
        
        if (!user || !user.email) {
          console.error(`   ❌ Could not find user email for studentId: ${studentId}`)
          failureCount++
          continue
        }
        
        console.log(`   📬 Sending to: ${user.email}`)
        
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
        
        // Generate PDF with feedback (includes total score, answers, and comments)
        console.log(`   📄 Generating PDF with feedback...`)
        let pdfBuffer: Buffer
        try {
          pdfBuffer = await generateSubmissionPdfWithFeedback({
            submission,
            questions,
            homework: exercise3Set,
            studentName: user.name,
          })
          if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('PDF buffer is empty')
          }
          console.log(`   ✅ PDF generated (${pdfBuffer.length} bytes)`)
        } catch (pdfError: any) {
          console.error(`   ❌ PDF generation failed: ${pdfError.message}`)
          console.error(`   ❌ Error details:`, pdfError)
          failureCount++
          continue
        }
        
        // Send email
        const homeworkTitle = exercise3Set.title || "תרגיל 3"
        console.log(`   📧 Sending email with PDF attachment (${pdfBuffer.length} bytes) to ${user.email}...`)
        const emailSent = await sendEmail({
          to: user.email,
          subject: `${homeworkTitle} - דוח ציונים ומשוב - Michael SQL Assistant`,
          text: `שלום${user.name ? ` ${user.name}` : ''},\n\nקיבלת את דוח הציונים והמשוב עבור ${homeworkTitle}.\n\nהקובץ המצורף כולל:\n- ציון סופי\n- טבלת תשובות\n- הערות ומשוב לכל שאלה\n\nתודה!`,
          html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981;">${homeworkTitle} - דוח ציונים ומשוב</h2>
            <p>שלום${user.name ? ` ${user.name}` : ''},</p>
            <p>קיבלת את דוח הציונים והמשוב עבור ${homeworkTitle}.</p>
            <p><strong>הקובץ המצורף כולל:</strong></p>
            <ul>
              <li>ציון סופי (סה"כ)</li>
              <li>טבלת תשובות (שאלות ותשובות SQL)</li>
              <li>הערות ומשוב לכל שאלה</li>
            </ul>
            <p>תודה!</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 12px; color: #666;">Michael SQL Assistant Team</p>
          </div>
        `,
          attachments: [
            {
              filename: `hw3-report-${submission.id}.pdf`,
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
    if (isTestMode || isTestRandom || testStudentEmail) {
      console.log(`   🧪 TEST MODE - This was a test run`)
    }
    console.log(`   ✅ Successfully sent: ${successCount}`)
    console.log(`   ❌ Failed: ${failureCount}`)
    console.log(`   ⏭️  Skipped: ${skippedCount}`)
    console.log(`   📋 Total processed: ${successCount + failureCount + skippedCount}/${submissionsToProcess.length}`)
    if (submissionsToProcess.length < submissions.length) {
      console.log(`   📋 Total submissions available: ${submissions.length}`)
    }
    
    if (isTestMode || isTestRandom || testStudentEmail) {
      console.log(`\n💡 To send to all students, run without test flags`)
    }
    
    if (failureCount > 0) {
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

sendHw3PdfReports().catch(console.error)
