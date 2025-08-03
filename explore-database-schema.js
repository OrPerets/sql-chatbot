#!/usr/bin/env node
/**
 * DATABASE SCHEMA EXPLORER
 * 
 * This script explores the "experiment" database to understand the actual
 * structure of collections and documents, so we can fix the cheat detection code.
 */

const { MongoClient } = require('mongodb');

const CONFIG = {
  mongoURL: "mongodb+srv://sql-admin:SMff5PqhhoVbX6z7@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor",
  databaseName: "experiment"
};

async function exploreDatabase() {
  console.log('🔍 EXPLORING DATABASE SCHEMA...');
  console.log('📊 Database:', CONFIG.databaseName);
  console.log('=' * 60);

  const client = new MongoClient(CONFIG.mongoURL);
  await client.connect();
  const db = client.db(CONFIG.databaseName);

  try {
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`📚 Found ${collections.length} collections:`);
    collections.forEach(col => console.log(`   - ${col.name}`));
    console.log('');

    // Explore each collection
    for (const collection of collections) {
      const collectionName = collection.name;
      console.log(`\n🔍 EXPLORING COLLECTION: ${collectionName}`);
      console.log('=' * 50);

      try {
        // Get collection stats
        const count = await db.collection(collectionName).countDocuments();
        console.log(`📊 Document count: ${count}`);

        if (count === 0) {
          console.log('⚠️ Collection is empty');
          continue;
        }

        // Get sample documents
        const samples = await db.collection(collectionName)
          .find({})
          .limit(3)
          .toArray();

        console.log(`📄 Sample documents (showing ${samples.length}):`);

        samples.forEach((doc, index) => {
          console.log(`\n--- Sample ${index + 1} ---`);
          
          // Show document structure
          const structure = analyzeDocumentStructure(doc);
          console.log('🏗️ Structure:', structure);

          // Show sample values for key fields
          const importantFields = ['_id', 'studentEmail', 'examId', 'answers', 'status', 'studentAnswer', 'questionText'];
          console.log('🔑 Key fields:');
          importantFields.forEach(field => {
            if (doc.hasOwnProperty(field)) {
              let value = doc[field];
              if (typeof value === 'string' && value.length > 100) {
                value = value.substring(0, 100) + '...';
              } else if (Array.isArray(value)) {
                value = `Array(${value.length}) - ${value.length > 0 ? 'sample: ' + JSON.stringify(value[0]).substring(0, 100) : 'empty'}`;
              } else if (typeof value === 'object' && value !== null) {
                value = `Object with keys: [${Object.keys(value).slice(0, 5).join(', ')}]`;
              }
              console.log(`   ${field}: ${JSON.stringify(value)}`);
            }
          });
        });

        // Special analysis for collections that might contain exam answers
        if (collectionName.toLowerCase().includes('exam') || 
            collectionName.toLowerCase().includes('answer')) {
          console.log('\n🎯 EXAM/ANSWER ANALYSIS:');
          
          // Check for documents with answers array
          const withAnswers = await db.collection(collectionName)
            .find({ answers: { $exists: true, $type: 'array' } })
            .limit(1)
            .toArray();

          if (withAnswers.length > 0) {
            console.log('✅ Found documents with answers array!');
            const answersDoc = withAnswers[0];
            if (answersDoc.answers && answersDoc.answers.length > 0) {
              console.log(`📝 Answers array length: ${answersDoc.answers.length}`);
              console.log('📋 First answer structure:', analyzeDocumentStructure(answersDoc.answers[0]));
              console.log('📄 Sample answer content:');
              const firstAnswer = answersDoc.answers[0];
              Object.keys(firstAnswer).slice(0, 10).forEach(key => {
                let value = firstAnswer[key];
                if (typeof value === 'string' && value.length > 150) {
                  value = value.substring(0, 150) + '...';
                }
                console.log(`   ${key}: ${JSON.stringify(value)}`);
              });
            }
          } else {
            console.log('❌ No documents found with answers array');
          }

          // Check for individual answer documents
          const potentialAnswerFields = ['studentAnswer', 'answer', 'response'];
          for (const field of potentialAnswerFields) {
            const count = await db.collection(collectionName)
              .countDocuments({ [field]: { $exists: true } });
            if (count > 0) {
              console.log(`✅ Found ${count} documents with field: ${field}`);
            }
          }
        }

      } catch (error) {
        console.error(`❌ Error exploring collection ${collectionName}:`, error.message);
      }
    }

    console.log('\n' + '=' * 60);
    console.log('🎯 SUMMARY & RECOMMENDATIONS:');
    
    // Look for the most promising collections for exam answers
    const examCollections = collections.filter(col => 
      col.name.toLowerCase().includes('exam') || 
      col.name.toLowerCase().includes('answer')
    );
    
    console.log(`📚 Exam-related collections found: ${examCollections.map(c => c.name).join(', ')}`);
    
    if (examCollections.length > 0) {
      console.log('\n💡 Next steps:');
      console.log('1. Review the structures above');
      console.log('2. Identify which collection contains the actual answers');
      console.log('3. Update the cheat detection script accordingly');
    }

  } catch (error) {
    console.error('❌ Database exploration failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

function analyzeDocumentStructure(doc, maxDepth = 2, currentDepth = 0) {
  if (currentDepth >= maxDepth || doc === null || typeof doc !== 'object') {
    return typeof doc;
  }

  if (Array.isArray(doc)) {
    if (doc.length === 0) return 'Array(empty)';
    return `Array(${doc.length}) of ${analyzeDocumentStructure(doc[0], maxDepth, currentDepth + 1)}`;
  }

  const structure = {};
  Object.keys(doc).slice(0, 15).forEach(key => { // Limit to first 15 keys
    structure[key] = analyzeDocumentStructure(doc[key], maxDepth, currentDepth + 1);
  });

  return structure;
}

// Run the exploration
if (require.main === module) {
  exploreDatabase()
    .then(() => {
      console.log('\n🎉 Database schema exploration completed!');
      console.log('📝 Use this information to update run-cheat-detection-locally.js');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Exploration failed:', error);
      process.exit(1);
    });
}