const { MongoClient } = require('mongodb');

async function checkExperimentDatabase() {
  // Use the same connection string as the mentor-server
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    console.log('🔍 בודק מסד נתונים experiment...\n');
    
    await client.connect();
    const db = client.db('experiment');
    
    const collections = await db.listCollections().toArray();
    console.log(`✅ נמצאו ${collections.length} אוספים ב-experiment:`);
    
    for (const collection of collections) {
      const collectionName = collection.name;
      const count = await db.collection(collectionName).countDocuments();
      console.log(`\n📁 ${collectionName} (${count} מסמכים)`);
      
      // Check for exam-related collections
      if (collectionName.toLowerCase().includes('exam') || 
          collectionName.toLowerCase().includes('final') ||
          collectionName.toLowerCase().includes('grade')) {
        
        console.log(`   🔍 בודק מבנה של ${collectionName}...`);
        
        // Get a sample document
        const sample = await db.collection(collectionName).findOne();
        if (sample) {
          console.log(`   📋 מבנה לדוגמה:`);
          Object.keys(sample).forEach(key => {
            const value = sample[key];
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              console.log(`      ${key}: אובייקט עם ${Object.keys(value).length} שדות`);
              if (key === 'review' && value.questionGrades) {
                console.log(`         questionGrades: ${value.questionGrades.length} שאלות`);
                if (value.questionGrades.length > 0) {
                  const firstGrade = value.questionGrades[0];
                  console.log(`         דוגמה: שאלה ${firstGrade.questionIndex}, ציון ${firstGrade.score}/${firstGrade.maxScore}`);
                  console.log(`         הערה: "${firstGrade.feedback || 'לא קיים'}"`);
                }
              }
            } else if (Array.isArray(value)) {
              console.log(`      ${key}: מערך עם ${value.length} פריטים`);
              if (key === 'questionGrades' && value.length > 0) {
                const firstGrade = value[0];
                console.log(`         דוגמה: שאלה ${firstGrade.questionIndex}, ציון ${firstGrade.score}/${firstGrade.maxScore}`);
                console.log(`         הערה: "${firstGrade.feedback || 'לא קיים'}"`);
              }
            } else {
              const displayValue = typeof value === 'string' && value.length > 50 
                ? value.substring(0, 50) + '...' 
                : value;
              console.log(`      ${key}: ${displayValue}`);
            }
          });
        }
      }
    }
    
    console.log('\n🏁 סיום בדיקה');
    
  } catch (error) {
    console.error('❌ שגיאה:', error);
  } finally {
    await client.close();
  }
}

// הרצה
checkExperimentDatabase();