const { MongoClient } = require('mongodb');

// Connection details (update these as needed)
const connectionString = `mongodb+srv://sql-admin:SMff5PqhhoVbX6z7@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
const databaseName = 'experiment';
const collectionName = 'questions';

// Enhanced question templates for each difficulty
const enhancedQuestions = {
  easy: {
    templates: [
      {
        question: "כתוב שאילתה שמחזירה את שמות הטייסים, הדרגות שלהם, שעות הטיסה שלהם וההתמחות שלהם מטבלת Pilots עם מיון לפי שעות טיסה.",
        solution: `SELECT pilot_name, rank, flight_hours, specialty 
FROM Pilots 
WHERE flight_hours > 500 
ORDER BY flight_hours DESC;`,
        keywords: ["SELECT", "FROM", "WHERE", "ORDER BY"],
        explanation: "4 שורות + אופרטור השוואה + פונקציית מיון"
      },
      {
        question: "כתוב שאילתה שמחזירה את כלי הטיס שיוצרו אחרי שנת 2010, עם המהירות המרבית והטווח שלהם, ממוינים לפי מהירות מרבית.",
        solution: `SELECT aircraft_type, tail_number, max_speed, range_km 
FROM Aircraft 
WHERE manufacture_year > 2010 
ORDER BY max_speed DESC;`,
        keywords: ["SELECT", "FROM", "WHERE", "ORDER BY"],
        explanation: "4 שורות + אופרטור השוואה + פונקציית מיון"
      },
      {
        question: "כתוב שאילתה שמחזירה את כמות כלי הנשק המסוכנים (עלות מעל 500 אלפי ש״ח) לכל סוג נשק עם השימוש בפונקציית COUNT.",
        solution: `SELECT weapon_type, COUNT(*) as dangerous_weapons_count
FROM Weapons 
WHERE cost_per_unit > 500000
GROUP BY weapon_type;`,
        keywords: ["SELECT", "COUNT", "FROM", "WHERE", "GROUP BY"],
        explanation: "4 שורות + פונקציית ספירה + אופרטור השוואה"
      }
    ]
  },
  medium: {
    templates: [
      {
        question: "כתוב שאילתה שמחזירה את שמות הטייסים ושמות הטייסות שלהם, כולל הבסיס בו הטייסת נמצאת, עבור טייסים עם יותר מ-1000 שעות טיסה.",
        solution: `SELECT p.pilot_name, s.squadron_name, b.base_name, p.flight_hours
FROM Pilots p 
JOIN Squadrons s ON p.squadron_id = s.squadron_id
JOIN AirBases b ON s.base_id = b.base_id
WHERE p.flight_hours > 1000;`,
        keywords: ["SELECT", "FROM", "JOIN", "WHERE", "ON"],
        explanation: "שילוב של 3 טבלאות עם JOIN כפול"
      },
      {
        question: "כתוב שאילתה שמחזירה את הטייסות שהמשכורת הממוצעת של הטייסים שלהן גבוהה מ-20,000 ש״ח ויש להן יותר מ-5 טייסים.",
        solution: `SELECT s.squadron_name, AVG(p.salary) as avg_salary, COUNT(p.pilot_id) as pilot_count
FROM Squadrons s
JOIN Pilots p ON s.squadron_id = p.squadron_id
GROUP BY s.squadron_id, s.squadron_name
HAVING AVG(p.salary) > 20000 AND COUNT(p.pilot_id) > 5;`,
        keywords: ["SELECT", "AVG", "COUNT", "FROM", "JOIN", "GROUP BY", "HAVING"],
        explanation: "איחוד 2 טבלאות + התניה מורכבת עם HAVING"
      },
      {
        question: "כתוב שאילתה שמציגה את הטייסים שמשכורתם גבוהה מהמשכורת הממוצעת של כל הטייסים באותה דרגה (תת-שאילתה).",
        solution: `SELECT p1.pilot_name, p1.rank, p1.salary
FROM Pilots p1
WHERE p1.salary > (
    SELECT AVG(p2.salary) 
    FROM Pilots p2 
    WHERE p2.rank = p1.rank
);`,
        keywords: ["SELECT", "FROM", "WHERE", "AVG", "subquery"],
        explanation: "תת-שאילתה מתואמת + פונקציה מצטברת"
      }
    ]
  },
  hard: {
    templates: [
      {
        question: "כתוב שאילתה מורכבת שמחזירה את הטייסות שהעלות התפעולית הכוללת שלהן (משכורות + עלות טיסה חודשית) היא הגבוהה ביותר, כולל יצירת view זמני וחישובי DDL.",
        solution: `-- יצירת VIEW לחישוב עלויות
CREATE VIEW squadron_costs AS
SELECT s.squadron_id, s.squadron_name,
       SUM(p.salary) as total_salaries,
       SUM(a.cost_per_hour * 20) as monthly_flight_costs,
       (SUM(p.salary) + SUM(a.cost_per_hour * 20)) as total_cost
FROM Squadrons s
JOIN Pilots p ON s.squadron_id = p.squadron_id
JOIN Aircraft a ON s.squadron_id = a.squadron_id
GROUP BY s.squadron_id, s.squadron_name;

-- שאילתה ראשית עם תת-שאילתות כפולות
SELECT sc.squadron_name, sc.total_cost,
       (SELECT COUNT(*) FROM Pilots p WHERE p.squadron_id = sc.squadron_id) as pilot_count,
       (SELECT COUNT(*) FROM Aircraft a WHERE a.squadron_id = sc.squadron_id) as aircraft_count
FROM squadron_costs sc
WHERE sc.total_cost = (
    SELECT MAX(sc2.total_cost) 
    FROM squadron_costs sc2
);

-- ניקוי DDL
DROP VIEW squadron_costs;`,
        keywords: ["CREATE VIEW", "SELECT", "SUM", "JOIN", "GROUP BY", "MAX", "subquery", "DROP VIEW"],
        explanation: "אלגברת יחסים + 2 רמות תת-שאילתות + 3 טבלאות + AGG עם פונקציה + VIEW + DDL+DML"
      },
      {
        question: "כתוב שאילתה מתקדמת שמזהה בסיסים קריטיים - כאלה שיש בהם גם טייסות קרב וגם כלי נשק מתקדמים, עם חישוב יעילות תפעולית דרך תת-שאילתות מקוננות ושילוב טבלאות רבות.",
        solution: `-- יצירת טבלת עזר לחישוב יעילות
CREATE TEMPORARY TABLE base_efficiency AS
SELECT b.base_id, b.base_name,
       COUNT(DISTINCT s.squadron_id) as squadron_count,
       COUNT(DISTINCT p.pilot_id) as pilot_count,
       COUNT(DISTINCT a.aircraft_id) as aircraft_count
FROM AirBases b
JOIN Squadrons s ON b.base_id = s.base_id
JOIN Pilots p ON s.squadron_id = p.squadron_id
JOIN Aircraft a ON s.squadron_id = a.squadron_id
GROUP BY b.base_id, b.base_name;

-- שאילתה ראשית עם תת-שאילתות רב-רמתיות
SELECT DISTINCT b.base_name, be.pilot_count, be.aircraft_count,
       (SELECT COUNT(*) 
        FROM Weapons w 
        WHERE w.storage_base_id = b.base_id 
        AND w.cost_per_unit > (
            SELECT AVG(w2.cost_per_unit) * 1.5 
            FROM Weapons w2
        )) as advanced_weapons_count,
       ROUND((be.pilot_count * 1.0 / be.aircraft_count), 2) as pilot_aircraft_ratio
FROM AirBases b
JOIN base_efficiency be ON b.base_id = be.base_id
WHERE EXISTS (
    SELECT 1 FROM Squadrons s 
    WHERE s.base_id = b.base_id 
    AND s.mission_type = 'קרב'
) 
AND EXISTS (
    SELECT 1 FROM Weapons w 
    WHERE w.storage_base_id = b.base_id 
    AND w.weapon_type IN ('אוויר-אוויר', 'אוויר-קרקע')
    AND w.cost_per_unit > (
        SELECT AVG(w3.cost_per_unit) 
        FROM Weapons w3 
        WHERE w3.weapon_type = w.weapon_type
    )
)
ORDER BY pilot_aircraft_ratio DESC;

-- ניקוי
DROP TEMPORARY TABLE base_efficiency;`,
        keywords: ["CREATE TEMPORARY TABLE", "SELECT", "COUNT", "EXISTS", "AVG", "JOIN", "subquery", "nested subquery", "DROP TABLE"],
        explanation: "אלגברת יחסים + 3+ רמות תת-שאילתות + 4 טבלאות + AGG מורכב + VIEW זמני + DDL+DML"
      },
      {
        question: "כתוב מערכת שאילתות מתקדמת לניתוח אסטרטגי של כוח אוויר - מציאת הקומבינציה האופטימלית של טייסות לפי יעילות, עלות ויכולת, עם אלגברת יחסים מורכבת.",
        solution: `-- יצירת VIEW לחישוב מדדי ביצועים
CREATE VIEW squadron_performance AS
SELECT s.squadron_id, s.squadron_name, s.mission_type,
       COUNT(p.pilot_id) as pilot_count,
       AVG(p.flight_hours) as avg_pilot_experience,
       SUM(p.salary) as total_salary_cost,
       COUNT(a.aircraft_id) as aircraft_count,
       AVG(a.cost_per_hour) as avg_operation_cost,
       COUNT(m.mission_id) as completed_missions
FROM Squadrons s
LEFT JOIN Pilots p ON s.squadron_id = p.squadron_id
LEFT JOIN Aircraft a ON s.squadron_id = a.squadron_id
LEFT JOIN Missions m ON s.squadron_id = m.squadron_id AND m.mission_status = 'הושלמה'
GROUP BY s.squadron_id, s.squadron_name, s.mission_type;

-- שאילתה ראשית עם תת-שאילתות מקוננות מרובות
WITH top_performers AS (
    SELECT squadron_id, 
           (completed_missions * 1.0 / NULLIF(pilot_count, 0)) as efficiency_ratio,
           (total_salary_cost / NULLIF(pilot_count, 0)) as cost_per_pilot
    FROM squadron_performance
    WHERE pilot_count > 0
),
cost_leaders AS (
    SELECT squadron_id
    FROM top_performers
    WHERE cost_per_pilot < (
        SELECT AVG(cost_per_pilot) 
        FROM top_performers
    )
),
efficiency_leaders AS (
    SELECT squadron_id
    FROM top_performers
    WHERE efficiency_ratio > (
        SELECT AVG(efficiency_ratio) 
        FROM top_performers 
        WHERE efficiency_ratio > 0
    )
)

-- שאילתת המסקנה הסופית
SELECT sp.squadron_name, sp.mission_type,
       sp.pilot_count, sp.aircraft_count,
       ROUND(tp.efficiency_ratio, 3) as efficiency,
       ROUND(tp.cost_per_pilot, 0) as cost_efficiency,
       (SELECT COUNT(*) 
        FROM Weapons w 
        WHERE w.storage_base_id = (
            SELECT base_id 
            FROM Squadrons s2 
            WHERE s2.squadron_id = sp.squadron_id
        )) as available_weapons,
       CASE 
           WHEN cl.squadron_id IS NOT NULL AND el.squadron_id IS NOT NULL THEN 'אופטימלי'
           WHEN cl.squadron_id IS NOT NULL THEN 'חסכוני'
           WHEN el.squadron_id IS NOT NULL THEN 'יעיל'
           ELSE 'רגיל'
       END as strategic_rating
FROM squadron_performance sp
JOIN top_performers tp ON sp.squadron_id = tp.squadron_id
LEFT JOIN cost_leaders cl ON sp.squadron_id = cl.squadron_id
LEFT JOIN efficiency_leaders el ON sp.squadron_id = el.squadron_id
ORDER BY 
    CASE 
        WHEN cl.squadron_id IS NOT NULL AND el.squadron_id IS NOT NULL THEN 1
        WHEN cl.squadron_id IS NOT NULL THEN 2
        WHEN el.squadron_id IS NOT NULL THEN 3
        ELSE 4
    END,
    tp.efficiency_ratio DESC;

-- ניקוי
DROP VIEW squadron_performance;`,
        keywords: ["CREATE VIEW", "WITH", "CTE", "SELECT", "COUNT", "AVG", "SUM", "CASE", "subquery", "nested subquery", "JOIN", "LEFT JOIN", "ORDER BY", "DROP VIEW"],
        explanation: "אלגברת יחסים מתקדמת + 3+ רמות תת-שאילתות + 5+ טבלאות + AGG מורכב עם פונקציות + CTE + VIEW + DDL+DML מתקדם"
      }
    ]
  }
};

// Function to analyze if a question meets the criteria
function analyzeQuestion(question, difficulty) {
  const solution = question.solution_example || '';
  const lines = solution.split('\n').filter(line => line.trim().length > 0);
  
  switch (difficulty) {
    case 'easy':
      // Easy: At least 4 lines, at least one operator or function
      const hasMinLines = lines.length >= 4;
      const hasOperatorOrFunction = /\b(WHERE|ORDER BY|GROUP BY|COUNT|SUM|AVG|MAX|MIN|>\s*|<\s*|=\s*|>=\s*|<=\s*|BETWEEN|LIKE)\b/i.test(solution);
      return hasMinLines && hasOperatorOrFunction;
      
    case 'medium':
      // Medium: 2+ tables (union, intersection, join) OR subquery OR data saving OR complex condition
      const hasTwoTables = /\bJOIN\b/i.test(solution) || /\bUNION\b/i.test(solution) || /\bINTERSECT\b/i.test(solution);
      const hasSubquery = /\(\s*SELECT\b/i.test(solution);
      const hasComplexCondition = /\bHAVING\b/i.test(solution) || (solution.match(/\bWHERE\b/gi) && solution.match(/\bAND\b|\bOR\b/gi));
      const hasDataSaving = /\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(solution);
      return hasTwoTables || hasSubquery || hasComplexCondition || hasDataSaving;
      
    case 'hard':
      // Hard: 2+ levels of subqueries, 3+ tables, AGG with function, VIEW, DDL+DML
      const subqueryCount = (solution.match(/\(\s*SELECT\b/gi) || []).length;
      const tableCount = (solution.match(/\bFROM\s+\w+|\bJOIN\s+\w+/gi) || []).length;
      const hasAggWithFunction = /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i.test(solution) && /\b(GROUP BY|HAVING)\b/i.test(solution);
      const hasView = /\bCREATE\s+VIEW\b|\bDROP\s+VIEW\b/i.test(solution);
      const hasDDLDML = (/\bCREATE\b|\bDROP\b|\bALTER\b/i.test(solution)) && (/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(solution));
      return subqueryCount >= 2 && tableCount >= 3 && hasAggWithFunction && (hasView || hasDDLDML);
      
    default:
      return false;
  }
}

// Function to select an appropriate enhanced question
function selectEnhancedQuestion(originalQuestion, difficulty) {
  const templates = enhancedQuestions[difficulty]?.templates || [];
  if (templates.length === 0) return null;
  
  // Try to find a template that's contextually similar or just pick randomly
  const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
  
  return {
    question: randomTemplate.question,
    solution_example: randomTemplate.solution,
    expected_keywords: randomTemplate.keywords,
    points: difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 15
  };
}

async function updateQuestions() {
  let client;
  
  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(databaseName);
    const collection = db.collection(collectionName);
    
    console.log('Fetching all questions...');
    const questions = await collection.find({}).toArray();
    
    console.log(`Found ${questions.length} questions to analyze`);
    
    let updatedCount = 0;
    
    for (const question of questions) {
      const difficulty = question.difficulty;
      console.log(`\nAnalyzing question ${question.id || question._id} (${difficulty})...`);
      
      const meetsConstraints = analyzeQuestion(question, difficulty);
      
      if (!meetsConstraints) {
        console.log(`Question ${question.id || question._id} does NOT meet ${difficulty} criteria. Updating...`);
        
        const enhancement = selectEnhancedQuestion(question, difficulty);
        
        if (enhancement) {
          const updateData = {
            question: enhancement.question,
            solution_example: enhancement.solution_example,
            expected_keywords: enhancement.expected_keywords,
            points: enhancement.points,
            updatedAt: new Date()
          };
          
          const result = await collection.updateOne(
            { _id: question._id },
            { $set: updateData }
          );
          
          if (result.modifiedCount > 0) {
            updatedCount++;
            console.log(`✅ Updated question ${question.id || question._id}`);
            console.log(`   New question: ${enhancement.question.substring(0, 100)}...`);
          } else {
            console.log(`❌ Failed to update question ${question.id || question._id}`);
          }
        }
      } else {
        console.log(`✅ Question ${question.id || question._id} already meets ${difficulty} criteria`);
      }
    }
    
    console.log(`\n🎉 Update complete! Updated ${updatedCount} out of ${questions.length} questions.`);
    
  } catch (error) {
    console.error('Error updating questions:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('Disconnected from MongoDB');
    }
  }
}

// Run the update
console.log('Starting question update process...');
console.log('This will update questions that do not meet the specified criteria:\n');
console.log('EASY: At least 4 lines + at least one operator or function');
console.log('MEDIUM: 2+ tables (join/union/intersection) OR subquery OR complex condition OR data saving');
console.log('HARD: 2+ levels of subqueries + 3+ tables + aggregation with functions + views + DDL+DML\n');

updateQuestions(); 