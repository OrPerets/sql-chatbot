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

// Improved SQL Solution Generator
function generateImprovedSQLSolution(questionText, expectedKeywords, difficulty) {
  const question = questionText.toLowerCase();
  const keywords = expectedKeywords || [];
  
  // Handle Relational Algebra expressions
  if (keywords.includes('σ') || keywords.includes('π') || keywords.includes('∪') || 
      keywords.includes('⋈') || keywords.includes('−') || question.includes('אלגברה')) {
    return generateAlgebraExpression(question, keywords);
  }
  
  // Handle complex SQL queries
  return generateComplexSQL(question, keywords, difficulty);
}

function generateAlgebraExpression(question, keywords) {
  // Selection (σ)
  if (keywords.includes('σ')) {
    if (question.includes('f-16')) {
      return `σ_aircraft_type='F-16'(Aircraft)`;
    } else if (question.includes('רס"ן')) {
      return `σ_rank='רס"ן'(Pilots)`;
    } else if (question.includes('עדיפות')) {
      return `σ_priority_level=5(Missions)`;
    } else if (question.includes('מעל 100')) {
      return `σ_quantity_available>100(Weapons)`;
    }
    return `σ_condition(Table)`;
  }
  
  // Projection (π)
  if (keywords.includes('π')) {
    if (question.includes('weapon_name') && question.includes('cost')) {
      return `π_weapon_name,unit_cost(Weapons)`;
    } else if (question.includes('base_name') && question.includes('location')) {
      return `π_base_name,location(AirBases)`;
    } else if (question.includes('pilot_name') && question.includes('rank')) {
      return `π_first_name,last_name,rank(Pilots)`;
    }
    return `π_column1,column2(Table)`;
  }
  
  // Union (∪)
  if (keywords.includes('∪')) {
    if (question.includes('רמת דוד') && question.includes('חצרים')) {
      return `σ_base_id=1(Pilots) ∪ σ_base_id=2(Pilots)`;
    } else if (question.includes('מרכז') && question.includes('דרום')) {
      return `σ_location='מרכז'(AirBases) ∪ σ_location='דרום'(AirBases)`;
    }
    return `σ_condition1(Table) ∪ σ_condition2(Table)`;
  }
  
  // Join (⋈)
  if (keywords.includes('⋈')) {
    if (question.includes('f-35') && question.includes('squadrons')) {
      return `σ_aircraft_type='F-35'(Squadrons ⋈_Squadrons.squadron_id=Aircraft.squadron_id Aircraft)`;
    } else if (question.includes('צפון')) {
      return `σ_location='צפון'(Pilots ⋈_Pilots.base_id=AirBases.base_id AirBases)`;
    }
    return `Table1 ⋈_condition Table2`;
  }
  
  // Difference (−)
  if (keywords.includes('−')) {
    if (question.includes('אוויר-אוויר')) {
      return `Weapons − σ_weapon_type='אוויר-אוויר'(Weapons)`;
    } else if (question.includes('אימון')) {
      return `Squadrons − σ_mission_type='אימון'(Squadrons)`;
    }
    return `Table − σ_condition(Table)`;
  }
  
  return `σ_condition(Table)`;
}

function generateComplexSQL(question, keywords, difficulty) {
  // Analyze question to determine primary operations and tables
  const operations = analyzeOperations(question, keywords);
  const tables = analyzeTables(question);
  
  // Generate SQL based on complexity and keywords
  if (keywords.includes('HAVING') || (keywords.includes('GROUP BY') && keywords.includes('COUNT') && (question.includes('יותר מ') || question.includes('פחות מ')))) {
    return generateHavingQuery(question, tables, keywords);
  }
  
  if (keywords.includes('subquery') || (question.includes('ממוצע') && (question.includes('גבוה מ') || question.includes('נמוך מ')))) {
    return generateSubquerySQL(question, tables, keywords);
  }
  
  if (keywords.includes('LEFT JOIN') || keywords.includes('RIGHT JOIN') || keywords.includes('FULL JOIN')) {
    return generateOuterJoinSQL(question, tables, keywords);
  }
  
  if (keywords.includes('JOIN') && (keywords.includes('COUNT') || keywords.includes('SUM') || keywords.includes('AVG'))) {
    return generateAggregateJoinSQL(question, tables, keywords);
  }
  
  if (keywords.includes('GROUP BY') && (keywords.includes('COUNT') || keywords.includes('SUM') || keywords.includes('AVG'))) {
    return generateGroupBySQL(question, tables, keywords);
  }
  
  if (keywords.includes('JOIN')) {
    return generateJoinSQL(question, tables, keywords);
  }
  
  if (keywords.includes('WHERE') && (keywords.includes('AND') || keywords.includes('OR'))) {
    return generateComplexWhereSQL(question, tables, keywords);
  }
  
  // Default to basic SELECT
  return generateBasicSQL(question, tables, keywords);
}

function analyzeOperations(question, keywords) {
  const operations = [];
  if (keywords.includes('COUNT') || question.includes('כמות') || question.includes('מספר')) operations.push('COUNT');
  if (keywords.includes('AVG') || question.includes('ממוצע')) operations.push('AVG');
  if (keywords.includes('SUM') || question.includes('סך') || question.includes('כוללת')) operations.push('SUM');
  if (keywords.includes('MAX') || question.includes('מרבי') || question.includes('גבוה ביותר')) operations.push('MAX');
  if (keywords.includes('MIN') || question.includes('מינימלי') || question.includes('נמוך ביותר')) operations.push('MIN');
  return operations;
}

function analyzeTables(question) {
  const tables = [];
  if (question.includes('בסיס') || question.includes('בסיסים')) tables.push('AirBases');
  if (question.includes('טייסת') || question.includes('טייסות')) tables.push('Squadrons');
  if (question.includes('טייס') || question.includes('טייסים')) tables.push('Pilots');
  if (question.includes('כלי טיס') || question.includes('מטוס') || question.includes('מטוסים')) tables.push('Aircraft');
  if (question.includes('נשק') || question.includes('תחמושת')) tables.push('Weapons');
  if (question.includes('משימה') || question.includes('משימות')) tables.push('Missions');
  if (question.includes('תחזוקה')) tables.push('Maintenance');
  
  return tables.length > 0 ? tables : ['Aircraft']; // Default table
}

function generateHavingQuery(question, tables, keywords) {
  const primaryTable = tables[0];
  
  if (question.includes('טייסים') && question.includes('יותר מ-20')) {
    return `SELECT base_id, COUNT(*) as pilot_count FROM Pilots GROUP BY base_id HAVING COUNT(*) > 20;`;
  }
  
  if (question.includes('כלי נשק') && question.includes('יותר מ-50')) {
    return `SELECT base_id, COUNT(*) as weapon_count FROM Weapons GROUP BY base_id HAVING COUNT(*) > 50;`;
  }
  
  if (question.includes('טייסות') && question.includes('יותר מ-2')) {
    return `SELECT base_id, COUNT(*) as squadron_count FROM Squadrons GROUP BY base_id HAVING COUNT(*) > 2;`;
  }
  
  if (question.includes('משכורת') && question.includes('ממוצע') && question.includes('יותר מ')) {
    return `SELECT s.squadron_name, AVG(p.salary) as avg_salary, COUNT(p.pilot_id) as pilot_count
FROM Squadrons s
JOIN Pilots p ON s.squadron_id = p.squadron_id
GROUP BY s.squadron_id, s.squadron_name
HAVING AVG(p.salary) > 20000 AND COUNT(p.pilot_id) > 5;`;
  }
  
  return `SELECT ${primaryTable.toLowerCase()}_id, COUNT(*) FROM ${primaryTable} GROUP BY ${primaryTable.toLowerCase()}_id HAVING COUNT(*) > 1;`;
}

function generateSubquerySQL(question, tables, keywords) {
  if (question.includes('שעות טיסה') && question.includes('ממוצע')) {
    return `SELECT first_name, last_name, flight_hours FROM Pilots WHERE flight_hours > (SELECT AVG(flight_hours) FROM Pilots);`;
  }
  
  if (question.includes('עלות') && question.includes('ממוצע')) {
    return `SELECT tail_number, unit_cost FROM Aircraft WHERE unit_cost > (SELECT AVG(unit_cost) FROM Aircraft);`;
  }
  
  if (question.includes('טייסים') && question.includes('פעילים') && question.includes('ממוצע')) {
    return `SELECT squadron_name FROM Squadrons WHERE active_pilots > (SELECT AVG(active_pilots) FROM Squadrons);`;
  }
  
  if (question.includes('מלאי') && question.includes('ממוצע')) {
    return `SELECT weapon_name, quantity_available FROM Weapons WHERE quantity_available < (SELECT AVG(quantity_available) FROM Weapons);`;
  }
  
  return `SELECT * FROM ${tables[0]} WHERE ${tables[0].toLowerCase()}_id > (SELECT AVG(${tables[0].toLowerCase()}_id) FROM ${tables[0]});`;
}

function generateOuterJoinSQL(question, tables, keywords) {
  if (question.includes('כלי טיס') && question.includes('טייסת') && keywords.includes('LEFT JOIN')) {
    return `SELECT a.tail_number, s.squadron_name FROM Aircraft a LEFT JOIN Squadrons s ON a.squadron_id = s.squadron_id;`;
  }
  
  if (question.includes('בסיס') && question.includes('מפקד') && keywords.includes('LEFT JOIN')) {
    return `SELECT b.base_name, b.base_commander FROM AirBases b LEFT JOIN Squadrons s ON b.base_id = s.base_id;`;
  }
  
  return `SELECT a.*, b.* FROM ${tables[0]} a LEFT JOIN ${tables[1] || 'Squadrons'} b ON a.id = b.id;`;
}

function generateAggregateJoinSQL(question, tables, keywords) {
  if (question.includes('כמות') && question.includes('כלי טיס') && question.includes('טייסת')) {
    return `SELECT s.squadron_number, COUNT(*) as aircraft_count FROM Aircraft a JOIN Squadrons s ON a.squadron_id = s.squadron_id GROUP BY s.squadron_number ORDER BY s.squadron_number;`;
  }
  
  if (question.includes('משכורת') && question.includes('ממוצע') && question.includes('טייסת')) {
    return `SELECT squadron_id, AVG(salary) as avg_salary FROM Pilots GROUP BY squadron_id;`;
  }
  
  if (question.includes('עלות') && question.includes('כוללת') && question.includes('סוג')) {
    return `SELECT weapon_type, SUM(unit_cost * quantity_available) as total_value FROM Weapons GROUP BY weapon_type;`;
  }
  
  return `SELECT COUNT(*) FROM ${tables[0]};`;
}

function generateGroupBySQL(question, tables, keywords) {
  const primaryTable = tables[0];
  
  if (question.includes('כמות') && question.includes('טייסים') && question.includes('בסיס')) {
    return `SELECT base_id, COUNT(*) as pilot_count FROM Pilots GROUP BY base_id;`;
  }
  
  if (question.includes('מספר') && question.includes('משימות') && question.includes('טייסת')) {
    return `SELECT squadron_id, COUNT(*) as mission_count FROM Missions GROUP BY squadron_id;`;
  }
  
  if (question.includes('שעות') && question.includes('כוללות') && question.includes('טייסת')) {
    return `SELECT squadron_id, SUM(flight_hours_total) as total_hours FROM Aircraft GROUP BY squadron_id;`;
  }
  
  return `SELECT ${primaryTable.toLowerCase()}_id, COUNT(*) FROM ${primaryTable} GROUP BY ${primaryTable.toLowerCase()}_id;`;
}

function generateJoinSQL(question, tables, keywords) {
  if (question.includes('טייס') && question.includes('טייסת') && question.includes('שם')) {
    return `SELECT p.first_name, p.last_name, s.squadron_name FROM Pilots p JOIN Squadrons s ON p.squadron_id = s.squadron_id;`;
  }
  
  if (question.includes('טייס') && question.includes('בסיס') && question.includes('שם')) {
    return `SELECT p.first_name, p.last_name, b.base_name FROM Pilots p JOIN AirBases b ON p.base_id = b.base_id;`;
  }
  
  if (question.includes('כלי טיס') && question.includes('טייסת')) {
    return `SELECT a.tail_number, s.squadron_name FROM Aircraft a JOIN Squadrons s ON a.squadron_id = s.squadron_id;`;
  }
  
  if (question.includes('משימה') && question.includes('טייס')) {
    return `SELECT m.mission_name, p.first_name, p.last_name FROM Missions m JOIN Pilots p ON m.pilot_id = p.pilot_id;`;
  }
  
  if (tables.length >= 3) {
    return `SELECT p.first_name, p.last_name, b.base_name, s.squadron_name FROM Pilots p JOIN AirBases b ON p.base_id = b.base_id JOIN Squadrons s ON p.squadron_id = s.squadron_id;`;
  }
  
  return `SELECT * FROM ${tables[0]} a JOIN ${tables[1] || 'Squadrons'} b ON a.id = b.id;`;
}

function generateComplexWhereSQL(question, tables, keywords) {
  const primaryTable = tables[0];
  let whereClause = '';
  let columns = '*';
  
  // Determine columns
  if (question.includes('שם')) {
    if (primaryTable === 'AirBases') columns = 'base_name';
    else if (primaryTable === 'Squadrons') columns = 'squadron_name';
    else if (primaryTable === 'Pilots') columns = 'first_name, last_name';
    else if (primaryTable === 'Aircraft') columns = 'aircraft_type, tail_number';
    else if (primaryTable === 'Weapons') columns = 'weapon_name';
    else if (primaryTable === 'Missions') columns = 'mission_name';
  }
  
  // Complex WHERE conditions
  if (question.includes('בסיס') && question.includes('rmd') && question.includes('משכורת') && question.includes('17000')) {
    return `SELECT p.first_name, p.last_name FROM Pilots p JOIN AirBases a ON p.base_id = a.base_id WHERE a.base_code = 'RMD' AND p.salary > 17000;`;
  }
  
  if (question.includes('גיל') && question.includes('25-35')) {
    whereClause = 'WHERE age BETWEEN 25 AND 35';
  } else if (question.includes('יותר מ-1000') && question.includes('שעות')) {
    whereClause = 'WHERE flight_hours > 1000';
  } else if (question.includes('אחרי') && question.includes('2010')) {
    whereClause = 'WHERE manufacture_year > 2010';
  } else if (question.includes('לפני') && question.includes('1950')) {
    whereClause = 'WHERE established_year < 1950';
  }
  
  // Add ORDER BY if specified
  let orderBy = '';
  if (keywords.includes('ORDER BY')) {
    if (question.includes('מהירות')) {
      orderBy = ' ORDER BY max_speed DESC';
    } else if (question.includes('שעות טיסה')) {
      orderBy = ' ORDER BY flight_hours DESC';
    }
  }
  
  return `SELECT ${columns} FROM ${primaryTable} ${whereClause}${orderBy};`;
}

function generateBasicSQL(question, tables, keywords) {
  const primaryTable = tables[0];
  let columns = '*';
  let whereClause = '';
  
  if (question.includes('שם')) {
    if (primaryTable === 'AirBases') columns = 'base_name';
    else if (primaryTable === 'Squadrons') columns = 'squadron_name';
    else if (primaryTable === 'Pilots') columns = 'first_name, last_name';
    else if (primaryTable === 'Aircraft') columns = 'aircraft_type, tail_number';
    else if (primaryTable === 'Weapons') columns = 'weapon_name';
    else if (primaryTable === 'Missions') columns = 'mission_name';
  }
  
  if (question.includes('צפון')) {
    whereClause = "WHERE location = 'צפון'";
  } else if (question.includes('f-16')) {
    whereClause = "WHERE aircraft_type = 'F-16'";
  } else if (question.includes('פעיל')) {
    if (primaryTable === 'Aircraft') whereClause = "WHERE operational_status = 'פעיל'";
    else if (primaryTable === 'Missions') whereClause = "WHERE mission_status = 'הושלמה'";
  }
  
  return `SELECT ${columns} FROM ${primaryTable} ${whereClause};`;
}

// Main execution function
async function updateQuestionSolutionsImproved() {
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
        
        const newSolution = generateImprovedSQLSolution(
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
            console.log(`   Old: ${question.solution_example?.substring(0, 100)}...`);
            console.log(`   New: ${newSolution.substring(0, 100)}...`);
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
  updateQuestionSolutionsImproved()
    .then(() => {
      console.log('✨ Script completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateQuestionSolutionsImproved, generateImprovedSQLSolution }; 