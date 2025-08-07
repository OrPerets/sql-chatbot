const { MongoClient, ObjectId } = require('mongodb');

const uri = "mongodb+srv://orperetz:Vv123456@cluster0.zl77zt7.mongodb.net/?retryWrites=true&w=majority";

async function debugKarenDataCorruption() {
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        const db = client.db('mentor_db');
        
        const karenExamId = '6878a7e32c796f9cd66e406c';
        const questionText = 'כתוב שאילתה שמחזירה את שמות הטייסים, הדרגות שלהם, שעות הטי';
        
        console.log('🔍 INVESTIGATING DATA CORRUPTION...\n');
        
        // 1. Get Karen's exam record
        console.log('1️⃣ Checking Karen\'s finalExam record:');
        const karenExam = await db.collection("finalExams").findOne(
            { _id: new ObjectId(karenExamId) }
        );
        
        if (karenExam) {
            console.log(`   📊 Student: ${karenExam.studentName}`);
            console.log(`   📊 User ID: ${karenExam.userId}`);
            console.log(`   📊 Total mergedAnswers: ${karenExam.mergedAnswers?.length || 0}`);
            
            // Find the suspicious question
            const suspiciousAnswers = karenExam.mergedAnswers?.filter(answer => 
                answer.questionText?.includes(questionText.substring(0, 30))
            ) || [];
            
            console.log(`   🚨 Found ${suspiciousAnswers.length} answers matching this question:`);
            suspiciousAnswers.forEach((answer, index) => {
                console.log(`      Answer ${index + 1}:`);
                console.log(`        questionIndex: ${answer.questionIndex}`);
                console.log(`        sourceSession: ${answer.sourceSession}`);
                console.log(`        isCorrect: ${answer.isCorrect}`);
                console.log(`        sessionId: ${answer.sessionId}`);
                console.log(`        userId: ${answer.userId}`);
                console.log(`        questionText: "${answer.questionText?.substring(0, 50)}..."`);
            });
        }
        
        // 2. Check if this question should exist for Karen in examSessions
        console.log('\n2️⃣ Checking Karen\'s examSessions:');
        const karenSessions = await db.collection("examSessions").find(
            { userId: karenExam?.userId }
        ).toArray();
        
        console.log(`   📊 Found ${karenSessions.length} sessions for Karen`);
        
        for (const session of karenSessions) {
            const matchingAnswers = session.answers?.filter(answer => 
                answer.questionText?.includes(questionText.substring(0, 30))
            ) || [];
            
            if (matchingAnswers.length > 0) {
                console.log(`   ✅ Session ${session._id} has ${matchingAnswers.length} matching answers`);
                matchingAnswers.forEach(answer => {
                    console.log(`      questionId: ${answer.questionId}, isCorrect: ${answer.isCorrect}`);
                });
            }
        }
        
        // 3. Find WHO else has this question to see if data got mixed up
        console.log('\n3️⃣ Checking WHO ELSE has this specific question:');
        const othersWithQuestion = await db.collection("finalExams").find({
            "mergedAnswers.questionText": { $regex: questionText.substring(0, 30), $options: "i" }
        }).toArray();
        
        console.log(`   📊 Found ${othersWithQuestion.length} students with this question:`);
        othersWithQuestion.forEach(exam => {
            const matchingAnswers = exam.mergedAnswers?.filter(answer => 
                answer.questionText?.includes(questionText.substring(0, 30))
            ) || [];
            console.log(`      ${exam.studentName} (${exam.userId}): ${matchingAnswers.length} answers`);
        });
        
        // 4. Check if Karen's userId appears in other students' answers (DATA MIXING!)
        console.log('\n4️⃣ CRITICAL: Checking for data mixing (Karen\'s userId in other exams):');
        const dataCorruption = await db.collection("finalExams").find({
            "mergedAnswers.userId": karenExam?.userId,
            "_id": { $ne: new ObjectId(karenExamId) }
        }).toArray();
        
        if (dataCorruption.length > 0) {
            console.log(`   🚨 CORRUPTION FOUND! Karen's userId appears in ${dataCorruption.length} other exams:`);
            dataCorruption.forEach(exam => {
                console.log(`      💀 ${exam.studentName} (${exam._id}) contains Karen's answers!`);
            });
        } else {
            console.log('   ✅ No data mixing found (Karen\'s userId not in other exams)');
        }
        
        console.log('\n🎯 CONCLUSION:');
        console.log('If Karen has a question she shouldn\'t have, possible causes:');
        console.log('1. 📝 Question assignment error during exam generation');
        console.log('2. 💀 Data mixing between students during mergedAnswers creation');
        console.log('3. 🔀 Session merging gone wrong');
        console.log('4. 📊 Different exam versions with different question sets');
        
    } catch (error) {
        console.error('❌ Error investigating data corruption:', error);
    } finally {
        await client.close();
    }
}

debugKarenDataCorruption();