import { config } from 'dotenv'
import { resolve } from 'path'
import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { ObjectId } from 'mongodb'

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

// Usage: npx tsx scripts/view-submitted-collection.ts [homeworkSetId]
async function viewSubmittedCollection() {
  const args = process.argv.slice(2)
  const homeworkSetId = args[0] || null
  
  try {
    const { db } = await connectToDatabase()
    const submittedCollection = db.collection(COLLECTIONS.SUBMITTED)
    
    // Build query
    const query = homeworkSetId ? { homeworkSetId } : {}
    
    if (homeworkSetId) {
      console.log(`📚 Filtering by homework set: ${homeworkSetId}\n`)
    } else {
      console.log('📚 Showing all records in submitted collection\n')
    }
    
    // Get all records
    const records = await submittedCollection.find(query).sort({ createdAt: -1 }).toArray()
    
    if (records.length === 0) {
      console.log('📋 No records found')
      return
    }
    
    console.log(`📋 Found ${records.length} record(s)\n`)
    console.log('─'.repeat(100))
    console.log(
      `${'Email'.padEnd(35)} | ${'Name'.padEnd(20)} | ${'Student ID'.padEnd(25)} | Report | Submitted At`.padEnd(100)
    )
    console.log('─'.repeat(100))
    
    records.forEach((record: any) => {
      const email = (record.email || 'N/A').substring(0, 35).padEnd(35)
      const name = (record.name || 'N/A').substring(0, 20).padEnd(20)
      const studentId = (record.studentId || 'N/A').substring(0, 25).padEnd(25)
      const report = record.receivedReport ? '✅ Yes' : '❌ No'
      const submittedAt = record.submittedAt 
        ? new Date(record.submittedAt).toLocaleDateString('he-IL', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'N/A'
      
      console.log(`${email} | ${name} | ${studentId} | ${report} | ${submittedAt}`)
    })
    
    console.log('─'.repeat(100))
    
    // Statistics
    const total = await submittedCollection.countDocuments(query)
    const withReport = await submittedCollection.countDocuments({ ...query, receivedReport: true })
    const withoutReport = await submittedCollection.countDocuments({ ...query, receivedReport: false })
    
    console.log('\n📊 Statistics:')
    console.log(`   📋 Total: ${total}`)
    console.log(`   ✅ Received report: ${withReport}`)
    console.log(`   ❌ Not received report: ${withoutReport}`)
    
    if (homeworkSetId) {
      console.log('\n💡 To find students who submitted but didn\'t receive report:')
      console.log(`   const students = await db.collection('${COLLECTIONS.SUBMITTED}').find({`)
      console.log(`     homeworkSetId: '${homeworkSetId}',`)
      console.log(`     receivedReport: false`)
      console.log(`   }).toArray()`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

viewSubmittedCollection().catch(console.error)
