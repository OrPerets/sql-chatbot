console.log('🔍 INVESTIGATING Karen data corruption via API...\n');

async function debugKarenCorruption() {
    const karenExamId = '6878a7e32c796f9cd66e406c';
    const questionText = 'כתוב שאילתה שמחזירה את שמות הטייסים, הדרגות שלהם, שעות הטי';
    const SERVER_BASE = 'https://mentor-server-theta.vercel.app';
    
    try {
        console.log('1️⃣ Getting Karen\'s exam data from API...');
        
        // Get Karen's exam data
        const response = await fetch(`${SERVER_BASE}/admin/final-exam/${karenExamId}/for-grading`);
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
        }
        
        const examData = await response.json();
        console.log(`   📊 Student: ${examData.studentName}`);
        console.log(`   📊 User ID: ${examData.userId}`);
        console.log(`   📊 Total answers: ${examData.answers?.length || 0}`);
        console.log(`   📊 Total mergedAnswers: ${examData.mergedAnswers?.length || 0}`);
        
        // Look for the suspicious question
        const answersSource = examData.answers || examData.mergedAnswers || [];
        const suspiciousAnswers = answersSource.filter(answer => 
            answer.questionText?.includes(questionText.substring(0, 40))
        );
        
        console.log(`\n2️⃣ Checking for suspicious question: "${questionText.substring(0, 50)}..."`);
        console.log(`   🚨 Found ${suspiciousAnswers.length} matching answers in Karen's exam:`);
        
        suspiciousAnswers.forEach((answer, index) => {
            console.log(`\n   Answer ${index + 1}:`);
            console.log(`     questionIndex: ${answer.questionIndex}`);
            console.log(`     questionId: ${answer.questionId}`);
            console.log(`     isCorrect: ${answer.isCorrect}`);
            console.log(`     sourceSession: ${answer.sourceSession}`);
            console.log(`     sessionId: ${answer.sessionId}`);
            console.log(`     userId: ${answer.userId}`);
            console.log(`     studentAnswer: "${answer.studentAnswer?.substring(0, 50)}..."`);
            console.log(`     questionText: "${answer.questionText?.substring(0, 60)}..."`);
        });
        
        // Check grade-by-question page data for this specific question
        console.log('\n3️⃣ Checking grade-by-question data for this question...');
        
        if (suspiciousAnswers.length > 0) {
            const questionId = suspiciousAnswers[0].questionId;
            try {
                const gradeByQuestionResponse = await fetch(`${SERVER_BASE}/api/admin/unified-grade-sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ questionId: questionId })
                });
                
                if (gradeByQuestionResponse.ok) {
                    const gradeData = await gradeByQuestionResponse.json();
                    const karenEntry = gradeData.students?.find(student => 
                        student.studentName === examData.studentName || 
                        student.userId === examData.userId
                    );
                    
                    console.log(`   📊 Total students with this question: ${gradeData.students?.length || 0}`);
                    if (karenEntry) {
                        console.log(`   ✅ Karen FOUND in grade-by-question for this question`);
                        console.log(`     Score: ${karenEntry.score}, Grade: ${karenEntry.grade}`);
                    } else {
                        console.log(`   🚨 Karen NOT FOUND in grade-by-question for this question!`);
                        console.log('   💀 THIS CONFIRMS DATA CORRUPTION!');
                        
                        // Show who IS in grade-by-question for this question
                        console.log('\n   📋 Students who DO have this question in grade-by-question:');
                        gradeData.students?.slice(0, 5).forEach(student => {
                            console.log(`     - ${student.studentName} (${student.userId})`);
                        });
                    }
                } else {
                    console.log(`   ⚠️ Grade-by-question API failed: ${gradeByQuestionResponse.status}`);
                }
            } catch (gradeErr) {
                console.log(`   ❌ Error checking grade-by-question: ${gradeErr.message}`);
            }
        }
        
        console.log('\n🎯 ANALYSIS COMPLETE');
        console.log('='.repeat(60));
        
        if (suspiciousAnswers.length > 0) {
            const hasUserIdMismatch = suspiciousAnswers.some(answer => 
                answer.userId && answer.userId !== examData.userId
            );
            
            if (hasUserIdMismatch) {
                console.log('💀 CRITICAL: Found answers with different userIds in Karen\'s exam!');
                console.log('   🔧 FIX: These answers belong to other students and should be removed');
            } else {
                console.log('🤔 MYSTERY: All answers have correct userId but question shouldn\'t exist');
                console.log('   🔧 POSSIBLE CAUSES:');
                console.log('   1. Exam generation included wrong questions');
                console.log('   2. Question assignment error');
                console.log('   3. Different exam versions');
            }
        }
        
    } catch (error) {
        console.error('❌ Error investigating Karen corruption:', error.message);
    }
}

debugKarenCorruption();