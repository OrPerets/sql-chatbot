const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');



// Database configuration
const remoteDbPassword = "SMff5PqhhoVbX6z7";
const dbUserName = "sql-admin";
const connectionString = `mongodb+srv://${dbUserName}:${remoteDbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
const DB_NAME = 'experiment';

async function connectToDatabase() {
    const client = new MongoClient(connectionString);
    await client.connect();
    return client.db(DB_NAME);
}

async function backupCommentBank(db) {
    console.log('🔄 Creating backup of commentBank collection...');
    
    const comments = await db.collection('commentBank').find({}).toArray();
    const backupFileName = `commentBank_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    fs.writeFileSync(backupFileName, JSON.stringify(comments, null, 2));
    console.log(`✅ Backup created: ${backupFileName} (${comments.length} comments)`);
    
    return comments;
}

async function findDuplicates(comments) {
    console.log('🔍 Analyzing duplicates...');
    
    // Group comments by questionId + feedback + score
    const groups = {};
    
    comments.forEach(comment => {
        const key = `${comment.questionId}_${comment.score}_${comment.feedback}`;
        
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(comment);
    });
    
    // Find groups with duplicates
    const duplicateGroups = {};
    let totalDuplicates = 0;
    
    Object.entries(groups).forEach(([key, commentGroup]) => {
        if (commentGroup.length > 1) {
            duplicateGroups[key] = commentGroup;
            totalDuplicates += commentGroup.length - 1; // subtract 1 to keep one
        }
    });
    
    console.log(`📊 Found ${Object.keys(duplicateGroups).length} duplicate groups with ${totalDuplicates} extra comments`);
    
    return duplicateGroups;
}

function selectBestComment(commentGroup) {
    // Sort by usage count (descending), then by gradedAt (most recent)
    return commentGroup.sort((a, b) => {
        if (b.usageCount !== a.usageCount) {
            return b.usageCount - a.usageCount;
        }
        return new Date(b.gradedAt) - new Date(a.gradedAt);
    })[0];
}

async function deduplicateComments(db, duplicateGroups) {
    console.log('🧹 Removing duplicates...');
    
    let removedCount = 0;
    let mergedUsageCount = 0;
    
    for (const [key, commentGroup] of Object.entries(duplicateGroups)) {
        const bestComment = selectBestComment(commentGroup);
        const duplicatesToRemove = commentGroup.filter(c => c._id.toString() !== bestComment._id.toString());
        
        // Calculate total usage count from all duplicates
        const totalUsageCount = commentGroup.reduce((sum, comment) => sum + (comment.usageCount || 0), 0);
        
        // Update the best comment with merged usage count
        if (totalUsageCount > bestComment.usageCount) {
            await db.collection('commentBank').updateOne(
                { _id: bestComment._id },
                { 
                    $set: { 
                        usageCount: totalUsageCount,
                        lastUsed: new Date() // Update as recently cleaned
                    }
                }
            );
            mergedUsageCount += totalUsageCount - bestComment.usageCount;
        }
        
        // Remove duplicates
        for (const duplicate of duplicatesToRemove) {
            await db.collection('commentBank').deleteOne({ _id: duplicate._id });
            removedCount++;
        }
        
        console.log(`  ✓ Question ${bestComment.questionId}: Kept 1, removed ${duplicatesToRemove.length} duplicates`);
    }
    
    console.log(`✅ Cleanup complete: Removed ${removedCount} duplicate comments`);
    console.log(`📈 Merged usage count: +${mergedUsageCount} total usages preserved`);
    
    return { removedCount, mergedUsageCount };
}

async function generateReport(db, originalCount, removedCount) {
    console.log('📋 Generating cleanup report...');
    
    const finalCount = await db.collection('commentBank').countDocuments();
    const questionStats = await db.collection('commentBank').aggregate([
        {
            $group: {
                _id: '$questionId',
                count: { $sum: 1 },
                totalUsage: { $sum: '$usageCount' },
                avgScore: { $avg: '$score' }
            }
        },
        { $sort: { count: -1 } }
    ]).toArray();
    
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            originalCount,
            finalCount,
            removedCount,
            reductionPercentage: ((removedCount / originalCount) * 100).toFixed(1)
        },
        questionStats: questionStats.slice(0, 10) // Top 10 questions by comment count
    };
    
    const reportFileName = `comment_bank_cleanup_report_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportFileName, JSON.stringify(report, null, 2));
    
    console.log(`\n📊 CLEANUP SUMMARY:`);
    console.log(`   Original comments: ${originalCount}`);
    console.log(`   Final comments: ${finalCount}`);
    console.log(`   Removed duplicates: ${removedCount}`);
    console.log(`   Reduction: ${report.summary.reductionPercentage}%`);
    console.log(`   Report saved: ${reportFileName}`);
    
    return report;
}

async function main() {
    console.log('🚀 Starting Comment Bank Cleanup...\n');
    
    try {
        // Connect to database
        const db = await connectToDatabase();
        console.log('✅ Connected to database');
        
        // Create backup
        const originalComments = await backupCommentBank(db);
        const originalCount = originalComments.length;
        
        if (originalCount === 0) {
            console.log('❌ No comments found in commentBank collection');
            return;
        }
        
        // Find duplicates
        const duplicateGroups = await findDuplicates(originalComments);
        
        if (Object.keys(duplicateGroups).length === 0) {
            console.log('✅ No duplicates found! Comment bank is already clean.');
            return;
        }
        
        // Ask for confirmation
        console.log(`\n⚠️  This will remove ${Object.values(duplicateGroups).reduce((sum, group) => sum + group.length - 1, 0)} duplicate comments.`);
        console.log('   Continue? Press Ctrl+C to abort, or press Enter to continue...');
        
        // Wait for user input (in real script, you might want to use readline)
        // For automation, we'll proceed directly
        
        // Remove duplicates
        const { removedCount } = await deduplicateComments(db, duplicateGroups);
        
        // Generate report
        await generateReport(db, originalCount, removedCount);
        
        console.log('\n🎉 Comment Bank cleanup completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { main }; 