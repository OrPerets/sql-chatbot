const { MongoClient } = require('mongodb');

// MongoDB connection configuration
const dbUserName = "sql-admin";
const dbPassword = "SMff5PqhhoVbX6z7";
const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
const DATABASE_NAME = 'experiment';
const COLLECTION_NAME = 'questions';

// SQL Syntax validation helper
function validateSQLSyntax(sql) {
  const issues = [];
  
  // Basic SQL syntax checks
  if (!sql.trim().endsWith(';')) {
    issues.push('Missing semicolon at end');
  }
  
  // Check for basic SQL keywords
  const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'ORDER BY', 'HAVING'];
  const upperSql = sql.toUpperCase();
  
  if (!upperSql.includes('SELECT') && !sql.includes('σ') && !sql.includes('π')) {
    issues.push('Missing SELECT statement or algebra operator');
  }
  
  if (upperSql.includes('SELECT') && !upperSql.includes('FROM') && !sql.includes('(')) {
    issues.push('SELECT without FROM clause');
  }
  
  // Check for balanced parentheses
  const openParen = (sql.match(/\(/g) || []).length;
  const closeParen = (sql.match(/\)/g) || []).length;
  if (openParen !== closeParen) {
    issues.push('Unbalanced parentheses');
  }
  
  return issues;
}

// Schema validation helper
function validateAgainstSchema(sql, expectedKeywords) {
  const issues = [];
  const upperSql = sql.toUpperCase();
  
  // Valid table names from our schema
  const validTables = ['AIRBASES', 'SQUADRONS', 'PILOTS', 'AIRCRAFT', 'WEAPONS', 'MISSIONS', 'MAINTENANCE'];
  
  // Check if SQL uses valid table names
  if (upperSql.includes('FROM') || upperSql.includes('JOIN')) {
    const foundValidTable = validTables.some(table => upperSql.includes(table));
    if (!foundValidTable && !sql.includes('σ') && !sql.includes('π')) {
      issues.push('No valid table names found');
    }
  }
  
  // Check if expected keywords are present
  if (expectedKeywords && expectedKeywords.length > 0) {
    const missingKeywords = expectedKeywords.filter(keyword => {
      return !upperSql.includes(keyword.toUpperCase()) && !sql.includes(keyword);
    });
    
    if (missingKeywords.length > 0) {
      issues.push(`Missing expected keywords: ${missingKeywords.join(', ')}`);
    }
  }
  
  return issues;
}

// Main verification function
async function verifyQuestionSolutions() {
  let client;
  let validCount = 0;
  let issueCount = 0;
  const detailedResults = [];

  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(connectionString);
    await client.connect();
    console.log('✅ Connected to MongoDB successfully!');

    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Fetch a sample of questions to verify
    console.log('📖 Fetching updated questions for verification...');
    const sampleQuestions = await collection.find({})
      .sort({ id: 1 })
      .limit(20) // Check first 20 questions
      .toArray();
    
    console.log(`📊 Verifying ${sampleQuestions.length} questions...\n`);

    for (const question of sampleQuestions) {
      const result = {
        id: question.id,
        question: question.question.substring(0, 80) + '...',
        solution: question.solution_example,
        syntaxIssues: [],
        schemaIssues: [],
        isValid: true
      };

      // Validate SQL syntax
      result.syntaxIssues = validateSQLSyntax(question.solution_example || '');
      
      // Validate against schema
      result.schemaIssues = validateAgainstSchema(
        question.solution_example || '', 
        question.expected_keywords || []
      );

      // Overall validation
      result.isValid = result.syntaxIssues.length === 0 && result.schemaIssues.length === 0;

      if (result.isValid) {
        validCount++;
        console.log(`✅ Question ${question.id}: Valid`);
      } else {
        issueCount++;
        console.log(`❌ Question ${question.id}: Issues found`);
        if (result.syntaxIssues.length > 0) {
          console.log(`   Syntax issues: ${result.syntaxIssues.join(', ')}`);
        }
        if (result.schemaIssues.length > 0) {
          console.log(`   Schema issues: ${result.schemaIssues.join(', ')}`);
        }
        console.log(`   Solution: ${result.solution}`);
      }

      detailedResults.push(result);
    }

    // Summary
    console.log('\n🎉 Verification completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Questions verified: ${sampleQuestions.length}`);
    console.log(`   - Valid solutions: ${validCount}`);
    console.log(`   - Solutions with issues: ${issueCount}`);
    console.log(`   - Success rate: ${((validCount / sampleQuestions.length) * 100).toFixed(1)}%`);

    // Show examples of valid solutions
    console.log('\n✨ Examples of generated solutions:');
    const validExamples = detailedResults.filter(r => r.isValid).slice(0, 5);
    validExamples.forEach(example => {
      console.log(`\n📝 Question ${example.id}:`);
      console.log(`   Question: ${example.question}`);
      console.log(`   Solution: ${example.solution}`);
    });

    return {
      totalVerified: sampleQuestions.length,
      validCount,
      issueCount,
      successRate: (validCount / sampleQuestions.length) * 100,
      detailedResults
    };

  } catch (error) {
    console.error('💥 Fatal error during verification:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Execute verification
if (require.main === module) {
  verifyQuestionSolutions()
    .then(results => {
      console.log(`\n🎯 Final Results: ${results.validCount}/${results.totalVerified} questions have valid solutions (${results.successRate.toFixed(1)}%)`);
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyQuestionSolutions }; 