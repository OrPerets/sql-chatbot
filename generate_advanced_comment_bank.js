const { MongoClient } = require('mongodb');

// MongoDB connection configuration
const dbUserName = "sql-admin";
const dbPassword = "SMff5PqhhoVbX6z7";
const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
const DATABASE_NAME = 'experiment';

// Enhanced schema validation with more trap patterns
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
  // Common trap tables that don't exist
  trapTables: [
    'missionanalytics', 'mission_analytics', 'aircraft_assignments', 'pilotschedule', 
    'weaponinventory', 'squadron_aircraft', 'mission_reports', 'aircraft_maintenance',
    'pilot_schedules', 'weapon_assignments', 'flight_logs', 'mission_analytics'
  ],
  // Columns that don't exist in their respective tables
  trapColumns: {
    'pilots': ['salary', 'hire_date', 'last_mission', 'training_hours', 'weapon_id', 'aircraft_id'],
    'squadrons': ['budget', 'commander_id', 'home_base', 'aircraft_count', 'pilot_count'],
    'aircraft': ['fuel_capacity', 'max_speed', 'maintenance_cost', 'pilot_id'],
    'missions': ['weapon_id', 'pilot_count', 'aircraft_count', 'success_rate', 'cost', 'duration_minutes', 'fuel_consumption'],
    'weapons': ['squadron_id', 'pilot_id', 'aircraft_id'], // Key traps
    'airbases': ['budget', 'commander_id', 'squadron_count'],
    'maintenance': ['pilot_id', 'squadron_id', 'weapon_id']
  },
  // Valid relationships for JOIN validation
  validJoins: [
    { from: 'squadrons', to: 'airbases', on: 'base_id' },
    { from: 'pilots', to: 'squadrons', on: 'squadron_id' },
    { from: 'aircraft', to: 'squadrons', on: 'squadron_id' },
    { from: 'missions', to: 'squadrons', on: 'squadron_id' },
    { from: 'missions', to: 'pilots', on: 'pilot_id' },
    { from: 'missions', to: 'aircraft', on: 'aircraft_id' },
    { from: 'maintenance', to: 'aircraft', on: 'aircraft_id' },
    { from: 'weapons', to: 'airbases', on: 'base_id' }
  ]
};

// Comprehensive Hebrew feedback templates
const COMPREHENSIVE_TEMPLATES = {
  // Critical schema violations (high point deduction)
  NONEXISTENT_TABLES: {
    feedback: "שגיאה קריטית: יש שימוש בטבלאות שלא קיימות במסד הנתונים. יש לבדוק את שמות הטבלאות בסכמה.",
    score: 6,
    tags: ["schema", "critical", "nonexistent_table"]
  },
  NONEXISTENT_COLUMNS: {
    feedback: "שגיאה חמורה: יש שימוש בעמודות שלא קיימות. יש לוודא שכל שמות העמודות תואמים את הסכמה.",
    score: 5,
    tags: ["schema", "critical", "nonexistent_column"]
  },
  WEAPON_SQUADRON_RELATIONSHIP: {
    feedback: "מלכודת סכמה: טבלת weapons אינה מקושרת ישירות לטבלת squadrons. כלי נשק מאוחסנים בבסיסים (base_id).",
    score: 5,
    tags: ["schema", "trap", "weapon_relationship"]
  },
  INVALID_JOIN_RELATIONSHIP: {
    feedback: "קשר שגוי בין טבלאות: ה-JOIN שנבחר אינו תקף לפי הסכמה. יש לבדוק את הקשרים הנכונים.",
    score: 4,
    tags: ["schema", "join", "relationship"]
  },

  // SQL syntax errors (medium point deduction)
  MISSING_WHERE_CLAUSE: {
    feedback: "חסר תנאי WHERE: השאילתה דורשת סינון ספציפי אך לא נכלל תנאי WHERE מתאים.",
    score: 3,
    tags: ["syntax", "where", "filtering"]
  },
  INCORRECT_WHERE_LOGIC: {
    feedback: "תנאי WHERE שגוי: הלוגיקה של התנאי אינה מתאימה לדרישת השאלה.",
    score: 2,
    tags: ["logic", "where", "condition"]
  },
  MISSING_JOIN: {
    feedback: "חסר JOIN: השאלה דורשת נתונים מכמה טבלאות אך לא נעשה חיבור מתאים.",
    score: 4,
    tags: ["syntax", "join", "missing"]
  },
  WRONG_JOIN_TYPE: {
    feedback: "סוג JOIN שגוי: יש לבחור בין INNER JOIN (רק רשומות תואמות) ל-LEFT JOIN (כל הרשומות מהטבלה השמאלית).",
    score: 2,
    tags: ["logic", "join", "type"]
  },

  // Aggregation errors
  MISSING_GROUP_BY: {
    feedback: "חסר GROUP BY: בעת שימוש בפונקציות צבירה (COUNT, SUM, AVG) יש צורך ב-GROUP BY.",
    score: 3,
    tags: ["aggregation", "group_by", "missing"]
  },
  UNNECESSARY_GROUP_BY: {
    feedback: "GROUP BY מיותר: אין צורך בקיבוץ כאשר לא משתמשים בפונקציות צבירה.",
    score: 1,
    tags: ["aggregation", "group_by", "unnecessary"]
  },
  WRONG_AGGREGATE_FUNCTION: {
    feedback: "פונקציית צבירה שגויה: יש לבחור את הפונקציה המתאימה - COUNT למניין, SUM לחיבור, AVG לממוצע.",
    score: 2,
    tags: ["aggregation", "function", "wrong"]
  },
  MISSING_HAVING: {
    feedback: "חסר HAVING: לסינון תוצאות של GROUP BY יש להשתמש ב-HAVING ולא ב-WHERE.",
    score: 2,
    tags: ["aggregation", "having", "missing"]
  },

  // Query structure issues
  INCOMPLETE_SELECT: {
    feedback: "SELECT לא שלם: חסרות עמודות נדרשות או שנבחרו עמודות לא רלוונטיות.",
    score: 2,
    tags: ["structure", "select", "incomplete"]
  },
  WRONG_TABLE_CHOICE: {
    feedback: "בחירת טבלה שגויה: הטבלה שנבחרה אינה מכילה את הנתונים הנדרשים לפתרון השאלה.",
    score: 3,
    tags: ["logic", "table", "wrong_choice"]
  },
  OVERCOMPLICATED_QUERY: {
    feedback: "שאילתה מסובכת מדי: ניתן לפתור את השאלה בצורה פשוטה יותר.",
    score: 1,
    tags: ["structure", "complexity", "overcomplicated"]
  },

  // Ordering and sorting
  MISSING_ORDER_BY: {
    feedback: "חסר ORDER BY: השאלה דורשת מיון של התוצאות.",
    score: 1,
    tags: ["structure", "order", "missing"]
  },
  WRONG_ORDER_DIRECTION: {
    feedback: "כיוון מיון שגוי: יש לבדוק אם נדרש ASC (עולה) או DESC (יורד).",
    score: 1,
    tags: ["structure", "order", "direction"]
  },

  // Minor syntax issues (low point deduction)
  MISSING_SEMICOLON: {
    feedback: "חסרה נקודה פסיק: יש להוסיף ; בסוף השאילתה.",
    score: 1,
    tags: ["syntax", "semicolon", "minor"]
  },
  CASE_SENSITIVITY: {
    feedback: "רגישות לאותיות: יש לשמור על עקביות בכתיב שמות טבלאות ועמודות.",
    score: 1,
    tags: ["syntax", "case", "minor"]
  },
  EXTRA_SPACES: {
    feedback: "בעיות עיצוב: יש רווחים מיותרים או חסרים בשאילתה.",
    score: 0,
    tags: ["syntax", "formatting", "minor"]
  },

  // Positive feedback
  EXCELLENT_ANSWER: {
    feedback: "תשובה מצוינת! השאילתה נכונה לחלוטין ומעוצבת היטב.",
    score: 0,
    tags: ["positive", "excellent"]
  },
  GOOD_STRUCTURE: {
    feedback: "מבנה טוב: הרעיון הבסיסי נכון, יש רק תיקונים קטנים.",
    score: 0,
    tags: ["positive", "good_structure"]
  },
  CREATIVE_SOLUTION: {
    feedback: "פתרון יצירתי: השאילתה פותרת את הבעיה בדרך מעניינת ונכונה.",
    score: 0,
    tags: ["positive", "creative"]
  },

  // Specific domain errors (Air Force context)
  AIRCRAFT_TYPE_ERROR: {
    feedback: "שגיאה בסוג כלי טיס: יש לוודא שמות מטוסים נכונים (F-16, F-35, Apache וכו').",
    score: 1,
    tags: ["domain", "aircraft", "type"]
  },
  RANK_HIERARCHY_ERROR: {
    feedback: "שגיאה בדרגות: יש לשמור על היררכיית הדרגות הצבאיות הנכונה.",
    score: 1,
    tags: ["domain", "rank", "hierarchy"]
  },
  MISSION_STATUS_ERROR: {
    feedback: "סטטוס משימה שגוי: יש להשתמש בסטטוסים תקינים (הושלמה, בביצוע, בוטלה).",
    score: 1,
    tags: ["domain", "mission", "status"]
  }
};

class AdvancedCommentBankGenerator {
  constructor() {
    this.client = null;
    this.db = null;
    this.generatedComments = [];
    this.questionAnalytics = new Map();
    this.statistics = {
      questionsAnalyzed: 0,
      answersAnalyzed: 0,
      commentsGenerated: 0,
      patternsDetected: {},
      severityDistribution: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
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

  async analyzeAndGenerateComments() {
    console.log('🚀 Starting advanced comment bank generation...\n');
    
    try {
      // Get all questions with sufficient answer data
      const questions = await this.getQuestionsWithAnswers();
      console.log(`📚 Found ${questions.length} questions with student answers\n`);

      // Analyze each question
      for (const question of questions) {
        await this.analyzeQuestionInDepth(question);
        this.statistics.questionsAnalyzed++;
      }

      // Generate domain-specific and general comments
      this.generateAdvancedComments();
      
      // Save to comment bank
      await this.saveCommentsToBank();
      
      // Generate detailed analytics report
      this.generateAnalyticsReport();
      
    } catch (error) {
      console.error('❌ Error during analysis:', error);
      throw error;
    }
  }

  async getQuestionsWithAnswers() {
    // Enhanced query to get more metadata
    const pipeline = [
      {
        $group: {
          _id: "$questionId",
          questionText: { $first: "$questionText" },
          difficulty: { $first: "$difficulty" },
          answerCount: { $sum: 1 },
          correctAnswers: {
            $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] }
          },
          answers: { $push: "$studentAnswer" }
        }
      },
      {
        $match: { answerCount: { $gte: 5 } } // Minimum 5 answers for meaningful analysis
      },
      {
        $addFields: {
          successRate: { $divide: ["$correctAnswers", "$answerCount"] }
        }
      },
      {
        $sort: { answerCount: -1 }
      }
    ];

    const examAnswers = await this.db.collection("examAnswers").aggregate(pipeline).toArray();
    
    // Also check finalExams collection
    const finalExamsPipeline = [
      { $unwind: "$mergedAnswers" },
      {
        $group: {
          _id: "$mergedAnswers.questionId",
          questionText: { $first: "$mergedAnswers.questionText" },
          difficulty: { $first: "$mergedAnswers.difficulty" },
          answerCount: { $sum: 1 },
          correctAnswers: {
            $sum: { $cond: [{ $eq: ["$mergedAnswers.isCorrect", true] }, 1, 0] }
          },
          answers: { $push: "$mergedAnswers.studentAnswer" }
        }
      },
      {
        $match: { answerCount: { $gte: 5 } }
      },
      {
        $addFields: {
          successRate: { $divide: ["$correctAnswers", "$answerCount"] }
        }
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

  async analyzeQuestionInDepth(question) {
    console.log(`\n🔍 Deep analysis of Question ${question._id}:`);
    console.log(`   Text: ${question.questionText?.substring(0, 100)}...`);
    console.log(`   Difficulty: ${question.difficulty}`);
    console.log(`   Answers: ${question.answerCount}, Success rate: ${(question.successRate * 100).toFixed(1)}%`);
    
    // Get detailed student answers
    const answers = await this.getDetailedStudentAnswers(question._id);
    
    // Perform comprehensive pattern analysis
    const patterns = this.performAdvancedPatternDetection(answers, question);
    
    // Store analytics for this question
    this.questionAnalytics.set(question._id, {
      question: question,
      patterns: patterns,
      analytics: this.calculateQuestionAnalytics(answers, patterns)
    });
    
    // Generate comments based on patterns
    this.generateCommentsForQuestion(question, patterns);
    
    this.statistics.answersAnalyzed += answers.length;
  }

  async getDetailedStudentAnswers(questionId) {
    // Get comprehensive answer data from both collections
    const examAnswers = await this.db.collection("examAnswers")
      .find({ 
        $or: [
          { questionId: questionId.toString() },
          { questionId: parseInt(questionId) }
        ]
      })
      .project({
        studentAnswer: 1,
        isCorrect: 1,
        timeSpent: 1,
        difficulty: 1,
        studentEmail: 1,
        submittedAt: 1
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
            timeSpent: "$mergedAnswers.timeSpent",
            difficulty: "$mergedAnswers.difficulty",
            studentEmail: "$studentEmail",
            submittedAt: "$mergedAnswers.timestamp"
          }
        }
      ])
      .toArray();

    return [...examAnswers, ...finalExamAnswers];
  }

  performAdvancedPatternDetection(answers, question) {
    const patterns = {
      // Schema violations
      nonexistentTables: [],
      nonexistentColumns: [],
      weaponTrapUsage: [],
      invalidJoins: [],
      
      // SQL syntax issues
      missingWhere: [],
      incorrectWhere: [],
      missingJoin: [],
      wrongJoinType: [],
      
      // Aggregation issues
      missingGroupBy: [],
      unnecessaryGroupBy: [],
      wrongAggregateFunction: [],
      missingHaving: [],
      
      // Structure issues
      incompleteSelect: [],
      wrongTableChoice: [],
      overcomplicatedQuery: [],
      
      // Minor issues
      missingSemicolon: [],
      formattingIssues: [],
      
      // Positive patterns
      excellentAnswers: [],
      goodStructure: [],
      creativeSolutions: []
    };

    answers.forEach(answer => {
      const sql = (answer.studentAnswer || '').trim();
      const upperSQL = sql.toUpperCase();
      const isCorrect = answer.isCorrect;
      
      // Check for nonexistent tables
      ADVANCED_SCHEMA.trapTables.forEach(table => {
        const regex = new RegExp(`\\b${table.toUpperCase()}\\b`, 'i');
        if (regex.test(upperSQL)) {
          patterns.nonexistentTables.push({ sql, table, isCorrect });
        }
      });

      // Check for nonexistent columns
      Object.entries(ADVANCED_SCHEMA.trapColumns).forEach(([table, columns]) => {
        columns.forEach(column => {
          const patterns_check = [
            `${table}\\.${column}`,
            `${column}\\s+FROM\\s+${table}`,
            `SELECT\\s+.*${column}.*FROM\\s+${table}`
          ];
          
          patterns_check.forEach(pattern => {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(sql)) {
              patterns.nonexistentColumns.push({ sql, table, column, isCorrect });
            }
          });
        });
      });

      // Check for weapons.squadron_id trap (critical error)
      if (/weapons?\s*\.\s*squadron_id|squadron_id\s+from\s+weapons?/i.test(sql)) {
        patterns.weaponTrapUsage.push({ sql, isCorrect });
      }

      // Check for missing WHERE when question implies filtering
      const needsFiltering = question.questionText && (
        question.questionText.includes('ספציפי') ||
        question.questionText.includes('מסוים') ||
        question.questionText.includes('מעל') ||
        question.questionText.includes('פחות מ') ||
        question.questionText.includes('בשנת')
      );
      
      if (needsFiltering && upperSQL.includes('SELECT') && !upperSQL.includes('WHERE')) {
        patterns.missingWhere.push({ sql, isCorrect });
      }

      // Check for aggregation without GROUP BY
      const hasAggregation = /COUNT|SUM|AVG|MAX|MIN/.test(upperSQL);
      if (hasAggregation && !upperSQL.includes('GROUP BY') && !upperSQL.includes('HAVING')) {
        patterns.missingGroupBy.push({ sql, isCorrect });
      }

      // Check for missing semicolon
      if (!sql.endsWith(';')) {
        patterns.missingSemicolon.push({ sql, isCorrect });
      }

      // Identify excellent answers
      if (isCorrect && sql.length > 20 && sql.includes(';')) {
        patterns.excellentAnswers.push({ sql, isCorrect });
      }

      // Check for multiple issues (overcomplicated)
      const issueCount = [
        !isCorrect,
        sql.split('JOIN').length > 3,
        sql.split('WHERE').length > 2,
        sql.length > 200
      ].filter(Boolean).length;

      if (issueCount >= 2) {
        patterns.overcomplicatedQuery.push({ sql, isCorrect });
      }
    });

    return patterns;
  }

  calculateQuestionAnalytics(answers, patterns) {
    const total = answers.length;
    return {
      totalAnswers: total,
      correctAnswers: answers.filter(a => a.isCorrect).length,
      commonErrors: {
        schemaViolations: patterns.nonexistentTables.length + patterns.nonexistentColumns.length,
        syntaxErrors: patterns.missingWhere.length + patterns.missingJoin.length,
        aggregationErrors: patterns.missingGroupBy.length + patterns.wrongAggregateFunction.length
      },
      averageTimeSpent: answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / total,
      difficultyLevel: answers[0]?.difficulty || 'unknown'
    };
  }

  generateCommentsForQuestion(question, patterns) {
    const questionId = question._id;
    const questionText = question.questionText || '';
    const difficulty = question.difficulty || 'medium';
    const minOccurrences = this.getMinOccurrencesForPattern(patterns.nonexistentTables.length + patterns.nonexistentColumns.length);

    // Generate comments based on pattern frequency
    if (patterns.nonexistentTables.length >= minOccurrences) {
      this.addAdvancedComment(questionId, questionText, difficulty, COMPREHENSIVE_TEMPLATES.NONEXISTENT_TABLES);
      this.statistics.severityDistribution.critical++;
    }

    if (patterns.nonexistentColumns.length >= minOccurrences) {
      this.addAdvancedComment(questionId, questionText, difficulty, COMPREHENSIVE_TEMPLATES.NONEXISTENT_COLUMNS);
      this.statistics.severityDistribution.critical++;
    }

    if (patterns.weaponTrapUsage.length >= 1) {
      this.addAdvancedComment(questionId, questionText, difficulty, COMPREHENSIVE_TEMPLATES.WEAPON_SQUADRON_RELATIONSHIP);
      this.statistics.severityDistribution.critical++;
    }

    if (patterns.missingWhere.length >= Math.ceil(patterns.missingWhere.length * 0.3)) {
      this.addAdvancedComment(questionId, questionText, difficulty, COMPREHENSIVE_TEMPLATES.MISSING_WHERE_CLAUSE);
      this.statistics.severityDistribution.medium++;
    }

    if (patterns.missingGroupBy.length >= 2) {
      this.addAdvancedComment(questionId, questionText, difficulty, COMPREHENSIVE_TEMPLATES.MISSING_GROUP_BY);
      this.statistics.severityDistribution.medium++;
    }

    if (patterns.excellentAnswers.length >= 3) {
      this.addAdvancedComment(questionId, questionText, difficulty, COMPREHENSIVE_TEMPLATES.EXCELLENT_ANSWER);
    }

    // Add general comments for common minor issues
    if (patterns.missingSemicolon.length >= Math.ceil(patterns.missingSemicolon.length * 0.5)) {
      this.addAdvancedComment(questionId, questionText, difficulty, COMPREHENSIVE_TEMPLATES.MISSING_SEMICOLON);
      this.statistics.severityDistribution.low++;
    }

    console.log(`   Generated ${this.generatedComments.filter(c => c.questionId === questionId).length} comments`);
  }

  getMinOccurrencesForPattern(totalErrors) {
    // Dynamic threshold based on error frequency
    if (totalErrors >= 10) return 3;
    if (totalErrors >= 5) return 2;
    return 1;
  }

  addAdvancedComment(questionId, questionText, difficulty, template) {
    const comment = {
      questionId: parseInt(questionId),
      questionText: questionText,
      difficulty: difficulty,
      score: template.score,
      maxScore: this.getMaxScoreForDifficulty(difficulty),
      feedback: template.feedback,
      tags: template.tags || [],
      usageCount: 0,
      gradedBy: "auto_generator_advanced",
      gradedAt: new Date(),
      lastUsed: null,
      // Enhanced metadata
      severity: this.getSeverityFromScore(template.score),
      autoGenerated: true,
      version: "2.0"
    };

    // Check for duplicates
    const isDuplicate = this.generatedComments.some(existing => 
      existing.questionId === comment.questionId && 
      existing.feedback === comment.feedback
    );

    if (!isDuplicate) {
      this.generatedComments.push(comment);
      this.statistics.commentsGenerated++;
      
      // Track pattern detection
      template.tags.forEach(tag => {
        this.statistics.patternsDetected[tag] = (this.statistics.patternsDetected[tag] || 0) + 1;
      });
    }
  }

  getSeverityFromScore(score) {
    if (score >= 5) return 'critical';
    if (score >= 3) return 'high';
    if (score >= 1) return 'medium';
    return 'low';
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

  generateAdvancedComments() {
    console.log('\n🧠 Generating advanced domain-specific comments...');
    
    // Generate context-aware comments based on overall patterns
    const overallPatterns = this.analyzeOverallPatterns();
    
    // Air Force specific comments
    const domainComments = [
      {
        questionId: 0,
        questionText: "הערה כללית - חיל האוויר",
        difficulty: "general",
        score: 2,
        maxScore: 5,
        feedback: "שגיאה נפוצה: ערבוב בין מושגי חיל האוויר. יש להבחין בין בסיס, טייסת, וכלי טיס.",
        tags: ["domain", "air_force", "concepts"],
        usageCount: 0,
        gradedBy: "auto_generator_advanced",
        gradedAt: new Date(),
        lastUsed: null,
        severity: "medium",
        autoGenerated: true,
        version: "2.0"
      },
      {
        questionId: 0,
        questionText: "הערה כללית - יחסים",
        difficulty: "general",
        score: 3,
        maxScore: 5,
        feedback: "שגיאה ביחסי טבלאות: יש לזכור שכלי נשק מקושרים לבסיסים ולא לטייסות או טייסים.",
        tags: ["domain", "relationships", "weapons"],
        usageCount: 0,
        gradedBy: "auto_generator_advanced",
        gradedAt: new Date(),
        lastUsed: null,
        severity: "high",
        autoGenerated: true,
        version: "2.0"
      }
    ];

    this.generatedComments.push(...domainComments);
    this.statistics.commentsGenerated += domainComments.length;
  }

  analyzeOverallPatterns() {
    // Analyze patterns across all questions for meta-insights
    const overallStats = {
      mostCommonErrors: new Map(),
      difficultyTrends: new Map(),
      successRateByPattern: new Map()
    };

    this.questionAnalytics.forEach((analytics, questionId) => {
      // Track error patterns
      Object.entries(analytics.patterns).forEach(([pattern, occurrences]) => {
        if (occurrences.length > 0) {
          overallStats.mostCommonErrors.set(pattern, 
            (overallStats.mostCommonErrors.get(pattern) || 0) + occurrences.length);
        }
      });

      // Track difficulty trends
      const difficulty = analytics.question.difficulty;
      if (!overallStats.difficultyTrends.has(difficulty)) {
        overallStats.difficultyTrends.set(difficulty, { total: 0, errors: 0 });
      }
      
      const diffStats = overallStats.difficultyTrends.get(difficulty);
      diffStats.total += analytics.analytics.totalAnswers;
      diffStats.errors += (analytics.analytics.totalAnswers - analytics.analytics.correctAnswers);
    });

    return overallStats;
  }

  async saveCommentsToBank() {
    console.log('\n💾 Saving advanced comments to comment bank...');
    
    let savedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const comment of this.generatedComments) {
      try {
        // Check if similar comment exists
        const existing = await this.db.collection("commentBank").findOne({
          questionId: comment.questionId,
          feedback: comment.feedback
        });

        if (existing) {
          // Update if this is a newer version
          if (comment.version && (!existing.version || comment.version > existing.version)) {
            await this.db.collection("commentBank").updateOne(
              { _id: existing._id },
              { $set: comment }
            );
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          // Insert new comment
          await this.db.collection("commentBank").insertOne(comment);
          savedCount++;
        }
      } catch (error) {
        console.error(`❌ Error saving comment: ${error.message}`);
      }
    }

    console.log(`✅ Saved ${savedCount} new comments`);
    console.log(`🔄 Updated ${updatedCount} existing comments`);
    console.log(`⏭️  Skipped ${skippedCount} duplicate comments`);
  }

  generateAnalyticsReport() {
    console.log('\n📊 Advanced Analytics Report:');
    console.log('=' .repeat(50));
    console.log(`📚 Questions analyzed: ${this.statistics.questionsAnalyzed}`);
    console.log(`📝 Student answers analyzed: ${this.statistics.answersAnalyzed}`);
    console.log(`💬 Comments generated: ${this.statistics.commentsGenerated}`);
    
    console.log('\n🎯 Severity Distribution:');
    Object.entries(this.statistics.severityDistribution).forEach(([severity, count]) => {
      const emoji = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'medium' ? '🟡' : '🟢';
      console.log(`   ${emoji} ${severity}: ${count} comments`);
    });
    
    console.log('\n🔍 Top Error Patterns:');
    const sortedPatterns = Object.entries(this.statistics.patternsDetected)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
      
    sortedPatterns.forEach(([pattern, count]) => {
      console.log(`   - ${pattern}: ${count} occurrences`);
    });

    console.log('\n📈 Question Analytics Summary:');
    this.questionAnalytics.forEach((analytics, questionId) => {
      const q = analytics.question;
      const successRate = (q.correctAnswers / q.answerCount * 100).toFixed(1);
      console.log(`   Q${questionId}: ${successRate}% success rate (${q.answerCount} answers)`);
    });
  }
}

// Main execution function
async function main() {
  const generator = new AdvancedCommentBankGenerator();
  
  try {
    await generator.connect();
    await generator.analyzeAndGenerateComments();
  } catch (error) {
    console.error('❌ Advanced script failed:', error);
    process.exit(1);
  } finally {
    await generator.disconnect();
  }
  
  console.log('\n🎉 Advanced comment bank generation completed successfully!');
  console.log('💡 Generated comments are now available in the Grade by Question interface.');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AdvancedCommentBankGenerator, COMPREHENSIVE_TEMPLATES, ADVANCED_SCHEMA }; 