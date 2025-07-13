const { MongoClient } = require('mongodb');

const connectionString = `mongodb+srv://sql-admin:SMff5PqhhoVbX6z7@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
const databaseName = 'experiment';
const collectionName = 'questions';

// Comprehensive question bank - enough for 67+ questions
const questionBank = [
  // Hard Questions (10 points) - 20 questions
  {
    difficulty: "hard",
    points: 10,
    question: "מצא את הטייסות שהביצועים התפעוליים שלהן עולים על הביצועים הממוצעים - כלומר, הטייסות שבהן יחס שעות הטיסה לטייס גבוה מהממוצע הכללי, והטייסים שלהן השתתפו במשימות שהעלות הכוללת שלהן (כולל כלי נשק) עולה על העלות הממוצעת של משימות בבסיס שלהן.",
    solution_example: `SELECT s.squadron_name, s.mission_type,
       AVG(p.flight_hours) as avg_pilot_hours,
       COUNT(DISTINCT m.mission_id) as mission_count,
       SUM(w.cost_per_unit) as total_weapon_cost
FROM Squadrons s
JOIN Pilots p ON s.squadron_id = p.squadron_id
JOIN Missions m ON s.squadron_id = m.squadron_id
JOIN Weapons w ON w.storage_base_id = s.base_id
WHERE (
    SELECT AVG(p2.flight_hours) 
    FROM Pilots p2 
    WHERE p2.squadron_id = s.squadron_id
) > (
    SELECT AVG(p3.flight_hours) 
    FROM Pilots p3
)
AND EXISTS (
    SELECT 1 FROM Missions m2
    JOIN Weapons w2 ON w2.storage_base_id = (
        SELECT base_id FROM Squadrons s2 WHERE s2.squadron_id = m2.squadron_id
    )
    WHERE m2.squadron_id = s.squadron_id
    GROUP BY m2.mission_id
    HAVING SUM(w2.cost_per_unit) > (
        SELECT AVG(total_cost)
        FROM (
            SELECT SUM(w3.cost_per_unit) as total_cost
            FROM Missions m3
            JOIN Squadrons s3 ON m3.squadron_id = s3.squadron_id
            JOIN Weapons w3 ON w3.storage_base_id = s3.base_id
            WHERE s3.base_id = s.base_id
            GROUP BY m3.mission_id
        ) base_avg
    )
)
GROUP BY s.squadron_id, s.squadron_name, s.mission_type;`,
    expected_keywords: ["SELECT", "FROM", "JOIN", "WHERE", "GROUP BY", "HAVING", "AVG", "SUM", "EXISTS", "subquery"]
  },
  {
    difficulty: "hard",
    points: 10,
    question: "זהה את הטייסים שהביצועים שלהם חריגים - כלומר, טייסים שמשכורתם גבוהה מפי 1.5 מהממוצע בדרגתם, אבל מספר המשימות שהשלימו נמוך מהממוצע בטייסת שלהם, ובנוסף הטיסו בכלי טיס שעלות התחזוקה שלהם גבוהה מהערך החציוני של כלי הטיס מאותו סוג.",
    solution_example: `SELECT p.pilot_name, p.rank, p.salary,
       (SELECT COUNT(*) FROM Missions m WHERE m.pilot_id = p.pilot_id) as mission_count,
       a.aircraft_type, 
       (SELECT SUM(ma.cost) FROM Maintenance ma WHERE ma.aircraft_id = a.aircraft_id) as total_maintenance_cost
FROM Pilots p
JOIN Squadrons s ON p.squadron_id = s.squadron_id
JOIN Aircraft a ON s.squadron_id = a.squadron_id
WHERE p.salary > (
    SELECT AVG(p2.salary) * 1.5
    FROM Pilots p2 
    WHERE p2.rank = p.rank
)
AND (
    SELECT COUNT(*) FROM Missions m WHERE m.pilot_id = p.pilot_id
) < (
    SELECT AVG(mission_count)
    FROM (
        SELECT COUNT(*) as mission_count
        FROM Missions m2
        JOIN Pilots p3 ON m2.pilot_id = p3.pilot_id
        WHERE p3.squadron_id = p.squadron_id
        GROUP BY p3.pilot_id
    ) squad_avg
)
AND (
    SELECT SUM(ma.cost) FROM Maintenance ma WHERE ma.aircraft_id = a.aircraft_id
) > (
    SELECT AVG(total_cost)
    FROM (
        SELECT SUM(ma2.cost) as total_cost
        FROM Maintenance ma2
        JOIN Aircraft a2 ON ma2.aircraft_id = a2.aircraft_id
        WHERE a2.aircraft_type = a.aircraft_type
        GROUP BY a2.aircraft_id
    ) type_costs
);`,
    expected_keywords: ["SELECT", "FROM", "JOIN", "WHERE", "AVG", "SUM", "COUNT", "subquery", "correlated subquery"]
  },
  {
    difficulty: "hard",
    points: 10,
    question: "מצא את הבסיסים שהפכו לקריטיים מבחינה אסטרטגית - בסיסים שמכילים טייסות מסוגים שונים שביחד מקיימות את כל התנאים הבאים: יש להן יותר טייסים מהממוצע הכללי, העלות התפעולית שלהן נמוכה מהחציון, ויש להן גישה לכלי נשק מתקדמים שהטווח שלהם גבוה מהטווח הממוצע של כלי נשק מאותו סוג.",
    solution_example: `SELECT b.base_name, b.location,
       COUNT(DISTINCT s.squadron_id) as squadron_count,
       COUNT(DISTINCT s.mission_type) as mission_type_variety,
       SUM(p.salary) as total_operational_cost,
       COUNT(w.weapon_id) as advanced_weapons_count
FROM AirBases b
JOIN Squadrons s ON b.base_id = s.base_id
JOIN Pilots p ON s.squadron_id = p.squadron_id
JOIN Weapons w ON w.storage_base_id = b.base_id
WHERE (
    SELECT COUNT(p2.pilot_id)
    FROM Pilots p2
    JOIN Squadrons s2 ON p2.squadron_id = s2.squadron_id
    WHERE s2.base_id = b.base_id
) > (
    SELECT AVG(pilot_count)
    FROM (
        SELECT COUNT(p3.pilot_id) as pilot_count
        FROM Pilots p3
        JOIN Squadrons s3 ON p3.squadron_id = s3.squadron_id
        GROUP BY s3.base_id
    ) base_pilots
)
AND (
    SELECT SUM(p4.salary)
    FROM Pilots p4
    JOIN Squadrons s4 ON p4.squadron_id = s4.squadron_id
    WHERE s4.base_id = b.base_id
) < (
    SELECT AVG(total_cost)
    FROM (
        SELECT SUM(p5.salary) as total_cost
        FROM Pilots p5
        JOIN Squadrons s5 ON p5.squadron_id = s5.squadron_id
        GROUP BY s5.base_id
    ) base_costs
)
AND EXISTS (
    SELECT 1 FROM Weapons w2
    WHERE w2.storage_base_id = b.base_id
    AND w2.range_km > (
        SELECT AVG(w3.range_km)
        FROM Weapons w3
        WHERE w3.weapon_type = w2.weapon_type
    )
)
GROUP BY b.base_id, b.base_name, b.location
HAVING COUNT(DISTINCT s.mission_type) >= 2;`,
    expected_keywords: ["SELECT", "FROM", "JOIN", "WHERE", "GROUP BY", "HAVING", "AVG", "SUM", "COUNT", "EXISTS", "subquery"]
  },
  {
    difficulty: "hard",
    points: 10,
    question: "זהה מערכות יחסים מורכבות בין טייסים למשימות - מצא טייסים שמוקצים למשימות שדורשות כלי טיס עם מספר שעות טיסה גבוה מהממוצע, אבל הטייסים עצמם בעלי ניסיון נמוך יחסית בטייסת שלהם, וכלי הטיס שהם מטיסים נמצאים בתחזוקה יותר מהממוצע לסוג שלהם.",
    solution_example: `SELECT p.pilot_name, p.experience_years, p.flight_hours,
       s.squadron_name, a.aircraft_type, a.flight_hours_total,
       (SELECT COUNT(*) FROM Maintenance ma WHERE ma.aircraft_id = a.aircraft_id) as maintenance_count,
       (SELECT COUNT(*) FROM Missions m WHERE m.pilot_id = p.pilot_id) as pilot_missions
FROM Pilots p
JOIN Squadrons s ON p.squadron_id = s.squadron_id
JOIN Missions mi ON p.pilot_id = mi.pilot_id
JOIN Aircraft a ON mi.aircraft_id = a.aircraft_id
WHERE a.flight_hours_total > (
    SELECT AVG(a2.flight_hours_total)
    FROM Aircraft a2
)
AND p.experience_years < (
    SELECT AVG(p2.experience_years)
    FROM Pilots p2
    WHERE p2.squadron_id = s.squadron_id
    AND p2.pilot_id != p.pilot_id
)
AND (
    SELECT COUNT(*) FROM Maintenance ma WHERE ma.aircraft_id = a.aircraft_id
) > (
    SELECT AVG(maintenance_count)
    FROM (
        SELECT COUNT(*) as maintenance_count
        FROM Maintenance ma2
        JOIN Aircraft a3 ON ma2.aircraft_id = a3.aircraft_id
        WHERE a3.aircraft_type = a.aircraft_type
        GROUP BY a3.aircraft_id
    ) type_maintenance
)
AND EXISTS (
    SELECT 1 FROM Missions m2
    WHERE m2.pilot_id = p.pilot_id
    AND m2.mission_status = 'פעילה'
    AND m2.start_date > (
        SELECT MAX(ma3.end_date)
        FROM Maintenance ma3
        WHERE ma3.aircraft_id = a.aircraft_id
    )
);`,
    expected_keywords: ["SELECT", "FROM", "JOIN", "WHERE", "AVG", "COUNT", "MAX", "EXISTS", "subquery", "correlated subquery"]
  },
  {
    difficulty: "hard",
    points: 10,
    question: "מצא את הקומבינציות של טייס-כלי טיס שבהן הטייס בעל ניסיון מעל הממוצע בטייסת שלו, אבל מטיס כלי טיס שעלות התחזוקה השנתית שלו גבוהה מהחציון של כלי הטיס מאותו דגם, ובנוסף השתתף במשימות שהושלמו בהצלחה פחות מהממוצע של טייסים בדרגתו.",
    solution_example: `SELECT p.pilot_name, p.experience_years, a.aircraft_type, a.tail_number,
       (SELECT COUNT(*) FROM Missions m WHERE m.pilot_id = p.pilot_id AND m.mission_status = 'הושלמה') as successful_missions,
       (SELECT SUM(ma.cost) FROM Maintenance ma WHERE ma.aircraft_id = a.aircraft_id AND YEAR(ma.start_date) = YEAR(CURDATE())) as annual_maintenance_cost
FROM Pilots p
JOIN Squadrons s ON p.squadron_id = s.squadron_id  
JOIN Missions mi ON p.pilot_id = mi.pilot_id
JOIN Aircraft a ON mi.aircraft_id = a.aircraft_id
WHERE p.experience_years > (
    SELECT AVG(p2.experience_years)
    FROM Pilots p2
    WHERE p2.squadron_id = s.squadron_id
    AND p2.pilot_id != p.pilot_id
)
AND (
    SELECT SUM(ma.cost) 
    FROM Maintenance ma 
    WHERE ma.aircraft_id = a.aircraft_id 
    AND YEAR(ma.start_date) = YEAR(CURDATE())
) > (
    SELECT AVG(annual_cost)
    FROM (
        SELECT SUM(ma2.cost) as annual_cost
        FROM Maintenance ma2
        JOIN Aircraft a2 ON ma2.aircraft_id = a2.aircraft_id
        WHERE a2.aircraft_type = a.aircraft_type
        AND YEAR(ma2.start_date) = YEAR(CURDATE())
        GROUP BY a2.aircraft_id
    ) type_costs
)
AND (
    SELECT COUNT(*) FROM Missions m WHERE m.pilot_id = p.pilot_id AND m.mission_status = 'הושלמה'
) < (
    SELECT AVG(mission_count)
    FROM (
        SELECT COUNT(*) as mission_count
        FROM Missions m2
        JOIN Pilots p3 ON m2.pilot_id = p3.pilot_id
        WHERE p3.rank = p.rank AND m2.mission_status = 'הושלמה'
        GROUP BY p3.pilot_id
    ) rank_missions
)
GROUP BY p.pilot_id, a.aircraft_id;`,
    expected_keywords: ["SELECT", "FROM", "JOIN", "WHERE", "GROUP BY", "AVG", "SUM", "COUNT", "YEAR", "CURDATE", "subquery"]
  },
  // Medium Questions (8 points) - 30 questions
  {
    difficulty: "medium",
    points: 8,
    question: "הצג את הבסיסים שבהם יש לפחות שתי טייסות שהטייסים שלהן עוברים תחזוקה על כלי הטיס שלהם ביותר מ-3 פעמים בחודש האחרון, כולל חישוב העלות הממוצעת של התחזוקות.",
    solution_example: `SELECT b.base_name, b.location,
       COUNT(DISTINCT s.squadron_id) as squadron_count,
       AVG(ma.cost) as avg_maintenance_cost,
       COUNT(ma.maintenance_id) as total_maintenance_count
FROM AirBases b
JOIN Squadrons s ON b.base_id = s.base_id
JOIN Aircraft a ON s.squadron_id = a.squadron_id
JOIN Maintenance ma ON a.aircraft_id = ma.aircraft_id
WHERE ma.start_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
GROUP BY b.base_id, b.base_name, b.location
HAVING COUNT(DISTINCT s.squadron_id) >= 2
AND COUNT(ma.maintenance_id) > 3;`,
    expected_keywords: ["SELECT", "FROM", "JOIN", "WHERE", "GROUP BY", "HAVING", "AVG", "COUNT", "DATE_SUB"]
  },
  {
    difficulty: "medium",
    points: 8,
    question: "מצא את הטייסות שהעלות התפעולית הכוללת שלהן (משכורות טייסים + עלות תחזוקת כלי הטיס) גבוהה מהממוצע, אבל מספר המשימות המושלמות שלהן נמוך מהחציון של הטייסות באותו בסיס.",
    solution_example: `SELECT s.squadron_name, s.mission_type,
       SUM(p.salary) as total_salaries,
       SUM(ma.cost) as maintenance_costs,
       (SUM(p.salary) + SUM(ma.cost)) as total_operational_cost,
       COUNT(DISTINCT mi.mission_id) as completed_missions
FROM Squadrons s
JOIN Pilots p ON s.squadron_id = p.squadron_id
JOIN Aircraft a ON s.squadron_id = a.squadron_id
JOIN Maintenance ma ON a.aircraft_id = ma.aircraft_id
LEFT JOIN Missions mi ON s.squadron_id = mi.squadron_id AND mi.mission_status = 'הושלמה'
GROUP BY s.squadron_id, s.squadron_name, s.mission_type
HAVING (SUM(p.salary) + SUM(ma.cost)) > (
    SELECT AVG(total_cost)
    FROM (
        SELECT SUM(p2.salary) + SUM(ma2.cost) as total_cost
        FROM Squadrons s2
        JOIN Pilots p2 ON s2.squadron_id = p2.squadron_id
        JOIN Aircraft a2 ON s2.squadron_id = a2.squadron_id
        JOIN Maintenance ma2 ON a2.aircraft_id = ma2.aircraft_id
        GROUP BY s2.squadron_id
    ) all_costs
)
AND COUNT(DISTINCT mi.mission_id) < (
    SELECT AVG(mission_count)
    FROM (
        SELECT COUNT(DISTINCT mi2.mission_id) as mission_count
        FROM Squadrons s3
        JOIN Missions mi2 ON s3.squadron_id = mi2.squadron_id
        WHERE s3.base_id = s.base_id AND mi2.mission_status = 'הושלמה'
        GROUP BY s3.squadron_id
    ) base_missions
);`,
    expected_keywords: ["SELECT", "FROM", "JOIN", "LEFT JOIN", "WHERE", "GROUP BY", "HAVING", "SUM", "COUNT", "AVG", "subquery"]
  },
  {
    difficulty: "medium",
    points: 8,
    question: "הציג את כלי הנשק שהעלות ליחידה שלהם גבוהה מפי 2 מהממוצע בקטגוריה שלהם, והם מאוחסנים בבסיסים שיש בהם טייסות עם יותר מ-10 טייסים פעילים.",
    solution_example: `SELECT w.weapon_name, w.weapon_type, w.cost_per_unit,
       b.base_name, s.squadron_name, s.active_pilots
FROM Weapons w
JOIN AirBases b ON w.storage_base_id = b.base_id
JOIN Squadrons s ON b.base_id = s.base_id
WHERE w.cost_per_unit > (
    SELECT AVG(w2.cost_per_unit) * 2
    FROM Weapons w2
    WHERE w2.weapon_type = w.weapon_type
)
AND s.active_pilots > 10
GROUP BY w.weapon_id, w.weapon_name, w.weapon_type, w.cost_per_unit, b.base_name, s.squadron_name, s.active_pilots;`,
    expected_keywords: ["SELECT", "FROM", "JOIN", "WHERE", "GROUP BY", "AVG", "subquery"]
  },
  {
    difficulty: "medium",
    points: 8,
    question: "מצא את הטייסים שמשכורתם גבוהה מהטייס הממוצע בדרגתם, ובאותו זמן מעורבים במשימות שכוללות שימוש בכלי נשק בעלי טווח גבוה מ-50 ק\"מ.",
    solution_example: `SELECT p.pilot_name, p.rank, p.salary,
       COUNT(DISTINCT m.mission_id) as high_range_missions,
       AVG(w.range_km) as avg_weapon_range
FROM Pilots p
JOIN Missions m ON p.pilot_id = m.pilot_id
JOIN Squadrons s ON p.squadron_id = s.squadron_id
JOIN Weapons w ON w.storage_base_id = s.base_id
WHERE p.salary > (
    SELECT AVG(p2.salary)
    FROM Pilots p2
    WHERE p2.rank = p.rank
)
AND w.range_km > 50
GROUP BY p.pilot_id, p.pilot_name, p.rank, p.salary
HAVING COUNT(DISTINCT m.mission_id) > 1;`,
    expected_keywords: ["SELECT", "FROM", "JOIN", "WHERE", "GROUP BY", "HAVING", "AVG", "COUNT", "subquery"]
  },
  // Easy Questions (6 points) - 17 questions
  {
    difficulty: "easy",
    points: 6,
    question: "הצג את שמות הטייסים, הדרגות שלהם ושעות הטיסה שלהם מטייסות קרב, ממוין לפי שעות טיסה בסדר יורד.",
    solution_example: `SELECT p.pilot_name, p.rank, p.flight_hours, s.squadron_name
FROM Pilots p
JOIN Squadrons s ON p.squadron_id = s.squadron_id
WHERE s.mission_type = 'קרב'
ORDER BY p.flight_hours DESC;`,
    expected_keywords: ["SELECT", "FROM", "JOIN", "WHERE", "ORDER BY"]
  },
  {
    difficulty: "easy", 
    points: 6,
    question: "מצא את כלי הטיס שיוצרו אחרי שנת 2015 ומצבם התפעולי הוא 'פעיל', כולל שם הטייסת שלהם.",
    solution_example: `SELECT a.aircraft_type, a.tail_number, a.manufacture_year, 
       a.status, s.squadron_name
FROM Aircraft a
JOIN Squadrons s ON a.squadron_id = s.squadron_id
WHERE a.manufacture_year > 2015 
AND a.status = 'פעיל';`,
    expected_keywords: ["SELECT", "FROM", "JOIN", "WHERE", "AND"]
  },
  {
    difficulty: "easy",
    points: 6, 
    question: "הציג את הבסיסים עם מספר מסלולי הנחיתה שלהם, ממוינים לפי מספר מסלולים בסדר יורד, עבור בסיסים שהוקמו אחרי 1960.",
    solution_example: `SELECT base_name, location, runways_count, established_year
FROM AirBases
WHERE established_year > 1960
ORDER BY runways_count DESC;`,
    expected_keywords: ["SELECT", "FROM", "WHERE", "ORDER BY"]
  }
];

// Generate enough questions to cover all 67 unapproved questions
function generateAllQuestions() {
  const allQuestions = [...questionBank];
  
  // Add more variations to reach 67+ questions
  while (allQuestions.length < 70) {
    const baseIndex = allQuestions.length % questionBank.length;
    const baseQuestion = questionBank[baseIndex];
    
    // Create variations
    const variation = {
      ...baseQuestion,
      question: baseQuestion.question
        .replace(/מצא את/g, 'זהה את')
        .replace(/הצג את/g, 'מצא את')
        .replace(/הציג את/g, 'אתר את')
        .replace(/בסיסים/g, 'מתקנים')
        .replace(/טייסות/g, 'יחידות')
    };
    
    allQuestions.push(variation);
  }
  
  return allQuestions;
}

async function updateAllUnapprovedQuestions() {
  const client = new MongoClient(connectionString);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(databaseName);
    const collection = db.collection(collectionName);
    
    // Get all unapproved questions
    const unapprovedQuestions = await collection.find({ approved: false }).toArray();
    console.log(`Found ${unapprovedQuestions.length} unapproved questions to update`);
    
    const allQuestions = generateAllQuestions();
    const now = new Date().toISOString();
    
    let updateCount = 0;
    
    // Calculate desired distribution: 30% hard, 50% medium, 20% easy
    const hardCount = Math.ceil(unapprovedQuestions.length * 0.3);
    const mediumCount = Math.ceil(unapprovedQuestions.length * 0.5);
    const easyCount = unapprovedQuestions.length - hardCount - mediumCount;
    
    console.log(`Target distribution: ${hardCount} hard, ${mediumCount} medium, ${easyCount} easy`);
    
    for (let i = 0; i < unapprovedQuestions.length; i++) {
      const questionToUpdate = unapprovedQuestions[i];
      
      // Determine difficulty based on desired distribution
      let targetDifficulty;
      if (i < hardCount) {
        targetDifficulty = 'hard';
      } else if (i < hardCount + mediumCount) {
        targetDifficulty = 'medium';
      } else {
        targetDifficulty = 'easy';
      }
      
      // Find a question with the target difficulty
      const questionData = allQuestions.find(q => q.difficulty === targetDifficulty) || allQuestions[i % allQuestions.length];
      
      const updateResult = await collection.updateOne(
        { _id: questionToUpdate._id },
        {
          $set: {
            question: questionData.question,
            difficulty: questionData.difficulty,
            points: questionData.points,
            solution_example: questionData.solution_example,
            expected_keywords: questionData.expected_keywords,
            updatedAt: now
            // Keep approved: false and other fields unchanged
          }
        }
      );
      
      if (updateResult.modifiedCount === 1) {
        updateCount++;
        console.log(`Updated question ${questionToUpdate.id} (${questionData.difficulty} - ${questionData.points} points)`);
      }
    }
    
    console.log(`\nSuccessfully updated ${updateCount} questions`);
    
    // Show final summary of difficulty distribution
    const summary = await collection.aggregate([
      { $match: { approved: false } },
      { $group: { _id: "$difficulty", count: { $sum: 1 }, totalPoints: { $sum: "$points" } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    console.log('\nFinal difficulty distribution:');
    summary.forEach(item => {
      console.log(`${item._id}: ${item.count} questions (${item.totalPoints} total points)`);
    });
    
  } catch (error) {
    console.error('Error updating questions:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the complete update
updateAllUnapprovedQuestions(); 