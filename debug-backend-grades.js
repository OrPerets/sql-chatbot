const { MongoClient } = require('mongodb');

async function debugBackendGrades() {
  console.log('🔍 Deep debugging backend grades issue...\n');
  
  const examId = '6878a7e32c796f9cd66e406c';
  
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    await client.connect();
    const db = client.db('experiment');
    const { ObjectId } = require('mongodb');
    
    console.log('1️⃣ Checking finalExams.review.questionGrades directly...');
    const finalExam = await db.collection("finalExams").findOne({ _id: new ObjectId(examId) });
    
    if (finalExam) {
      console.log('✅ Found finalExam');
      
      if (finalExam.review) {
        console.log('✅ Has review object');
        
        if (finalExam.review.questionGrades) {
          console.log(`✅ Has questionGrades: ${finalExam.review.questionGrades.length} items`);
          
          console.log('📊 Grade details:');
          finalExam.review.questionGrades.forEach(grade => {
            console.log(`   questionIndex ${grade.questionIndex}: ${grade.score}/${grade.maxScore}`);
          });
          
        } else {
          console.log('❌ No questionGrades in review');
        }
      } else {
        console.log('❌ No review object');
      }
    } else {
      console.log('❌ No finalExam found');
    }
    
    console.log('\n2️⃣ Checking examGrades collection...');
    const examGrade = await db.collection("examGrades").findOne({ examId: examId });
    
    if (examGrade) {
      console.log('✅ Found examGrade');
      if (examGrade.questionGrades) {
        console.log(`✅ Has questionGrades: ${examGrade.questionGrades.length} items`);
      } else {
        console.log('❌ No questionGrades in examGrade');
      }
    } else {
      console.log('❌ No examGrade found');
    }
    
    console.log('\n3️⃣ Testing the exact backend logic...');
    
    // Simulate the exact backend logic
    let existingGrades = null;
    
    // Step 1: Check finalExams first (new logic)
    if (finalExam?.review?.questionGrades && finalExam.review.questionGrades.length > 0) {
      existingGrades = finalExam.review.questionGrades;
      console.log(`✅ Would load ${finalExam.review.questionGrades.length} grades from finalExams.review`);
    } else {
      console.log('❌ finalExams.review.questionGrades failed the check');
      
      // Debug why it failed
      console.log('🔍 Debug finalExams check:');
      console.log(`   finalExam exists: ${!!finalExam}`);
      console.log(`   finalExam.review exists: ${!!finalExam?.review}`);
      console.log(`   finalExam.review.questionGrades exists: ${!!finalExam?.review?.questionGrades}`);
      console.log(`   finalExam.review.questionGrades.length: ${finalExam?.review?.questionGrades?.length}`);
      console.log(`   Length > 0: ${finalExam?.review?.questionGrades?.length > 0}`);
      
      // Step 2: Check examGrades (fallback)
      if (examGrade?.questionGrades) {
        existingGrades = examGrade.questionGrades;
        console.log(`✅ Would load ${examGrade.questionGrades.length} grades from examGrades`);
      } else {
        console.log('❌ examGrades fallback also failed');
      }
    }
    
    if (existingGrades) {
      console.log('\n🎉 Backend should return these grades:');
      existingGrades.forEach(grade => {
        console.log(`   questionIndex ${grade.questionIndex}: ${grade.score}/${grade.maxScore}`);
      });
    } else {
      console.log('\n❌ Backend logic would return NO grades - this is the bug!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

debugBackendGrades();