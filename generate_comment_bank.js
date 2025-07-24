const { MongoClient } = require('mongodb');

// MongoDB connection configuration
const dbUserName = "sql-admin";
const dbPassword = "SMff5PqhhoVbX6z7";
const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
const DATABASE_NAME = 'experiment';

// Valid database schema for validation
const VALID_SCHEMA = {
  tables: {
    'airbases': ['base_id', 'base_name', 'base_code', 'location', 'established_year', 'runways_count', 'personnel_capacity'],
    'squadrons': ['squadron_id', 'squadron_name', 'squadron_number', 'base_id', 'aircraft_type', 'established_date', 'active_status'],
    'pilots': ['pilot_id', 'first_name', 'last_name', 'rank', 'squadron_id', 'flight_hours', 'specialization', 'service_start_date'],
    'aircraft': ['aircraft_id', 'aircraft_type', 'tail_number', 'squadron_id', 'manufacture_year', 'last_maintenance', 'flight_hours_total', 'operational_status'],
    'weapons': ['weapon_id', 'weapon_name', 'weapon_type', 'base_id', 'quantity_available', 'unit_cost', 'minimum_stock'],
    'missions': ['mission_id', 'mission_name', 'mission_date', 'squadron_id', 'pilot_id', 'aircraft_id', 'mission_duration', 'mission_status'],
    'maintenance': ['maintenance_id', 'aircraft_id', 'maintenance_type', 'start_date', 'end_date', 'cost']
  },
  invalidTables: ['missionanalytics', 'mission_analytics', 'aircraft_assignments', 'pilotschedule', 'weaponinventory', 'squadron_aircraft', 'mission_reports', 'aircraft_maintenance'],
  invalidColumns: {
    'pilots': ['salary', 'hire_date', 'last_mission', 'training_hours', 'weapon_id'],
    'squadrons': ['budget', 'commander_id', 'home_base', 'aircraft_count'],
    'aircraft': ['last_maintenance', 'flight_hours', 'fuel_capacity', 'max_speed'],
    'missions': ['weapon_id', 'pilot_count', 'aircraft_count', 'success_rate', 'cost', 'duration_minutes', 'fuel_consumption', 'weapon_effectiveness'],
    'weapons': ['squadron_id'] // Key trap - weapons don't have squadron_id
  }
};

// Hebrew feedback templates with scoring
const FEEDBACK_TEMPLATES = {
  // Schema violations
  INVALID_TABLES: {
    feedback: "יש שימוש בתשובה בטבלאות שלא קיימות בבסיס הנתונים.",
    score: 6,
    tags: ["schema", "invalid_table"]
  },
  INVALID_COLUMNS: {
    feedback: "יש שימוש בעמודות שלא קיימות בטבלאות המבוקשות.",
    score: 4,
    tags: ["schema", "invalid_column"]
  },
  WEAPON_SQUADRON_TRAP: {
    feedback: "שגיאה קריטית: טבלת weapons אינה מכילה עמודת squadron_id. כלי נשק מאוחסנים בבסיסים ולא בטייסות.",
    score: 5,
    tags: ["schema", "weapon_trap", "relationship"]
  },
  
  // SQL syntax issues
  MISSING_WHERE: {
    feedback: "התנאי סינון שגוי או חסר. יש להוסיף תנאי מתאים בשורת WHERE.",
    score: 2,
    tags: ["syntax", "where_clause"]
  },
  MISSING_SEMICOLON: {
    feedback: "חסרה נקודה פסיק בסוף השאילתה.",
    score: 1,
    tags: ["syntax", "semicolon"]
  },
  INCOMPLETE_SELECT: {
    feedback: "חסרה עמודת מפתח בשאילתה. יש לכלול את כל העמודות הנדרשות.",
    score: 1,
    tags: ["syntax", "select_clause"]
  },
  
  // Logic errors
  WRONG_TABLE_CHOICE: {
    feedback: "נבחרה טבלה שגויה - הנתונים אינם מתאימים לשאלה.",
    score: 2,
    tags: ["logic", "table_choice"]
  },
  UNNECESSARY_COMPLEXITY: {
    feedback: "השאילתה מסובכת מדי או מכילה תנאים מיותרים.",
    score: 1,
    tags: ["logic", "complexity"]
  },
  MISSING_JOIN: {
    feedback: "חסר חיבור בין טבלאות. יש צורך בשימוש ב-JOIN לקבלת הנתונים הנדרשים.",
    score: 3,
    tags: ["logic", "join"]
  },
  WRONG_JOIN_TYPE: {
    feedback: "סוג החיבור בין הטבלאות אינו מתאים. יש לבחור בין INNER JOIN ל-LEFT JOIN בהתאם לדרישה.",
    score: 2,
    tags: ["logic", "join_type"]
  },
  
  // Aggregation issues
  MISSING_GROUP_BY: {
    feedback: "חסר GROUP BY כאשר משתמשים בפונקציות צבירה כמו COUNT, SUM, AVG.",
    score: 3,
    tags: ["aggregation", "group_by"]
  },
  UNNECESSARY_GROUP_BY: {
    feedback: "שימוש מיותר ב-GROUP BY כאשר אין צורך בצבירת נתונים.",
    score: 1,
    tags: ["aggregation", "unnecessary_group"]
  },
  WRONG_AGGREGATE_FUNCTION: {
    feedback: "פונקציית הצבירה אינה מתאימה לשאלה. יש לבחור בין COUNT, SUM, AVG, MAX, MIN.",
    score: 2,
    tags: ["aggregation", "wrong_function"]
  },
  
  // Positive feedback
  PERFECT_ANSWER: {
    feedback: "התשובה מדויקת וברורה!",
    score: 0,
    tags: ["positive", "perfect"]
  },
  GOOD_STRUCTURE: {
    feedback: "המבנה הכללי של השאילתה נכון, יש רק שגיאות קטנות.",
    score: 0,
    tags: ["positive", "good_structure"]
  }
};

class CommentBankGenerator {
  constructor() {
    this.client = null;
    this.db = null;
    this.generatedComments = [];
    this.statistics = {
      questionsAnalyzed: 0,
      answersAnalyzed: 0,
      commentsGenerated: 0,
      patternsDetected: {}
    };
  }

  async connect() {
    try {
      this.client = new MongoClient(connectionString);
      await this.client.connect();
      this.db = this.client.db(DATABASE_NAME);
      console.log('✅ Connected to MongoDB successfully');
    } catch (error) {
      console.error('❌ Error connecting to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('📊 Disconnected from MongoDB');
    }
  }

  // Main analysis function
  async analyzeAndGenerateComments() {
    console.log('🔍 Starting automated comment bank generation...\n');
    
    try {
      // Get all unique questions that have student answers
      const questions = await this.getQuestionsWithAnswers();
      console.log(`📚 Found ${questions.length} questions with student answers\n`);

      for (const question of questions) {
        await this.analyzeQuestionAnswers(question);
        this.statistics.questionsAnalyzed++;
      }

      // Generate summary comments based on patterns
      this.generateSummaryComments();
      
      // Save all generated comments to the comment bank
      await this.saveCommentsToBank();
      
      this.printStatistics();
      
    } catch (error) {
      console.error('❌ Error during analysis:', error);
      throw error;
    }
  }

  async getQuestionsWithAnswers() {
    // Get questions from both finalExams.mergedAnswers and examAnswers collections
    const pipeline = [
      {
        $group: {
          _id: "$questionId",
          questionText: { $first: "$questionText" },
          difficulty: { $first: "$difficulty" },
          answerCount: { $sum: 1 }
        }
      },
      {
        $match: { answerCount: { $gte: 3 } } // Only questions with at least 3 answers
      },
      {
        $sort: { answerCount: -1 }
      }
    ];

    // Check both collections
    const examAnswers = await this.db.collection("examAnswers").aggregate(pipeline).toArray();
    
    // Also check finalExams collection
    const finalExamsPipeline = [
      { $unwind: "$mergedAnswers" },
      {
        $group: {
          _id: "$mergedAnswers.questionId",
          questionText: { $first: "$mergedAnswers.questionText" },
          difficulty: { $first: "$mergedAnswers.difficulty" },
          answerCount: { $sum: 1 }
        }
      },
      {
        $match: { answerCount: { $gte: 3 } }
      }
    ];

    const finalExamAnswers = await this.db.collection("finalExams").aggregate(finalExamsPipeline).toArray();
    
    // Combine and deduplicate
    const allQuestions = [...examAnswers, ...finalExamAnswers];
    const uniqueQuestions = allQuestions.reduce((acc, q) => {
      const existing = acc.find(existing => existing._id === q._id);
      if (!existing) {
        acc.push(q);
      } else if (q.answerCount > existing.answerCount) {
        const index = acc.indexOf(existing);
        acc[index] = q;
      }
      return acc;
    }, []);

    return uniqueQuestions;
  }

  async analyzeQuestionAnswers(question) {
    console.log(`\n📝 Analyzing Question ${question._id}: ${question.questionText?.substring(0, 80)}...`);
    
    // Get all student answers for this question
    const answers = await this.getStudentAnswers(question._id);
    console.log(`   Found ${answers.length} student answers`);

    const patterns = this.detectErrorPatterns(answers, question);
    
    // Generate comments based on detected patterns
    this.generateCommentsForQuestion(question, patterns);
    
    this.statistics.answersAnalyzed += answers.length;
  }

  async getStudentAnswers(questionId) {
    // Get from examAnswers
    const examAnswers = await this.db.collection("examAnswers")
      .find({ 
        $or: [
          { questionId: questionId.toString() },
          { questionId: parseInt(questionId) }
        ]
      })
      .toArray();

    // Get from finalExams
    const finalExamAnswers = await this.db.collection("finalExams")
      .aggregate([
        { $unwind: "$mergedAnswers" },
        {
          $match: {
            $or: [
              { "mergedAnswers.questionId": questionId.toString() },
              { "mergedAnswers.questionId": parseInt(questionId) }
            ]
          }
        },
        {
          $project: {
            studentAnswer: "$mergedAnswers.studentAnswer",
            isCorrect: "$mergedAnswers.isCorrect",
            difficulty: "$mergedAnswers.difficulty"
          }
        }
      ])
      .toArray();

    return [...examAnswers, ...finalExamAnswers];
  }

  detectErrorPatterns(answers, question) {
    const patterns = {
      invalidTables: [],
      invalidColumns: [],
      weaponTrap: [],
      missingSemicolon: [],
      missingWhere: [],
      wrongTableChoice: [],
      missingJoin: [],
      missingGroupBy: [],
      wrongAggregateFunction: [],
      perfectAnswers: []
    };

    answers.forEach(answer => {
      const sql = answer.studentAnswer || answer.answer || '';
      const upperSQL = sql.toUpperCase();
      
      // Check for invalid tables
      VALID_SCHEMA.invalidTables.forEach(table => {
        const regex = new RegExp(`\\b${table.toUpperCase()}\\b`, 'i');
        if (regex.test(upperSQL)) {
          patterns.invalidTables.push({
            answer: sql,
            table: table,
            isCorrect: answer.isCorrect
          });
        }
      });

      // Check for invalid columns
      Object.entries(VALID_SCHEMA.invalidColumns).forEach(([table, columns]) => {
        columns.forEach(column => {
          const regex = new RegExp(`${table}\\.${column}|${column}.*FROM.*${table}`, 'i');
          if (regex.test(sql)) {
            patterns.invalidColumns.push({
              answer: sql,
              table: table,
              column: column,
              isCorrect: answer.isCorrect
            });
          }
        });
      });

      // Check for weapons.squadron_id trap
      if (/weapons?\s*\.\s*squadron_id|squadron_id\s+from\s+weapons?/i.test(sql)) {
        patterns.weaponTrap.push({
          answer: sql,
          isCorrect: answer.isCorrect
        });
      }

      // Check for missing semicolon
      if (!sql.trim().endsWith(';')) {
        patterns.missingSemicolon.push({
          answer: sql,
          isCorrect: answer.isCorrect
        });
      }

      // Check for missing WHERE when needed
      if (upperSQL.includes('SELECT') && !upperSQL.includes('WHERE') && 
          (question.questionText?.includes('ספציפי') || question.questionText?.includes('מסוים'))) {
        patterns.missingWhere.push({
          answer: sql,
          isCorrect: answer.isCorrect
        });
      }

      // Check for aggregation without GROUP BY
      if ((upperSQL.includes('COUNT') || upperSQL.includes('SUM') || upperSQL.includes('AVG')) &&
          !upperSQL.includes('GROUP BY')) {
        patterns.missingGroupBy.push({
          answer: sql,
          isCorrect: answer.isCorrect
        });
      }

      // Mark perfect answers
      if (answer.isCorrect) {
        patterns.perfectAnswers.push({
          answer: sql,
          isCorrect: answer.isCorrect
        });
      }
    });

    return patterns;
  }

  generateCommentsForQuestion(question, patterns) {
    const questionId = question._id;
    const questionText = question.questionText || '';
    const difficulty = question.difficulty || 'medium';

    // Generate comments based on detected patterns
    if (patterns.invalidTables.length >= 2) {
      this.addComment(questionId, questionText, difficulty, FEEDBACK_TEMPLATES.INVALID_TABLES);
      this.statistics.patternsDetected.invalidTables = (this.statistics.patternsDetected.invalidTables || 0) + 1;
    }

    if (patterns.invalidColumns.length >= 2) {
      this.addComment(questionId, questionText, difficulty, FEEDBACK_TEMPLATES.INVALID_COLUMNS);
      this.statistics.patternsDetected.invalidColumns = (this.statistics.patternsDetected.invalidColumns || 0) + 1;
    }

    if (patterns.weaponTrap.length >= 1) {
      this.addComment(questionId, questionText, difficulty, FEEDBACK_TEMPLATES.WEAPON_SQUADRON_TRAP);
      this.statistics.patternsDetected.weaponTrap = (this.statistics.patternsDetected.weaponTrap || 0) + 1;
    }

    if (patterns.missingSemicolon.length >= 3) {
      this.addComment(questionId, questionText, difficulty, FEEDBACK_TEMPLATES.MISSING_SEMICOLON);
    }

    if (patterns.missingWhere.length >= 2) {
      this.addComment(questionId, questionText, difficulty, FEEDBACK_TEMPLATES.MISSING_WHERE);
    }

    if (patterns.missingGroupBy.length >= 2) {
      this.addComment(questionId, questionText, difficulty, FEEDBACK_TEMPLATES.MISSING_GROUP_BY);
    }

    // Add positive feedback for questions with many correct answers
    if (patterns.perfectAnswers.length >= 3) {
      this.addComment(questionId, questionText, difficulty, FEEDBACK_TEMPLATES.PERFECT_ANSWER);
    }

    console.log(`   Generated ${this.generatedComments.filter(c => c.questionId === questionId).length} comments for this question`);
  }

  addComment(questionId, questionText, difficulty, template) {
    const comment = {
      questionId: parseInt(questionId),
      questionText: questionText,
      difficulty: difficulty,
      score: template.score,
      maxScore: this.getMaxScoreForDifficulty(difficulty),
      feedback: template.feedback,
      tags: template.tags || [],
      usageCount: 0,
      gradedBy: "auto_generator",
      gradedAt: new Date(),
      lastUsed: null
    };

    // Check for duplicates
    const isDuplicate = this.generatedComments.some(existing => 
      existing.questionId === comment.questionId && 
      existing.feedback === comment.feedback
    );

    if (!isDuplicate) {
      this.generatedComments.push(comment);
      this.statistics.commentsGenerated++;
    }
  }

  getMaxScoreForDifficulty(difficulty) {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 3;
      case 'medium': return 5;
      case 'hard': return 7;
      case 'algebra': return 7;
      default: return 5;
    }
  }

  generateSummaryComments() {
    // Generate general reusable comments that can apply to multiple questions
    const generalComments = [
      {
        questionId: 0, // Special ID for general comments
        questionText: "הערה כללית",
        difficulty: "general",
        score: 1,
        maxScore: 5,
        feedback: "השאילתה נכונה במבנה אך יש שגיאות קטנות בתחביר.",
        tags: ["general", "syntax"],
        usageCount: 0,
        gradedBy: "auto_generator",
        gradedAt: new Date(),
        lastUsed: null
      },
      {
        questionId: 0,
        questionText: "הערה כללית",
        difficulty: "general", 
        score: 3,
        maxScore: 5,
        feedback: "רעיון נכון אך ביצוע שגוי. יש לשפר את הלוגיקה של השאילתה.",
        tags: ["general", "logic"],
        usageCount: 0,
        gradedBy: "auto_generator",
        gradedAt: new Date(),
        lastUsed: null
      },
      {
        questionId: 0,
        questionText: "הערה כללית",
        difficulty: "general",
        score: 2,
        maxScore: 5,
        feedback: "יש לבדוק את שמות הטבלאות והעמודות בהתאם למסד הנתונים הנתון.",
        tags: ["general", "schema"],
        usageCount: 0,
        gradedBy: "auto_generator",
        gradedAt: new Date(),
        lastUsed: null
      }
    ];

    this.generatedComments.push(...generalComments);
    this.statistics.commentsGenerated += generalComments.length;
  }

  async saveCommentsToBank() {
    console.log('\n💾 Saving generated comments to comment bank...');
    
    let savedCount = 0;
    let skippedCount = 0;

    for (const comment of this.generatedComments) {
      try {
        // Check if similar comment already exists
        const existing = await this.db.collection("commentBank").findOne({
          questionId: comment.questionId,
          feedback: comment.feedback
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        // Insert new comment
        await this.db.collection("commentBank").insertOne(comment);
        savedCount++;
        
      } catch (error) {
        console.error(`❌ Error saving comment: ${error.message}`);
      }
    }

    console.log(`✅ Saved ${savedCount} new comments to the bank`);
    console.log(`⏭️  Skipped ${skippedCount} duplicate comments`);
  }

  printStatistics() {
    console.log('\n📊 Comment Bank Generation Statistics:');
    console.log('==========================================');
    console.log(`📚 Questions analyzed: ${this.statistics.questionsAnalyzed}`);
    console.log(`📝 Student answers analyzed: ${this.statistics.answersAnalyzed}`);
    console.log(`💬 Comments generated: ${this.statistics.commentsGenerated}`);
    console.log('\n🔍 Error patterns detected:');
    
    Object.entries(this.statistics.patternsDetected).forEach(([pattern, count]) => {
      console.log(`   - ${pattern}: ${count} occurrences`);
    });
    
    console.log('\n🎯 Comment distribution by type:');
    const commentsByType = {};
    this.generatedComments.forEach(comment => {
      comment.tags.forEach(tag => {
        commentsByType[tag] = (commentsByType[tag] || 0) + 1;
      });
    });
    
    Object.entries(commentsByType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} comments`);
    });
  }
}

// Main execution function
async function main() {
  const generator = new CommentBankGenerator();
  
  try {
    await generator.connect();
    await generator.analyzeAndGenerateComments();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await generator.disconnect();
  }
  
  console.log('\n🎉 Comment bank generation completed successfully!');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { CommentBankGenerator, FEEDBACK_TEMPLATES, VALID_SCHEMA }; 