const { AdvancedCommentBankGenerator, COMPREHENSIVE_TEMPLATES, ADVANCED_SCHEMA } = require('./generate_advanced_comment_bank');

// Mock student answers for testing
const MOCK_STUDENT_ANSWERS = [
  // Question 1: Basic SELECT query
  {
    questionId: 1,
    questionText: "כתוב שאילתה שמחזירה את כל הטייסים",
    difficulty: "easy",
    answers: [
      { studentAnswer: "SELECT * FROM pilots;", isCorrect: true },
      { studentAnswer: "SELECT * FROM pilots", isCorrect: false }, // Missing semicolon
      { studentAnswer: "SELECT * FROM pilot;", isCorrect: false }, // Wrong table name
      { studentAnswer: "SELECT * FROM missionanalytics;", isCorrect: false }, // Nonexistent table
      { studentAnswer: "SELECT pilot_name FROM pilots;", isCorrect: false }, // Nonexistent column
    ]
  },
  
  // Question 2: JOIN query with trap
  {
    questionId: 2,
    questionText: "כתוב שאילתה שמחזירה את שמות הטייסים וכלי הנשק שלהם",
    difficulty: "medium",
    answers: [
      { studentAnswer: "SELECT p.first_name, w.weapon_name FROM pilots p JOIN weapons w ON p.squadron_id = w.squadron_id;", isCorrect: false }, // Weapon trap
      { studentAnswer: "SELECT p.first_name FROM pilots p;", isCorrect: false }, // Missing JOIN
      { studentAnswer: "SELECT p.first_name, w.weapon_name FROM pilots p JOIN squadrons s ON p.squadron_id = s.squadron_id JOIN airbases a ON s.base_id = a.base_id JOIN weapons w ON a.base_id = w.base_id;", isCorrect: true },
      { studentAnswer: "SELECT first_name, weapon_name FROM pilots, weapons;", isCorrect: false }, // Cartesian product
      { studentAnswer: "SELECT p.salary, w.weapon_name FROM pilots p JOIN weapons w;", isCorrect: false }, // Nonexistent column
    ]
  },
  
  // Question 3: Aggregation query
  {
    questionId: 3,
    questionText: "כתוב שאילתה שמחזירה את מספר הטייסים בכל טייסת",
    difficulty: "medium",
    answers: [
      { studentAnswer: "SELECT squadron_id, COUNT(*) FROM pilots GROUP BY squadron_id;", isCorrect: true },
      { studentAnswer: "SELECT squadron_id, COUNT(*) FROM pilots;", isCorrect: false }, // Missing GROUP BY
      { studentAnswer: "SELECT s.squadron_name, COUNT(p.pilot_id) FROM squadrons s LEFT JOIN pilots p ON s.squadron_id = p.squadron_id GROUP BY s.squadron_id, s.squadron_name;", isCorrect: true },
      { studentAnswer: "SELECT COUNT(*) FROM pilots WHERE squadron_id = 'all';", isCorrect: false }, // Wrong approach
      { studentAnswer: "SELECT squadron_id, SUM(pilot_id) FROM pilots GROUP BY squadron_id;", isCorrect: false }, // Wrong aggregate function
    ]
  }
];

class CommentGeneratorTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      details: []
    };
  }

  async runTests() {
    console.log('🧪 Starting Comment Bank Generator Tests\n');
    
    // Test 1: Pattern Detection
    await this.testPatternDetection();
    
    // Test 2: Comment Generation
    await this.testCommentGeneration();
    
    // Test 3: Hebrew Template Validation
    await this.testHebrewTemplates();
    
    // Test 4: Schema Validation
    await this.testSchemaValidation();
    
    // Test 5: Score Calculation
    await this.testScoreCalculation();
    
    this.printTestResults();
  }

  async testPatternDetection() {
    console.log('🔍 Testing Pattern Detection...');
    
    const generator = new AdvancedCommentBankGenerator();
    
    // Test nonexistent table detection
    const answers1 = [
      { studentAnswer: "SELECT * FROM missionanalytics;", isCorrect: false },
      { studentAnswer: "SELECT * FROM pilots;", isCorrect: true }
    ];
    
    const patterns1 = generator.performAdvancedPatternDetection(answers1, { questionText: "Test question" });
    
    this.assert(
      patterns1.nonexistentTables.length === 1,
      "Should detect 1 nonexistent table",
      `Found ${patterns1.nonexistentTables.length} nonexistent tables`
    );
    
    // Test weapon trap detection
    const answers2 = [
      { studentAnswer: "SELECT * FROM weapons w JOIN squadrons s ON w.squadron_id = s.squadron_id;", isCorrect: false },
      { studentAnswer: "SELECT * FROM weapons;", isCorrect: true }
    ];
    
    const patterns2 = generator.performAdvancedPatternDetection(answers2, { questionText: "Test question" });
    
    this.assert(
      patterns2.weaponTrapUsage.length === 1,
      "Should detect weapon.squadron_id trap",
      `Found ${patterns2.weaponTrapUsage.length} weapon trap usages`
    );
    
    console.log('✅ Pattern Detection tests completed\n');
  }

  async testCommentGeneration() {
    console.log('💬 Testing Comment Generation...');
    
    const generator = new AdvancedCommentBankGenerator();
    
    // Mock question with patterns
    const question = {
      _id: 999,
      questionText: "Test question for comment generation",
      difficulty: "medium"
    };
    
    const patterns = {
      nonexistentTables: [
        { sql: "SELECT * FROM fake_table;", table: "fake_table", isCorrect: false },
        { sql: "SELECT * FROM another_fake;", table: "another_fake", isCorrect: false }
      ],
      weaponTrapUsage: [
        { sql: "SELECT * FROM weapons w JOIN squadrons s ON w.squadron_id = s.squadron_id;", isCorrect: false }
      ],
      missingGroupBy: [
        { sql: "SELECT COUNT(*) FROM pilots;", isCorrect: false },
        { sql: "SELECT SUM(flight_hours) FROM pilots;", isCorrect: false }
      ],
      excellentAnswers: [
        { sql: "SELECT * FROM pilots;", isCorrect: true },
        { sql: "SELECT pilot_id, first_name FROM pilots;", isCorrect: true },
        { sql: "SELECT p.*, s.squadron_name FROM pilots p JOIN squadrons s ON p.squadron_id = s.squadron_id;", isCorrect: true }
      ]
    };
    
    const initialCommentCount = generator.generatedComments.length;
    generator.generateCommentsForQuestion(question, patterns);
    const finalCommentCount = generator.generatedComments.length;
    
    this.assert(
      finalCommentCount > initialCommentCount,
      "Should generate comments based on patterns",
      `Generated ${finalCommentCount - initialCommentCount} comments`
    );
    
    // Check if critical error comments were generated
    const criticalComments = generator.generatedComments.filter(c => 
      c.questionId === 999 && c.tags.includes('critical')
    );
    
    this.assert(
      criticalComments.length > 0,
      "Should generate critical error comments",
      `Found ${criticalComments.length} critical comments`
    );
    
    console.log('✅ Comment Generation tests completed\n');
  }

  async testHebrewTemplates() {
    console.log('🔤 Testing Hebrew Templates...');
    
    // Check that all templates have Hebrew feedback
    const hebrewRegex = /[\u0590-\u05FF]/; // Hebrew Unicode range
    
    let hebrewTemplateCount = 0;
    let totalTemplates = 0;
    
    Object.entries(COMPREHENSIVE_TEMPLATES).forEach(([key, template]) => {
      totalTemplates++;
      if (hebrewRegex.test(template.feedback)) {
        hebrewTemplateCount++;
      } else {
        console.log(`⚠️  Template ${key} may not contain Hebrew: "${template.feedback}"`);
      }
    });
    
    this.assert(
      hebrewTemplateCount === totalTemplates,
      "All templates should contain Hebrew text",
      `${hebrewTemplateCount}/${totalTemplates} templates contain Hebrew`
    );
    
    // Check score consistency
    Object.entries(COMPREHENSIVE_TEMPLATES).forEach(([key, template]) => {
      this.assert(
        typeof template.score === 'number' && template.score >= 0,
        `Template ${key} should have valid score`,
        `Score: ${template.score}`
      );
    });
    
    console.log('✅ Hebrew Templates tests completed\n');
  }

  async testSchemaValidation() {
    console.log('🗄️  Testing Schema Validation...');
    
    // Test valid table detection
    const validTables = Object.keys(ADVANCED_SCHEMA.validTables);
    this.assert(
      validTables.includes('pilots') && validTables.includes('weapons'),
      "Schema should include core tables",
      `Valid tables: ${validTables.join(', ')}`
    );
    
    // Test trap table detection
    const trapTables = ADVANCED_SCHEMA.trapTables;
    this.assert(
      trapTables.includes('missionanalytics') && trapTables.includes('squadron_aircraft'),
      "Schema should include trap tables",
      `Trap tables: ${trapTables.slice(0, 3).join(', ')}...`
    );
    
    // Test trap column detection
    const weaponTrapColumns = ADVANCED_SCHEMA.trapColumns.weapons;
    this.assert(
      weaponTrapColumns.includes('squadron_id'),
      "Weapons table should have squadron_id as trap column",
      `Weapon trap columns: ${weaponTrapColumns.join(', ')}`
    );
    
    console.log('✅ Schema Validation tests completed\n');
  }

  async testScoreCalculation() {
    console.log('🎯 Testing Score Calculation...');
    
    const generator = new AdvancedCommentBankGenerator();
    
    // Test difficulty-based max scores
    this.assert(
      generator.getMaxScoreForDifficulty('easy') === 3,
      "Easy questions should have max score 3",
      `Easy max score: ${generator.getMaxScoreForDifficulty('easy')}`
    );
    
    this.assert(
      generator.getMaxScoreForDifficulty('hard') === 7,
      "Hard questions should have max score 7",
      `Hard max score: ${generator.getMaxScoreForDifficulty('hard')}`
    );
    
    // Test severity classification
    this.assert(
      generator.getSeverityFromScore(6) === 'critical',
      "Score 6 should be critical severity",
      `Severity for score 6: ${generator.getSeverityFromScore(6)}`
    );
    
    this.assert(
      generator.getSeverityFromScore(1) === 'medium',
      "Score 1 should be medium severity",
      `Severity for score 1: ${generator.getSeverityFromScore(1)}`
    );
    
    console.log('✅ Score Calculation tests completed\n');
  }

  assert(condition, successMessage, details) {
    if (condition) {
      this.testResults.passed++;
      console.log(`  ✅ ${successMessage}`);
    } else {
      this.testResults.failed++;
      console.log(`  ❌ ${successMessage} - ${details}`);
    }
    
    this.testResults.details.push({
      condition,
      message: successMessage,
      details
    });
  }

  printTestResults() {
    console.log('📊 Test Results Summary:');
    console.log('=' .repeat(40));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📈 Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.details
        .filter(test => !test.condition)
        .forEach(test => {
          console.log(`  - ${test.message}: ${test.details}`);
        });
    }
    
    console.log('\n🎉 Testing completed!');
  }

  // Demo function to show sample comment generation
  async runDemo() {
    console.log('\n🎭 Running Comment Generation Demo...\n');
    
    const generator = new AdvancedCommentBankGenerator();
    
    MOCK_STUDENT_ANSWERS.forEach(questionData => {
      console.log(`📝 Question ${questionData.questionId}: ${questionData.questionText}`);
      console.log(`   Difficulty: ${questionData.difficulty}`);
      console.log(`   Student Answers: ${questionData.answers.length}`);
      
      const patterns = generator.performAdvancedPatternDetection(questionData.answers, questionData);
      
      console.log('   Detected Patterns:');
      Object.entries(patterns).forEach(([pattern, occurrences]) => {
        if (occurrences.length > 0) {
          console.log(`     - ${pattern}: ${occurrences.length} occurrences`);
        }
      });
      
      generator.generateCommentsForQuestion(questionData, patterns);
      
      const questionComments = generator.generatedComments.filter(c => c.questionId === questionData.questionId);
      console.log(`   Generated Comments: ${questionComments.length}`);
      
      questionComments.forEach(comment => {
        console.log(`     📌 "${comment.feedback}" (Score: ${comment.score})`);
      });
      
      console.log('');
    });
    
    console.log('🎬 Demo completed!');
  }
}

// Main execution
async function main() {
  const tester = new CommentGeneratorTester();
  
  console.log('🚀 Starting Comment Bank Generator Testing Suite\n');
  
  try {
    await tester.runTests();
    await tester.runDemo();
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { CommentGeneratorTester, MOCK_STUDENT_ANSWERS }; 