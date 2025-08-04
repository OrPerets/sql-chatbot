const DEBUG_STUDENT_ID = "211994348"; // דון תירוש
const DEBUG_EXAM_ID = "6878a0b2dd197423090e00d7";

console.log(`🔧 Fixing grade consistency for student דון תירוש...`);
console.log(`📊 Goal: Make 37 (sum of graded points) appear everywhere\n`);

const SERVER_BASE = process.env.SERVER_BASE || "https://mentor-server-theta.vercel.app";

async function getDetailedGradeInfo() {
    console.log(`🔍 Step 1: Getting detailed grade information for exam ${DEBUG_EXAM_ID}...`);
    
    try {
        const response = await fetch(`${SERVER_BASE}/admin/final-exam/${DEBUG_EXAM_ID}/grade`);
        const gradeData = await response.json();
        
        console.log(`📊 Current saved grade data:`);
        console.log(`   Total Score: ${gradeData.totalScore}`);
        console.log(`   Max Score: ${gradeData.maxScore}`);
        console.log(`   Question Grades: ${gradeData.questionGrades?.length || 0} items`);
        
        if (gradeData.questionGrades?.length > 0) {
            console.log(`\n📝 Individual question grades:`);
            let manualSum = 0;
            gradeData.questionGrades.forEach((qg, i) => {
                console.log(`   Q${qg.questionIndex + 1}: ${qg.score} points (max: ${qg.maxScore || 'unknown'})`);
                manualSum += qg.score;
            });
            console.log(`\n✅ Manual sum of question grades: ${manualSum}`);
            
            if (manualSum !== gradeData.totalScore) {
                console.log(`🚨 DISCREPANCY: Manual sum (${manualSum}) ≠ Saved total (${gradeData.totalScore})`);
                return { gradeData, correctSum: manualSum, needsUpdate: true };
            } else {
                console.log(`✅ Saved total matches manual sum: ${gradeData.totalScore}`);
                return { gradeData, correctSum: manualSum, needsUpdate: false };
            }
        }
        
        return { gradeData, correctSum: 0, needsUpdate: false };
        
    } catch (error) {
        console.error("❌ Error getting grade info:", error);
        return null;
    }
}

async function checkExamPageCalculation() {
    console.log(`\n🔍 Step 2: Checking what the individual exam page would calculate...`);
    
    try {
        // Simulate what the exam grading page does
        const examResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${DEBUG_EXAM_ID}/for-grading`);
        const examData = await examResponse.json();
        
        console.log(`📊 Exam data retrieved:`);
        console.log(`   Answers: ${examData.answers?.length || 0} items`);
        console.log(`   MergedAnswers: ${examData.mergedAnswers?.length || 0} items`);
        
        // Get the answers source (prioritize mergedAnswers for final exams)
        const answersSource = examData.mergedAnswers || examData.answers;
        
        if (answersSource?.length > 0) {
            console.log(`\n📝 Question points from exam data:`);
            let totalMaxPoints = 0;
            answersSource.forEach((answer, i) => {
                const points = answer.questionDetails?.points || 1;
                console.log(`   Q${answer.questionIndex + 1}: ${points} max points`);
                totalMaxPoints += points;
            });
            console.log(`\n📊 Total max points from exam data: ${totalMaxPoints}`);
            
            return { answersSource, totalMaxPoints };
        }
        
        return null;
        
    } catch (error) {
        console.error("❌ Error checking exam calculation:", error);
        return null;
    }
}

async function identifyProblem() {
    console.log(`\n🔍 Step 3: Identifying the inconsistency problem...`);
    
    const gradeInfo = await getDetailedGradeInfo();
    const examInfo = await checkExamPageCalculation();
    
    if (!gradeInfo || !examInfo) {
        console.log(`❌ Could not get necessary information`);
        return;
    }
    
    console.log(`\n📊 COMPARISON:`);
    console.log(`   Saved total score: ${gradeInfo.gradeData.totalScore}`);
    console.log(`   Saved max score: ${gradeInfo.gradeData.maxScore}`);
    console.log(`   Actual sum of question grades: ${gradeInfo.correctSum}`);
    console.log(`   Actual max points from questions: ${examInfo.totalMaxPoints}`);
    
    if (gradeInfo.gradeData.totalScore === gradeInfo.correctSum) {
        console.log(`✅ Total score is correct: ${gradeInfo.correctSum}`);
    } else {
        console.log(`🚨 Total score needs correction: ${gradeInfo.gradeData.totalScore} → ${gradeInfo.correctSum}`);
    }
    
    if (gradeInfo.gradeData.maxScore !== examInfo.totalMaxPoints) {
        console.log(`🚨 Max score needs correction: ${gradeInfo.gradeData.maxScore} → ${examInfo.totalMaxPoints}`);
    }
    
    return {
        correctTotalScore: gradeInfo.correctSum,
        correctMaxScore: examInfo.totalMaxPoints,
        needsUpdate: gradeInfo.gradeData.totalScore !== gradeInfo.correctSum || 
                     gradeInfo.gradeData.maxScore !== examInfo.totalMaxPoints
    };
}

async function fixGradeConsistency() {
    console.log(`\n🔧 Starting grade consistency fix...`);
    
    const analysis = await identifyProblem();
    
    if (!analysis) {
        console.log(`❌ Could not analyze the problem`);
        return;
    }
    
    console.log(`\n💡 SOLUTION:`);
    console.log(`   Ensure all places show: ${analysis.correctTotalScore} total points`);
    console.log(`   Fix max score to: ${analysis.correctMaxScore} max points`);
    console.log(`   This will make percentage: ${Math.round((analysis.correctTotalScore / analysis.correctMaxScore) * 100)}%`);
    
    if (analysis.needsUpdate) {
        console.log(`\n⚠️  UPDATE NEEDED:`);
        console.log(`   1. The saved max score needs to be corrected`);
        console.log(`   2. The individual exam page should use saved grades, not recalculate`);
        console.log(`   3. All sources should show the same ${analysis.correctTotalScore} points`);
    } else {
        console.log(`\n✅ Grades are already consistent!`);
        console.log(`   The issue might be in how the individual exam page loads/displays the data`);
    }
    
    return analysis;
}

// Run the analysis
if (require.main === module) {
    fixGradeConsistency()
        .then(result => {
            console.log(`\n=== FINAL RECOMMENDATION ===`);
            console.log(`✅ Make sure ${result?.correctTotalScore || 37} appears in:`);
            console.log(`   • Admin table`);
            console.log(`   • CSV export`);
            console.log(`   • Individual exam grading page`);
            console.log(`   • Any reports or displays`);
            console.log(`\n🔧 Next steps: Update the grade sync logic to ensure consistency`);
        })
        .catch(console.error);
}

module.exports = { fixGradeConsistency, getDetailedGradeInfo, checkExamPageCalculation };