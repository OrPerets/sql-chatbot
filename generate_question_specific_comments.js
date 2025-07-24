const { MongoClient } = require('mongodb');

// MongoDB connection configuration
const dbUserName = "sql-admin";
const dbPassword = "SMff5PqhhoVbX6z7";
const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
const DATABASE_NAME = 'experiment';

// Enhanced schema with trap detection
const ADVANCED_SCHEMA = {
  validTables: {
    'airbases': ['base_id', 'base_name', 'base_code', 'location', 'established_year', 'runways_count', 'personnel_capacity'],
    'squadrons': ['squadron_id', 'squadron_name', 'squadron_number', 'base_id', 'aircraft_type', 'established_date', 'active_status'],
    'pilots': ['pilot_id', 'first_name', 'last_name', 'rank', 'squadron_id', 'flight_hours', 'specialization', 'service_start_date'],
    'aircraft': ['aircraft_id', 'aircraft_type', 'tail_number', 'squadron_id', 'manufacture_year', 'last_maintenance', 'flight_hours_total', 'operational_status'],
    'weapons': ['weapon_id', 'weapon_name', 'weapon_type', 'base_id', 'quantity_available', 'unit_cost', 'minimum_stock'],
    'missions': ['mission_id', 'mission_name', 'mission_date', 'squadron_id', 'pilot_id', 'aircraft_id', 'mission_duration', 'mission_status'],
    'maintenance': ['maintenance_id', 'aircraft_id', 'maintenance_type', 'start_date', 'end_date', 'cost']
  },
  trapTables: [
    'missionanalytics', 'mission_analytics', 'aircraft_assignments', 'pilotschedule', 
    'weaponinventory', 'squadron_aircraft', 'mission_reports', 'aircraft_maintenance'
  ],
  trapColumns: {
    'pilots': ['salary', 'hire_date', 'last_mission', 'training_hours', 'weapon_id'],
    'squadrons': ['budget', 'commander_id', 'home_base', 'aircraft_count'],
    'aircraft': ['fuel_capacity', 'max_speed', 'maintenance_cost'],
    'missions': ['weapon_id', 'pilot_count', 'aircraft_count', 'success_rate', 'cost', 'duration_minutes'],
    'weapons': ['squadron_id'], // Key trap
    'maintenance': ['pilot_id', 'squadron_id']
  }
};

class QuestionSpecificCommentGenerator {
  constructor() {
    this.client = null;
    this.db = null;
    this.generatedComments = [];
    this.statistics = {
      questionsAnalyzed: 0,
      answersAnalyzed: 0,
      commentsGenerated: 0
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

  async generateQuestionSpecificComments() {
    console.log('🎯 Starting Question-Specific Comment Generation...\n');
    
    try {
      // Get questions with answers
      const questions = await this.getQuestionsWithAnswers();
      console.log(`📚 Found ${questions.length} questions with student answers\n`);

      for (const question of questions) {
        await this.analyzeAndGenerateForQuestion(question);
        this.statistics.questionsAnalyzed++;
      }

      await this.saveCommentsToBank();
      this.printStatistics();
      
    } catch (error) {
      console.error('❌ Error during generation:', error);
      throw error;
    }
  }

  async getQuestionsWithAnswers() {
    // Get questions from both collections with minimum 3 answers
    const pipeline = [
      {
        $group: {
          _id: "$questionId",
          questionText: { $first: "$questionText" },
          difficulty: { $first: "$difficulty" },
          answerCount: { $sum: 1 },
          correctAnswers: { $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] } }
        }
      },
      {
        $match: { answerCount: { $gte: 3 } }
      },
      {
        $sort: { answerCount: -1 }
      }
    ];

    const examAnswers = await this.db.collection("examAnswers").aggregate(pipeline).toArray();
    
    const finalExamsPipeline = [
      { $unwind: "$mergedAnswers" },
      {
        $group: {
          _id: "$mergedAnswers.questionId",
          questionText: { $first: "$mergedAnswers.questionText" },
          difficulty: { $first: "$mergedAnswers.difficulty" },
          answerCount: { $sum: 1 },
          correctAnswers: { $sum: { $cond: [{ $eq: ["$mergedAnswers.isCorrect", true] }, 1, 0] } }
        }
      },
      {
        $match: { answerCount: { $gte: 3 } }
      }
    ];

    const finalExamAnswers = await this.db.collection("finalExams").aggregate(finalExamsPipeline).toArray();
    
    // Combine and deduplicate
    const allQuestions = [...examAnswers, ...finalExamAnswers];
    return allQuestions.reduce((acc, q) => {
      const existing = acc.find(existing => existing._id === q._id);
      if (!existing) {
        acc.push(q);
      } else if (q.answerCount > existing.answerCount) {
        const index = acc.indexOf(existing);
        acc[index] = q;
      }
      return acc;
    }, []);
  }

  async analyzeAndGenerateForQuestion(question) {
    const questionId = question._id;
    const questionText = question.questionText || '';
    const difficulty = question.difficulty || 'medium';
    
    console.log(`\n📝 Analyzing Question ${questionId}:`);
    console.log(`   "${questionText?.substring(0, 100)}..."`);
    console.log(`   Difficulty: ${difficulty}, Answers: ${question.answerCount}`);

    // Get student answers
    const answers = await this.getStudentAnswers(questionId);
    
    // Analyze patterns
    const patterns = this.detectErrorPatterns(answers, question);
    
    // Generate question-specific comments
    this.generateSpecificComments(questionId, questionText, difficulty, patterns, answers);
    
    this.statistics.answersAnalyzed += answers.length;
  }

  async getStudentAnswers(questionId) {
    const examAnswers = await this.db.collection("examAnswers")
      .find({ 
        $or: [
          { questionId: questionId.toString() },
          { questionId: parseInt(questionId) }
        ]
      })
      .toArray();

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
      nonexistentTables: [],
      nonexistentColumns: [],
      weaponTrap: [],
      missingWhere: [],
      missingJoin: [],
      missingGroupBy: [],
      missingSemicolon: [],
      perfectAnswers: [],
      specificErrors: []
    };

    answers.forEach(answer => {
      const sql = (answer.studentAnswer || '').trim();
      const upperSQL = sql.toUpperCase();
      
      // Check for nonexistent tables
      ADVANCED_SCHEMA.trapTables.forEach(table => {
        if (new RegExp(`\\b${table.toUpperCase()}\\b`, 'i').test(upperSQL)) {
          patterns.nonexistentTables.push({ sql, table });
        }
      });

      // Check for nonexistent columns
      Object.entries(ADVANCED_SCHEMA.trapColumns).forEach(([table, columns]) => {
        columns.forEach(column => {
          if (new RegExp(`${table}\\.${column}|${column}.*FROM.*${table}`, 'i').test(sql)) {
            patterns.nonexistentColumns.push({ sql, table, column });
          }
        });
      });

      // Check for weapons.squadron_id trap
      if (/weapons?\s*\.\s*squadron_id|squadron_id\s+from\s+weapons?/i.test(sql)) {
        patterns.weaponTrap.push({ sql });
      }

      // Check for missing WHERE when question implies filtering
      if (this.questionNeedsFiltering(question.questionText) && 
          upperSQL.includes('SELECT') && !upperSQL.includes('WHERE')) {
        patterns.missingWhere.push({ sql });
      }

      // Check for missing JOIN when question needs multiple tables
      if (this.questionNeedsJoin(question.questionText) && 
          upperSQL.includes('SELECT') && !upperSQL.includes('JOIN')) {
        patterns.missingJoin.push({ sql });
      }

      // Check for missing GROUP BY
      if (/COUNT|SUM|AVG|MAX|MIN/.test(upperSQL) && !upperSQL.includes('GROUP BY')) {
        patterns.missingGroupBy.push({ sql });
      }

      // Check for missing semicolon
      if (!sql.endsWith(';')) {
        patterns.missingSemicolon.push({ sql });
      }

      // Mark perfect answers
      if (answer.isCorrect) {
        patterns.perfectAnswers.push({ sql });
      }
    });

    return patterns;
  }

  questionNeedsFiltering(questionText) {
    const filterKeywords = ['ספציפי', 'מסוים', 'מעל', 'פחות מ', 'בשנת', 'שווה ל', 'גדול מ', 'קטן מ', 'בדיוק'];
    return filterKeywords.some(keyword => questionText?.includes(keyword));
  }

  questionNeedsJoin(questionText) {
    const joinKeywords = ['ושם', 'עם שם', 'יחד עם', 'כולל', 'בנוסף ל', 'של הטייסת', 'של הבסיס'];
    return joinKeywords.some(keyword => questionText?.includes(keyword));
  }

  generateSpecificComments(questionId, questionText, difficulty, patterns, answers) {
    const maxScore = this.getMaxScoreForDifficulty(difficulty);
    
    // Generate question-specific comments based on patterns
    if (patterns.nonexistentTables.length >= 2) {
      const tableNames = [...new Set(patterns.nonexistentTables.map(p => p.table))];
      this.addComment(questionId, questionText, difficulty, {
        feedback: `בשאלה זו: יש שימוש בטבלאות שלא קיימות (${tableNames.slice(0,2).join(', ')}). יש לבדוק את הסכמה ולהשתמש רק בטבלאות הקיימות.`,
        score: -6, // Negative for point deduction
        tags: ["schema", "critical", "question_specific"]
      });
    }

    if (patterns.nonexistentColumns.length >= 2) {
      const columnInfo = patterns.nonexistentColumns.slice(0, 2);
      this.addComment(questionId, questionText, difficulty, {
        feedback: `בשאלה זו: יש שימוש בעמודות שלא קיימות (כגון ${columnInfo[0].column}). יש לוודא שכל העמודות קיימות בטבלאות הרלוונטיות.`,
        score: -5,
        tags: ["schema", "critical", "question_specific"]
      });
    }

    if (patterns.weaponTrap.length >= 1) {
      this.addComment(questionId, questionText, difficulty, {
        feedback: `שגיאה קריטית בשאלה זו: טבלת weapons אינה מקושרת ישירות לטבלת squadrons. כלי נשק מאוחסנים בבסיסים (base_id) ולא בטייסות.`,
        score: -5,
        tags: ["schema", "trap", "question_specific"]
      });
    }

    if (patterns.missingWhere.length >= 2) {
      this.addComment(questionId, questionText, difficulty, {
        feedback: `בשאלה זו נדרש סינון ספציפי: חסר תנאי WHERE. השאלה מבקשת מידע מסוים ולא את כל הרשומות.`,
        score: -3,
        tags: ["syntax", "where", "question_specific"]
      });
    }

    if (patterns.missingJoin.length >= 2) {
      this.addComment(questionId, questionText, difficulty, {
        feedback: `השאלה דורשת מידע מכמה טבלאות: חסר JOIN. יש לחבר בין הטבלאות הרלוונטיות כדי לקבל את המידע הנדרש.`,
        score: -4,
        tags: ["syntax", "join", "question_specific"]
      });
    }

    if (patterns.missingGroupBy.length >= 2) {
      this.addComment(questionId, questionText, difficulty, {
        feedback: `בשאלה זו משתמשים בפונקציות צבירה: חסר GROUP BY. כאשר משתמשים ב-COUNT, SUM, או AVG יש צורך לקבץ לפי עמודה רלוונטית.`,
        score: -3,
        tags: ["aggregation", "group_by", "question_specific"]
      });
    }

    // Add positive feedback for good performance
    if (patterns.perfectAnswers.length >= 3) {
      this.addComment(questionId, questionText, difficulty, {
        feedback: `שאלה זו נפתרה היטב על ידי מרבית הסטודנטים. התשובה מדויקת וברורה!`,
        score: 0,
        tags: ["positive", "excellent", "question_specific"]
      });
    }

    // Add minor issues
    if (patterns.missingSemicolon.length >= Math.ceil(answers.length * 0.5)) {
      this.addComment(questionId, questionText, difficulty, {
        feedback: `שגיאה קטנה: חסרה נקודה פסיק (;) בסוף השאילתה. חשוב לסיים כל שאילתה SQL בנקודה פסיק.`,
        score: -1,
        tags: ["syntax", "semicolon", "question_specific"]
      });
    }

    const questionComments = this.generatedComments.filter(c => c.questionId === questionId);
    console.log(`   Generated ${questionComments.length} question-specific comments`);
  }

  addComment(questionId, questionText, difficulty, template) {
    const comment = {
      questionId: parseInt(questionId),
      questionText: questionText,
      difficulty: difficulty,
      score: Math.abs(template.score), // Frontend expects positive score for current grade
      maxScore: this.getMaxScoreForDifficulty(difficulty),
      feedback: template.feedback,
      reduced_points: Math.abs(template.score), // Points to deduct (positive number)
      tags: template.tags || [],
      usageCount: 0,
      gradedBy: "auto_generator_specific",
      gradedAt: new Date(),
      lastUsed: null,
      autoGenerated: true,
      questionSpecific: true,
      version: "3.0"
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

  async saveCommentsToBank() {
    console.log('\n💾 Saving question-specific comments to comment bank...');
    
    // First, delete old auto-generated comments to avoid duplicates
    console.log('🗑️ Cleaning up old auto-generated comments...');
    const deleteResult = await this.db.collection("commentBank").deleteMany({
      gradedBy: { $in: ["auto_generator", "auto_generator_specific"] }
    });
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} old auto-generated comments`);
    
    let savedCount = 0;
    let skippedCount = 0;

    for (const comment of this.generatedComments) {
      try {
        // Insert new comment (no need to check duplicates since we cleaned up)
        await this.db.collection("commentBank").insertOne(comment);
        savedCount++;
        
      } catch (error) {
        console.error(`❌ Error saving comment: ${error.message}`);
      }
    }

    console.log(`✅ Saved ${savedCount} new question-specific comments`);
    console.log(`⏭️  Skipped ${skippedCount} duplicate comments`);
  }

  printStatistics() {
    console.log('\n📊 Question-Specific Comment Generation Statistics:');
    console.log('=' .repeat(60));
    console.log(`📚 Questions analyzed: ${this.statistics.questionsAnalyzed}`);
    console.log(`📝 Student answers analyzed: ${this.statistics.answersAnalyzed}`);
    console.log(`💬 Question-specific comments generated: ${this.statistics.commentsGenerated}`);
    
    console.log('\n🎯 Comments by Question:');
    const commentsByQuestion = {};
    this.generatedComments.forEach(comment => {
      commentsByQuestion[comment.questionId] = (commentsByQuestion[comment.questionId] || 0) + 1;
    });
    
    Object.entries(commentsByQuestion).forEach(([questionId, count]) => {
      console.log(`   Question ${questionId}: ${count} specific comments`);
    });
  }
}

// Main execution function
async function main() {
  const generator = new QuestionSpecificCommentGenerator();
  
  try {
    await generator.connect();
    await generator.generateQuestionSpecificComments();
  } catch (error) {
    console.error('❌ Question-specific generation failed:', error);
    process.exit(1);
  } finally {
    await generator.disconnect();
  }
  
  console.log('\n🎉 Question-specific comment generation completed!');
  console.log('💡 Comments are now personalized per question with correct scoring.');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { QuestionSpecificCommentGenerator }; 