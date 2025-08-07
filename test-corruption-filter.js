console.log('🧪 Testing corruption filter logic...\n');

function testCorruptionFilter() {
    // Simulate Karen's exam data
    const answers = [
        { questionIndex: 1, questionText: "Normal question", questionDetails: { points: 1 } },
        { questionIndex: 10, questionText: "כתוב שאילתה שמחזירה את שמות הטייסים", questionDetails: { points: 1 } }, // CORRUPTED
        { questionIndex: 11, questionText: "Another normal question", questionDetails: { points: 2 } },
        { questionIndex: 12, questionText: "כתוב שאילתה שמחזירה את כלי הטיס", questionDetails: { points: 1 } } // CORRUPTED
    ];
    
    const existingGrades = [
        { questionIndex: 1, score: 1 }, // Normal: 1/1
        { questionIndex: 10, score: 6 }, // CORRUPTED: 6/1 - impossible!
        { questionIndex: 11, score: 2 }, // Normal: 2/2
        { questionIndex: 12, score: 3 }  // CORRUPTED: 3/1 - impossible!
    ];
    
    console.log('📊 Input:');
    console.log(`   Answers: ${answers.length}`);
    console.log(`   Existing grades: ${existingGrades.length}`);
    
    // Apply corruption filter
    const cleanAnswers = answers.filter(answer => {
        const existingGrade = existingGrades.find(grade => 
            grade.questionIndex === answer.questionIndex
        );
        
        if (existingGrade && existingGrade.score > (answer.questionDetails?.points || 1)) {
            console.log(`🚨 DATA CORRUPTION: Filtering out answer with impossible grade: questionIndex ${answer.questionIndex} (${existingGrade.score}/${answer.questionDetails?.points || 1})`);
            console.log(`   Question: "${answer.questionText?.substring(0, 50)}..."`);
            return false; // Remove this corrupted answer completely
        }
        return true;
    });
    
    console.log(`\n🧹 CORRUPTION FILTER: ${answers.length} → ${cleanAnswers.length} answers (removed ${answers.length - cleanAnswers.length} corrupted)`);
    
    console.log('\n✅ REMAINING CLEAN ANSWERS:');
    cleanAnswers.forEach(answer => {
        const grade = existingGrades.find(g => g.questionIndex === answer.questionIndex);
        console.log(`   questionIndex ${answer.questionIndex}: ${grade?.score || 0}/${answer.questionDetails?.points || 1} - "${answer.questionText.substring(0, 30)}..."`);
    });
    
    console.log('\n🎯 RESULT: Corrupted questions will NOT appear in the interface!');
    console.log('Karen will only see questions that make sense to grade.');
}

testCorruptionFilter();