const { MongoClient } = require('mongodb');

// MongoDB connection configuration
const dbUserName = "sql-admin";
const dbPassword = "SMff5PqhhoVbX6z7";
const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
const DATABASE_NAME = 'experiment';
const COLLECTION_NAME = 'questions';

// Air Force Database Schema Definition
const SCHEMA = {
  AirBases: {
    nameHe: 'בסיסי חיל האוויר',
    columns: [
      'base_id', 'base_name', 'base_code', 'location', 'established_year', 
      'runways_count', 'personnel_capacity'
    ]
  },
  Squadrons: {
    nameHe: 'טייסות',
    columns: [
      'squadron_id', 'squadron_name', 'squadron_number', 'base_id', 
      'aircraft_type', 'established_date', 'active_status'
    ]
  },
  Pilots: {
    nameHe: 'טייסים',
    columns: [
      'pilot_id', 'first_name', 'last_name', 'rank', 'squadron_id', 
      'flight_hours', 'specialization', 'service_start_date'
    ]
  },
  Aircraft: {
    nameHe: 'כלי טיס',
    columns: [
      'aircraft_id', 'aircraft_type', 'tail_number', 'squadron_id',
      'manufacture_year', 'last_maintenance', 'flight_hours_total', 'operational_status'
    ]
  },
  Weapons: {
    nameHe: 'כלי נשק ותחמושת',
    columns: [
      'weapon_id', 'weapon_name', 'weapon_type', 'base_id',
      'quantity_available', 'unit_cost', 'minimum_stock'
    ]
  },
  Missions: {
    nameHe: 'משימות ותפעול',
    columns: [
      'mission_id', 'mission_name', 'mission_date', 'squadron_id',
      'pilot_id', 'aircraft_id', 'mission_duration', 'mission_status'
    ]
  },
  Maintenance: {
    nameHe: 'תחזוקה',
    columns: [
      'maintenance_id', 'aircraft_id', 'maintenance_type',
      'start_date', 'end_date', 'cost'
    ]
  }
};

// SQL Solution Generator
function generateSQLSolution(question, expectedKeywords, difficulty) {
  const questionText = question.toLowerCase();
  let sql = '';

  // Analyze question to determine required tables and operations
  const tableMapping = {
    'בסיס': 'AirBases',
    'בסיסים': 'AirBases',
    'טייסת': 'Squadrons', 
    'טייסות': 'Squadrons',
    'טייס': 'Pilots',
    'טייסים': 'Pilots',
    'כלי טיס': 'Aircraft',
    'מטוס': 'Aircraft',
    'מטוסים': 'Aircraft',
    'נשק': 'Weapons',
    'תחמושת': 'Weapons',
    'משימה': 'Missions',
    'משימות': 'Missions',
    'תחזוקה': 'Maintenance'
  };

  // Determine primary table
  let primaryTable = null;
  for (const [hebrew, english] of Object.entries(tableMapping)) {
    if (questionText.includes(hebrew)) {
      primaryTable = english;
      break;
    }
  }

  // Default to Aircraft if no table detected
  if (!primaryTable) {
    primaryTable = 'Aircraft';
  }

  // Handle specific question patterns
  if (questionText.includes('אלגברה') || expectedKeywords.includes('σ') || expectedKeywords.includes('π')) {
    // Algebra questions
    if (expectedKeywords.includes('σ')) {
      sql = generateSelectionAlgebra(question, primaryTable);
    } else if (expectedKeywords.includes('π')) {
      sql = generateProjectionAlgebra(question, primaryTable);
    } else if (expectedKeywords.includes('∪')) {
      sql = generateUnionAlgebra(question, primaryTable);
    } else if (expectedKeywords.includes('⋈')) {
      sql = generateJoinAlgebra(question);
    } else if (expectedKeywords.includes('−')) {
      sql = generateDifferenceAlgebra(question, primaryTable);
    }
  } else {
    // SQL queries
    if (expectedKeywords.includes('COUNT') || questionText.includes('כמות') || questionText.includes('מספר')) {
      sql = generateCountQuery(question, primaryTable);
    } else if (expectedKeywords.includes('AVG') || questionText.includes('ממוצע')) {
      sql = generateAverageQuery(question, primaryTable);
    } else if (expectedKeywords.includes('SUM') || questionText.includes('סך') || questionText.includes('כוללת')) {
      sql = generateSumQuery(question, primaryTable);
    } else if (expectedKeywords.includes('JOIN') || questionText.includes('שמות') && questionText.includes('ו')) {
      sql = generateJoinQuery(question, primaryTable);
    } else if (expectedKeywords.includes('GROUP BY') || questionText.includes('לכל') || questionText.includes('בכל')) {
      sql = generateGroupByQuery(question, primaryTable);
    } else if (expectedKeywords.includes('HAVING')) {
      sql = generateHavingQuery(question, primaryTable);
    } else if (expectedKeywords.includes('subquery') || questionText.includes('גבוה מ') && questionText.includes('ממוצע')) {
      sql = generateSubquery(question, primaryTable);
    } else {
      sql = generateBasicSelectQuery(question, primaryTable);
    }
  }

  return sql.trim();
}

function generateBasicSelectQuery(question, table) {
  const questionText = question.toLowerCase();
  let columns = '*';
  let whereClause = '';

  // Determine columns based on question
  if (questionText.includes('שם')) {
    if (table === 'AirBases') columns = 'base_name';
    else if (table === 'Squadrons') columns = 'squadron_name';
    else if (table === 'Pilots') columns = 'first_name, last_name';
    else if (table === 'Aircraft') columns = 'aircraft_type, tail_number';
    else if (table === 'Weapons') columns = 'weapon_name';
    else if (table === 'Missions') columns = 'mission_name';
  }

  // Generate WHERE conditions
  if (questionText.includes('צפון')) {
    whereClause = "WHERE location = 'צפון'";
  } else if (questionText.includes('f-16')) {
    whereClause = "WHERE aircraft_type = 'F-16'";
  } else if (questionText.includes('f-35')) {
    whereClause = "WHERE aircraft_type = 'F-35'";
  } else if (questionText.includes('פעיל')) {
    if (table === 'Aircraft') whereClause = "WHERE operational_status = 'פעיל'";
    else if (table === 'Squadrons') whereClause = "WHERE active_status = true";
  } else if (questionText.includes('הושלמה')) {
    whereClause = "WHERE mission_status = 'הושלמה'";
  } else if (questionText.includes('מעל') && questionText.includes('1000')) {
    if (table === 'AirBases') whereClause = "WHERE personnel_capacity > 1000";
    else if (table === 'Pilots') whereClause = "WHERE flight_hours > 1000";
  } else if (questionText.includes('לפני') && questionText.includes('1950')) {
    whereClause = "WHERE established_year < 1950";
  } else if (questionText.includes('אחרי') && questionText.includes('2010')) {
    whereClause = "WHERE manufacture_year > 2010";
  }

  return `SELECT ${columns} FROM ${table} ${whereClause};`;
}

function generateCountQuery(question, table) {
  const questionText = question.toLowerCase();
  let sql = `SELECT `;
  
  if (questionText.includes('לכל') || questionText.includes('בכל')) {
    if (table === 'Pilots' && questionText.includes('בסיס')) {
      sql += `base_id, COUNT(*) as pilot_count FROM ${table} GROUP BY base_id`;
    } else if (table === 'Aircraft' && questionText.includes('טייסת')) {
      sql += `squadron_id, COUNT(*) as aircraft_count FROM ${table} GROUP BY squadron_id`;
    } else {
      sql += `COUNT(*) FROM ${table}`;
    }
  } else {
    sql += `COUNT(*) FROM ${table}`;
  }

  return sql + ';';
}

function generateAverageQuery(question, table) {
  const questionText = question.toLowerCase();
  let sql = 'SELECT ';
  
  if (questionText.includes('משכורת')) {
    sql += `squadron_id, AVG(salary) as avg_salary FROM Pilots GROUP BY squadron_id`;
  } else if (questionText.includes('שעות טיסה')) {
    sql += `squadron_id, AVG(flight_hours) as avg_flight_hours FROM Pilots GROUP BY squadron_id`;
  } else if (questionText.includes('עלות')) {
    sql += `aircraft_type, AVG(unit_cost) as avg_cost FROM ${table} GROUP BY aircraft_type`;
  } else {
    sql += `AVG(flight_hours) FROM ${table}`;
  }

  return sql + ';';
}

function generateSumQuery(question, table) {
  const questionText = question.toLowerCase();
  let sql = 'SELECT ';
  
  if (questionText.includes('עלות') && questionText.includes('לכל')) {
    sql += `weapon_type, SUM(unit_cost * quantity_available) as total_value FROM Weapons GROUP BY weapon_type`;
  } else if (questionText.includes('שעות') && questionText.includes('כוללות')) {
    sql += `squadron_id, SUM(flight_hours_total) as total_hours FROM Aircraft GROUP BY squadron_id`;
  } else {
    sql += `SUM(quantity_available) FROM ${table}`;
  }

  return sql + ';';
}

function generateJoinQuery(question, primaryTable) {
  const questionText = question.toLowerCase();
  
  if (questionText.includes('טייס') && questionText.includes('טייסת')) {
    return `SELECT p.first_name, p.last_name, s.squadron_name FROM Pilots p JOIN Squadrons s ON p.squadron_id = s.squadron_id;`;
  } else if (questionText.includes('טייס') && questionText.includes('בסיס')) {
    return `SELECT p.first_name, p.last_name, b.base_name FROM Pilots p JOIN AirBases b ON p.base_id = b.base_id;`;
  } else if (questionText.includes('כלי טיס') && questionText.includes('טייסת')) {
    return `SELECT a.tail_number, s.squadron_name FROM Aircraft a JOIN Squadrons s ON a.squadron_id = s.squadron_id;`;
  } else if (questionText.includes('משימה') && questionText.includes('טייס')) {
    return `SELECT m.mission_name, p.first_name, p.last_name FROM Missions m JOIN Pilots p ON m.pilot_id = p.pilot_id;`;
  }
  
  return `SELECT * FROM ${primaryTable};`;
}

function generateGroupByQuery(question, table) {
  return generateCountQuery(question, table);
}

function generateHavingQuery(question, table) {
  const questionText = question.toLowerCase();
  
  if (questionText.includes('יותר מ') && questionText.includes('20')) {
    return `SELECT base_id, COUNT(*) as pilot_count FROM Pilots GROUP BY base_id HAVING COUNT(*) > 20;`;
  } else if (questionText.includes('יותר מ') && questionText.includes('50')) {
    return `SELECT base_id, COUNT(*) as weapon_count FROM Weapons GROUP BY base_id HAVING COUNT(*) > 50;`;
  }
  
  return `SELECT ${table.toLowerCase()}_id, COUNT(*) FROM ${table} GROUP BY ${table.toLowerCase()}_id HAVING COUNT(*) > 1;`;
}

function generateSubquery(question, table) {
  const questionText = question.toLowerCase();
  
  if (questionText.includes('שעות טיסה') && questionText.includes('ממוצע')) {
    return `SELECT first_name, last_name, flight_hours FROM Pilots WHERE flight_hours > (SELECT AVG(flight_hours) FROM Pilots);`;
  } else if (questionText.includes('עלות') && questionText.includes('ממוצע')) {
    return `SELECT tail_number, unit_cost FROM Aircraft WHERE unit_cost > (SELECT AVG(unit_cost) FROM Aircraft);`;
  } else if (questionText.includes('טייסים') && questionText.includes('ממוצע')) {
    return `SELECT squadron_name FROM Squadrons WHERE active_pilots > (SELECT AVG(active_pilots) FROM Squadrons);`;
  }
  
  return `SELECT * FROM ${table} WHERE ${table.toLowerCase()}_id > (SELECT AVG(${table.toLowerCase()}_id) FROM ${table});`;
}

// Algebra expression generators
function generateSelectionAlgebra(question, table) {
  const questionText = question.toLowerCase();
  
  if (questionText.includes('f-16')) {
    return `σ_aircraft_type='F-16'(Aircraft)`;
  } else if (questionText.includes('רס"ן')) {
    return `σ_rank='רס"ן'(Pilots)`;
  } else if (questionText.includes('עדיפות 5')) {
    return `σ_priority_level=5(Missions)`;
  } else if (questionText.includes('מעל 100')) {
    return `σ_quantity_available>100(Weapons)`;
  }
  
  return `σ_condition(${table})`;
}

function generateProjectionAlgebra(question, table) {
  const questionText = question.toLowerCase();
  
  if (questionText.includes('weapon_name') && questionText.includes('cost')) {
    return `π_weapon_name,unit_cost(Weapons)`;
  } else if (questionText.includes('base_name') && questionText.includes('location')) {
    return `π_base_name,location(AirBases)`;
  } else if (questionText.includes('pilot_name') && questionText.includes('rank')) {
    return `π_first_name,last_name,rank(Pilots)`;
  } else if (questionText.includes('aircraft_type') && questionText.includes('max_speed')) {
    return `π_aircraft_type,max_speed(Aircraft)`;
  }
  
  return `π_column1,column2(${table})`;
}

function generateUnionAlgebra(question, table) {
  if (question.includes('רמת דוד') && question.includes('חצרים')) {
    return `σ_base_id=1(Pilots) ∪ σ_base_id=2(Pilots)`;
  } else if (question.includes('סיווג 9') && question.includes('סיווג 10')) {
    return `σ_security_clearance=9(Pilots) ∪ σ_security_clearance=10(Pilots)`;
  } else if (question.includes('מרכז') && question.includes('דרום')) {
    return `σ_location='מרכז'(AirBases) ∪ σ_location='דרום'(AirBases)`;
  }
  
  return `σ_condition1(${table}) ∪ σ_condition2(${table})`;
}

function generateJoinAlgebra(question) {
  if (question.includes('F-35') && question.includes('Squadrons')) {
    return `σ_aircraft_type='F-35'(Squadrons ⋈_Squadrons.squadron_id=Aircraft.squadron_id Aircraft)`;
  } else if (question.includes('צפון') && question.includes('Pilots')) {
    return `σ_location='צפון'(Pilots ⋈_Pilots.base_id=AirBases.base_id AirBases)`;
  } else if (question.includes('ביטחון מעל 9')) {
    return `σ_security_level>9(Weapons ⋈_Weapons.base_id=AirBases.base_id AirBases)`;
  }
  
  return `Table1 ⋈_condition Table2`;
}

function generateDifferenceAlgebra(question, table) {
  if (question.includes('אוויר-אוויר')) {
    return `Weapons − σ_weapon_type='אוויר-אוויר'(Weapons)`;
  } else if (question.includes('אימון')) {
    return `Squadrons − σ_mission_type='אימון'(Squadrons)`;
  } else if (question.includes('סיווג מתחת ל-7')) {
    return `Pilots − σ_security_clearance<7(Pilots)`;
  }
  
  return `${table} − σ_condition(${table})`;
}

// Main execution function
async function updateQuestionSolutions() {
  let client;
  let updateCount = 0;
  let errorCount = 0;
  const errors = [];

  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(connectionString);
    await client.connect();
    console.log('✅ Connected to MongoDB successfully!');

    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Fetch all questions
    console.log('📖 Fetching all questions from collection...');
    const questions = await collection.find({}).sort({ id: 1 }).toArray();
    console.log(`📊 Found ${questions.length} questions to process`);

    // Process each question
    for (const question of questions) {
      try {
        console.log(`\n🔄 Processing question ${question.id}: ${question.question.substring(0, 50)}...`);
        
        const newSolution = generateSQLSolution(
          question.question,
          question.expected_keywords || [],
          question.difficulty
        );

        // Only update if the solution is different
        if (question.solution_example !== newSolution) {
          const result = await collection.updateOne(
            { _id: question._id },
            { 
              $set: { 
                solution_example: newSolution,
                last_updated: new Date()
              }
            }
          );

          if (result.modifiedCount > 0) {
            updateCount++;
            console.log(`✅ Updated question ${question.id}`);
            console.log(`   Old: ${question.solution_example}`);
            console.log(`   New: ${newSolution}`);
          }
        } else {
          console.log(`⏭️  Question ${question.id} already has correct solution`);
        }

      } catch (error) {
        errorCount++;
        const errorMsg = `Error processing question ${question.id}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    // Summary
    console.log('\n🎉 Update process completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total questions processed: ${questions.length}`);
    console.log(`   - Successfully updated: ${updateCount}`);
    console.log(`   - Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(error => console.log(`   - ${error}`));
    }

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Execute the update
if (require.main === module) {
  updateQuestionSolutions()
    .then(() => {
      console.log('✨ Script completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateQuestionSolutions, generateSQLSolution }; 