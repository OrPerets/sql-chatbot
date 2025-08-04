const DEBUG_STUDENT_ID = "211994348"; // דון תירוש (Don Tirosh)
const DEBUG_STUDENT_NAME = "תירוש דון";

console.log(`🔍 Debugging grade discrepancy for student: ${DEBUG_STUDENT_NAME} (ID: ${DEBUG_STUDENT_ID})`);
console.log(`📊 Expected: Table=37, Inside Exam=43, CSV=37`);
console.log(`\n=== INVESTIGATION PLAN ===`);
console.log(`1. Find this student's exam ID(s)`);
console.log(`2. Check both grade API endpoints: /api/admin/final-exam/{examId}/grade and /api/admin/exam/{examId}/grade`);
console.log(`3. Check the raw exam data: finalExams vs examSessions collections`);
console.log(`4. Compare individual question grades vs saved total scores`);
console.log(`5. Identify the authoritative source and sync if needed`);

// Configuration
const SERVER_BASE = process.env.SERVER_BASE || "https://mentor-server-theta.vercel.app";

async function findStudentExams() {
    console.log(`\n🔍 Step 1: Finding exams for student ${DEBUG_STUDENT_NAME}...`);
    
    try {
        // Check final exams
        const finalExamsResponse = await fetch(`${SERVER_BASE}/admin/final-exams`);
        const finalExamsData = await finalExamsResponse.json();
        const finalExams = finalExamsData.exams || finalExamsData;
        
        const studentFinalExams = finalExams.filter(exam => 
            exam.studentId === DEBUG_STUDENT_ID || 
            exam.studentName === DEBUG_STUDENT_NAME
        );
        
        console.log(`📋 Found ${studentFinalExams.length} final exams for this student`);
        studentFinalExams.forEach((exam, i) => {
            console.log(`   ${i+1}. Exam ID: ${exam._id}`);
            console.log(`      Student: ${exam.studentName} (${exam.studentId})`);
            console.log(`      Status: ${exam.status || 'unknown'}`);
            console.log(`      Graded: ${exam.graded || false}`);
            if (exam.review) {
                console.log(`      Review Total Score: ${exam.review.totalScore || 'undefined'}`);
                console.log(`      Review Max Score: ${exam.review.maxScore || 'undefined'}`);
                console.log(`      Review Percentage: ${exam.review.percentage || 'undefined'}`);
            }
            console.log("");
        });
        
        // Check regular exam sessions
        const examSessionsResponse = await fetch(`${SERVER_BASE}/admin/exam-sessions`);
        const examSessionsData = await examSessionsResponse.json();
        const examSessions = examSessionsData.exams || examSessionsData;
        
        const studentExamSessions = examSessions.filter(exam => 
            exam.studentId === DEBUG_STUDENT_ID || 
            exam.studentName === DEBUG_STUDENT_NAME
        );
        
        console.log(`📋 Found ${studentExamSessions.length} regular exam sessions for this student`);
        studentExamSessions.forEach((exam, i) => {
            console.log(`   ${i+1}. Exam ID: ${exam._id}`);
            console.log(`      Student: ${exam.studentName} (${exam.studentId})`);
            console.log(`      Status: ${exam.status || 'unknown'}`);
            console.log(`      Score: ${exam.score || 'undefined'}`);
            console.log("");
        });
        
        return [...studentFinalExams, ...studentExamSessions];
        
    } catch (error) {
        console.error("❌ Error finding student exams:", error);
        return [];
    }
}

async function checkGradeEndpoints(examId) {
    console.log(`\n🔍 Step 2: Checking grade endpoints for exam ${examId}...`);
    
    // Check final-exam grade endpoint
    try {
        const finalExamGradeResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/grade`);
        if (finalExamGradeResponse.ok) {
            const gradeData = await finalExamGradeResponse.json();
            console.log(`✅ Final-exam grade endpoint responded:`);
            console.log(`   Data Source: ${gradeData.dataSource || 'unknown'}`);
            console.log(`   Total Score: ${gradeData.totalScore}`);
            console.log(`   Max Score: ${gradeData.maxScore}`);
            console.log(`   Percentage: ${gradeData.percentage}`);
            console.log(`   Question Grades: ${gradeData.questionGrades?.length || 0} items`);
            if (gradeData.questionGrades?.length > 0) {
                const individualTotal = gradeData.questionGrades.reduce((sum, qg) => sum + qg.score, 0);
                console.log(`   ⚠️  Individual question grades sum: ${individualTotal}`);
                if (individualTotal !== gradeData.totalScore) {
                    console.log(`   🚨 DISCREPANCY: Individual sum (${individualTotal}) ≠ Total Score (${gradeData.totalScore})`);
                }
            }
        } else {
            console.log(`❌ Final-exam grade endpoint failed: ${finalExamGradeResponse.status}`);
        }
    } catch (error) {
        console.log(`❌ Error checking final-exam grade endpoint:`, error.message);
    }
    
    // Check regular exam grade endpoint
    try {
        const examGradeResponse = await fetch(`${SERVER_BASE}/admin/exam/${examId}/grade`);
        if (examGradeResponse.ok) {
            const gradeData = await examGradeResponse.json();
            console.log(`✅ Regular exam grade endpoint responded:`);
            console.log(`   Data Source: ${gradeData.dataSource || 'unknown'}`);
            console.log(`   Total Score: ${gradeData.totalScore}`);
            console.log(`   Max Score: ${gradeData.maxScore}`);
            console.log(`   Percentage: ${gradeData.percentage}`);
            console.log(`   Question Grades: ${gradeData.questionGrades?.length || 0} items`);
            if (gradeData.questionGrades?.length > 0) {
                const individualTotal = gradeData.questionGrades.reduce((sum, qg) => sum + qg.score, 0);
                console.log(`   ⚠️  Individual question grades sum: ${individualTotal}`);
                if (individualTotal !== gradeData.totalScore) {
                    console.log(`   🚨 DISCREPANCY: Individual sum (${individualTotal}) ≠ Total Score (${gradeData.totalScore})`);
                }
            }
        } else {
            console.log(`❌ Regular exam grade endpoint failed: ${examGradeResponse.status}`);
        }
    } catch (error) {
        console.log(`❌ Error checking regular exam grade endpoint:`, error.message);
    }
}

async function debugStudent() {
    console.log(`\n🔍 Starting comprehensive grade investigation...`);
    
    const exams = await findStudentExams();
    
    if (exams.length === 0) {
        console.log(`❌ No exams found for student ${DEBUG_STUDENT_NAME}`);
        return;
    }
    
    for (const exam of exams) {
        await checkGradeEndpoints(exam._id);
    }
    
    console.log(`\n=== FINDINGS SUMMARY ===`);
    console.log(`📊 Found ${exams.length} exam(s) for student ${DEBUG_STUDENT_NAME}`);
    console.log(`🔍 Check the output above for any discrepancies between:`);
    console.log(`   - Individual question grades sum vs Total Score`);
    console.log(`   - Final-exam endpoint vs Regular exam endpoint`);
    console.log(`   - Saved data vs what should be calculated`);
    console.log(`\n💡 RECOMMENDED ACTIONS:`);
    console.log(`   1. If individual sum ≠ total score: Need to resave/sync grades`);
    console.log(`   2. If endpoints disagree: Need unified grade sync`);
    console.log(`   3. If no grade data found: Need to check database directly`);
}

// Run the debugging
if (require.main === module) {
    debugStudent().catch(console.error);
}

module.exports = { debugStudent, findStudentExams, checkGradeEndpoints };