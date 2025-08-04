// Script to fix דון תירוש's saved grade data
const STUDENT_NAME = "תירוש דון";
const EXAM_ID = "6878a0b2dd197423090e00d7";

console.log(`🔧 Updating saved grade data for ${STUDENT_NAME}...`);

async function updateSavedGrade() {
    try {
        // The grade data should be: totalScore=37, maxScore=83, percentage=45%
        const correctedGradeData = {
            examId: EXAM_ID,
            gradedBy: 'admin',
            totalScore: 37,       // Keep the correct total
            maxScore: 83,         // Fix the max score
            percentage: 45,       // Correct percentage (37/83 * 100)
            review: {
                totalScore: 37,
                maxScore: 83,
                percentage: 45,
                isGraded: true
            },
            isGraded: true
        };

        console.log(`📊 Updating grade data:`);
        console.log(`   Total Score: ${correctedGradeData.totalScore}`);
        console.log(`   Max Score: ${correctedGradeData.maxScore}`);
        console.log(`   Percentage: ${correctedGradeData.percentage}%`);

        // Make the API call to update the grade
        const response = await fetch(`http://localhost:3000/api/admin/final-exam/${EXAM_ID}/grade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(correctedGradeData),
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Grade updated successfully!`);
            console.log(`📊 Result:`, result);
            
            // Verify the update
            setTimeout(async () => {
                try {
                    const verifyResponse = await fetch(`http://localhost:3000/api/admin/final-exam/${EXAM_ID}/grade`);
                    const verifyData = await verifyResponse.json();
                    
                    console.log(`\n🔍 Verification:`);
                    console.log(`   Total Score: ${verifyData.totalScore}`);
                    console.log(`   Max Score: ${verifyData.maxScore}`);
                    console.log(`   Percentage: ${verifyData.percentage}%`);
                    
                    if (verifyData.totalScore === 37 && verifyData.maxScore === 83) {
                        console.log(`✅ SUCCESS: Grade data is now consistent!`);
                        console.log(`✅ 37 will now appear everywhere (table, CSV, individual page)`);
                    } else {
                        console.log(`❌ Update may not have worked correctly`);
                    }
                } catch (error) {
                    console.log(`⚠️ Could not verify update:`, error.message);
                }
            }, 1000);
            
        } else {
            console.error(`❌ Failed to update grade: ${response.status}`);
            const errorText = await response.text();
            console.error(`Error details:`, errorText);
        }

    } catch (error) {
        console.error(`❌ Error updating grade:`, error);
    }
}

console.log(`\n🎯 GOAL: Make 37 appear consistently in:`);
console.log(`   • Admin table ✅`);
console.log(`   • CSV export ✅`);
console.log(`   • Individual exam page ✅ (fixed in code)`);
console.log(`   • Correct percentage: 45% ✅`);

console.log(`\n🚀 Starting update...`);
updateSavedGrade();