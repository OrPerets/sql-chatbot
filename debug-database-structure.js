const { MongoClient } = require('mongodb');

async function debugDatabaseStructure() {
  // Use the same connection string as the mentor-server
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    console.log('🔍 מתחבר למסד נתונים ובודק מבנה...\n');
    
    await client.connect();
    
    // Check database names
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    console.log('📊 מסדי נתונים זמינים:');
    dbs.databases.forEach(db => {
      console.log(`   - ${db.name} (${Math.round(db.sizeOnDisk / 1024 / 1024)} MB)`);
    });
    
    // Try different possible database names
    const possibleDbNames = ['sql_mentor', 'sqlmentor', 'SQL_mentor', 'test'];
    
    for (const dbName of possibleDbNames) {
      console.log(`\n🔍 בודק מסד נתונים: ${dbName}`);
      try {
        const db = client.db(dbName);
        const collections = await db.listCollections().toArray();
        
        if (collections.length > 0) {
          console.log(`✅ נמצאו ${collections.length} אוספים ב-${dbName}:`);
          
          for (const collection of collections) {
            const collectionName = collection.name;
            console.log(`   📁 ${collectionName}`);
            
            try {
              const count = await db.collection(collectionName).countDocuments();
              console.log(`      📊 ${count} מסמכים`);
              
              // Check for relevant collections
              if (collectionName === 'finalExams' || collectionName === 'examGrades') {
                console.log(`      🔍 בודק מבנה של ${collectionName}...`);
                
                // Get a sample document
                const sample = await db.collection(collectionName).findOne();
                if (sample) {
                  console.log(`      📋 מבנה לדוגמה:`);
                  console.log(`         _id: ${sample._id}`);
                  
                  if (collectionName === 'finalExams') {
                    console.log(`         studentId: ${sample.studentId || 'לא קיים'}`);
                    console.log(`         review: ${sample.review ? 'קיים' : 'לא קיים'}`);
                    if (sample.review) {
                      console.log(`         review.questionGrades: ${sample.review.questionGrades ? sample.review.questionGrades.length + ' שאלות' : 'לא קיים'}`);
                      console.log(`         review.totalScore: ${sample.review.totalScore || 'לא קיים'}`);
                    }
                  }
                  
                  if (collectionName === 'examGrades') {
                    console.log(`         examId: ${sample.examId || 'לא קיים'}`);
                    console.log(`         questionGrades: ${sample.questionGrades ? sample.questionGrades.length + ' שאלות' : 'לא קיים'}`);
                    console.log(`         totalScore: ${sample.totalScore || 'לא קיים'}`);
                  }
                  
                  // Show questionGrades structure if exists
                  let questionGrades = null;
                  if (collectionName === 'finalExams' && sample.review && sample.review.questionGrades) {
                    questionGrades = sample.review.questionGrades;
                  } else if (collectionName === 'examGrades' && sample.questionGrades) {
                    questionGrades = sample.questionGrades;
                  }
                  
                  if (questionGrades && questionGrades.length > 0) {
                    const firstGrade = questionGrades[0];
                    console.log(`      📝 דוגמה לציון שאלה:`);
                    console.log(`         questionIndex: ${firstGrade.questionIndex}`);
                    console.log(`         score: ${firstGrade.score}`);
                    console.log(`         maxScore: ${firstGrade.maxScore}`);
                    console.log(`         feedback: "${firstGrade.feedback || 'לא קיים'}"`);
                    console.log(`         gradedAt: ${firstGrade.gradedAt || 'לא קיים'}`);
                  }
                }
              }
            } catch (err) {
              console.log(`      ❌ שגיאה בספירת מסמכים: ${err.message}`);
            }
          }
        } else {
          console.log(`   ❌ אין אוספים ב-${dbName}`);
        }
      } catch (err) {
        console.log(`   ❌ שגיאה בגישה ל-${dbName}: ${err.message}`);
      }
    }
    
    console.log('\n🏁 סיום בדיקת מבנה מסד נתונים');
    
  } catch (error) {
    console.error('❌ שגיאה כללית:', error);
  } finally {
    await client.close();
  }
}

// הרצה
debugDatabaseStructure();