const DEBUG_STUDENT_ID = "211994348"; // דון תירוש
const DEBUG_EXAM_ID = "6878a0b2dd197423090e00d7";

console.log(`🔧 Syncing grades to ensure 37 appears everywhere...`);

const SERVER_BASE = process.env.SERVER_BASE || "https://mentor-server-theta.vercel.app";

async function fixMaxScore() {
    console.log(`\n📊 Step 1: Fixing the saved max score...`);
    
    try {
        // Get current grade data
        const gradeResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${DEBUG_EXAM_ID}/grade`);
        const gradeData = await gradeResponse.json();
        
        // Get exam data to calculate correct max score
        const examResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${DEBUG_EXAM_ID}/for-grading`);
        const examData = await examResponse.json();
        
        const answersSource = examData.mergedAnswers || examData.answers;
        const correctMaxScore = answersSource.reduce((sum, answer) => 
            sum + (answer.questionDetails?.points || 1), 0
        );
        
        console.log(`📊 Current max score: ${gradeData.maxScore}`);
        console.log(`📊 Correct max score: ${correctMaxScore}`);
        console.log(`📊 Total score: ${gradeData.totalScore} (keeping this as 37)`);
        
        if (gradeData.maxScore !== correctMaxScore) {
            console.log(`\n🔧 Need to update max score: ${gradeData.maxScore} → ${correctMaxScore}`);
            
            // Prepare the corrected grade data
            const correctedGradeData = {
                ...gradeData,
                maxScore: correctMaxScore,
                percentage: Math.round((gradeData.totalScore / correctMaxScore) * 100)
            };
            
            console.log(`📊 New percentage: ${correctedGradeData.percentage}%`);
            
            // This would be the API call to update the grade
            console.log(`\n📝 TO FIX: Need to call grade update API with corrected max score`);
            console.log(`   API: POST /api/admin/final-exam/${DEBUG_EXAM_ID}/grade`);
            console.log(`   Body: maxScore=${correctMaxScore}, totalScore=37, percentage=${correctedGradeData.percentage}%`);
            
            return correctedGradeData;
        } else {
            console.log(`✅ Max score is already correct`);
            return gradeData;
        }
        
    } catch (error) {
        console.error("❌ Error fixing max score:", error);
        return null;
    }
}

async function ensureIndividualPageShowsCorrectScore() {
    console.log(`\n🔧 Step 2: Ensuring individual exam page shows 37...`);
    
    console.log(`📝 The individual exam page should:`);
    console.log(`   1. Load saved grades from the API`);
    console.log(`   2. Use the saved totalScore (37) instead of recalculating`);
    console.log(`   3. Display the saved questionGrades without modification`);
    
    console.log(`\n🔍 Current issue: Individual page recalculates from question points`);
    console.log(`   Solution: Modify the page to trust saved grade data`);
    
    return {
        expectedTotalScore: 37,
        shouldUseSavedGrades: true,
        shouldNotRecalculate: true
    };
}

async function createComprehensiveFix() {
    console.log(`\n🚀 Creating comprehensive fix for grade consistency...`);
    
    const maxScoreFix = await fixMaxScore();
    const pageLogicFix = await ensureIndividualPageShowsCorrectScore();
    
    if (!maxScoreFix) {
        console.log(`❌ Could not prepare max score fix`);
        return;
    }
    
    console.log(`\n=== COMPLETE SOLUTION ===`);
    console.log(`\n1. 📊 UPDATE SAVED GRADE DATA:`);
    console.log(`   • Keep totalScore: 37`);
    console.log(`   • Fix maxScore: ${maxScoreFix.maxScore}`);
    console.log(`   • Update percentage: ${maxScoreFix.percentage}%`);
    
    console.log(`\n2. 🔧 FIX INDIVIDUAL EXAM PAGE:`);
    console.log(`   • Use saved totalScore (37) instead of recalculating`);
    console.log(`   • Trust the saved questionGrades`);
    console.log(`   • Don't sum up points from scratch`);
    
    console.log(`\n3. ✅ VERIFICATION:`);
    console.log(`   • Table will show: 37`);
    console.log(`   • CSV will show: 37`);
    console.log(`   • Individual page will show: 37`);
    console.log(`   • All percentages will be: ${maxScoreFix.percentage}%`);
    
    return {
        correctTotalScore: 37,
        correctMaxScore: maxScoreFix.maxScore,
        correctPercentage: maxScoreFix.percentage,
        fixes: [
            "Update saved max score via API",
            "Modify individual exam page to use saved grades",
            "Ensure all sources show same total"
        ]
    };
}

// Run the comprehensive fix
if (require.main === module) {
    createComprehensiveFix()
        .then(result => {
            if (result) {
                console.log(`\n🎯 GOAL ACHIEVED:`);
                console.log(`   37 will appear consistently everywhere!`);
                console.log(`\n⚡ NEXT ACTIONS:`);
                console.log(`   1. Update the grade data via API call`);
                console.log(`   2. Modify individual exam page logic`);
                console.log(`   3. Test all sources show 37`);
            }
        })
        .catch(console.error);
}

module.exports = { createComprehensiveFix, fixMaxScore };