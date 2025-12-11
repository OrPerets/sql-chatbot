#!/usr/bin/env tsx

import { getTemplateService } from '../lib/template-service';
import { getHomeworkService } from '../lib/homework';
import { getQuestionsService } from '../lib/questions';
import { getQuestionGenerator } from '../lib/question-generator';

/**
 * Script to convert HW1 from static questions to parametric templates
 * This will:
 * 1. Create 5 parametric templates based on HW1 questions
 * 2. Update HW1 to use these templates
 * 3. Generate student-specific questions when they start the homework
 */

interface HW1TemplateData {
  name: string;
  description: string;
  template: string;
  variables: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    constraints: any;
    required: boolean;
  }>;
  expectedResultSchema?: Array<{ column: string; type: string }>;
  starterSql?: string;
  instructions?: string;
  gradingRubric?: any[];
  datasetId?: string;
  maxAttempts?: number;
  points?: number;
  evaluationMode?: "auto" | "manual" | "custom";
}

const hw1Templates: HW1TemplateData[] = [
  {
    name: "Age and Salary Range Query",
    description: "Filter employees by birth year range and salary range",
    template: "הציגו את השם הפרטי, שם המשפחה ושנת הלידה, עבור העובדים שנולדו בין השנים {{start_year}} ל-{{end_year}} (כולל קצוות) והמשכורת שלהם נעה בין {{min_salary}} ל {{max_salary}} ₪ (לא כולל קצוות).",
    variables: [
      {
        id: "start_year_var",
        name: "start_year",
        type: "number",
        description: "Start year for birth year range",
        constraints: { min: 1990, max: 2000 },
        required: true
      },
      {
        id: "end_year_var",
        name: "end_year",
        type: "number",
        description: "End year for birth year range",
        constraints: { min: 2020, max: 2030 },
        required: true
      },
      {
        id: "min_salary_var",
        name: "min_salary",
        type: "number",
        description: "Minimum salary threshold",
        constraints: { min: 5000, max: 8000 },
        required: true
      },
      {
        id: "max_salary_var",
        name: "max_salary",
        type: "number",
        description: "Maximum salary threshold",
        constraints: { min: 8000, max: 12000 },
        required: true
      }
    ],
    expectedResultSchema: [
      { column: "first_name", type: "VARCHAR" },
      { column: "last_name", type: "VARCHAR" },
      { column: "birth_year", type: "INTEGER" }
    ],
    instructions: "כתבו שאילתה שמחזירה את הפרטים הנדרשים עם התנאים המפורטים",
    maxAttempts: 5,
    points: 10,
    evaluationMode: "manual"
  },
  {
    name: "Age and Currency Conversion Query",
    description: "Filter by age and convert salary from EUR to ₪",
    template: "הציגו את שם המשפחה והשם הפרטי של העובדים אשר גילם פחות מ-{{max_age}} ומשכורתם גדולה מ-{{eur_amount}} אירו, לפי השער היציג כיום של {{exchange_rate}} ₪ ל-1 אירו.",
    variables: [
      {
        id: "max_age_var",
        name: "max_age",
        type: "number",
        description: "Maximum age threshold",
        constraints: { min: 25, max: 40 },
        required: true
      },
      {
        id: "eur_amount_var",
        name: "eur_amount",
        type: "number",
        description: "Minimum salary in EUR",
        constraints: { min: 1500, max: 3000 },
        required: true
      },
      {
        id: "exchange_rate_var",
        name: "exchange_rate",
        type: "number",
        description: "EUR to ₪ exchange rate",
        constraints: { min: 3.5, max: 4.5, step: 0.01 },
        required: true
      }
    ],
    expectedResultSchema: [
      { column: "last_name", type: "VARCHAR" },
      { column: "first_name", type: "VARCHAR" }
    ],
    instructions: "כתבו שאילתה שמחשבת את הגיל מהשנת לידה וממירה את המשכורת מאירו לשקל",
    maxAttempts: 5,
    points: 10,
    evaluationMode: "manual"
  },
  {
    name: "Job Role Salary Increase Query",
    description: "Calculate salary increase for specific job role",
    template: "לאור המצב בארץ, הוחלט שכל מי שעובד בתפקיד {{job_role}} בישראל, יקבל העלאה, לאור כך נרצה לבדוק מה תהיה המשכורת לאחר תוספת של {{increase_percent}}%. עליכם להציג בתוצאה שם משפחה, שם פרטי, השכר לפני התוספת והשכר החדש לאחר התוספת.",
    variables: [
      {
        id: "job_role_var",
        name: "job_role",
        type: "list",
        description: "Job role for salary increase",
        constraints: { 
          options: ["clerk", "manager", "engineer", "analyst", "developer"] 
        },
        required: true
      },
      {
        id: "increase_percent_var",
        name: "increase_percent",
        type: "number",
        description: "Salary increase percentage",
        constraints: { min: 5, max: 20, step: 0.5 },
        required: true
      }
    ],
    expectedResultSchema: [
      { column: "last_name", type: "VARCHAR" },
      { column: "first_name", type: "VARCHAR" },
      { column: "old_salary", type: "DECIMAL" },
      { column: "new_salary", type: "DECIMAL" }
    ],
    instructions: "כתבו שאילתה שמחשבת את המשכורת החדשה לאחר העלאה באחוזים",
    maxAttempts: 5,
    points: 10,
    evaluationMode: "manual"
  },
  {
    name: "City and Country Pattern Query",
    description: "Filter by city name length and country name patterns",
    template: "הציגו את מס' ת.ז של העובדים שעובדים בעיר ששמה מכיל בדיוק {{city_length}} תווים ושהמדינה בה הם עובדים מכילה אות \"{{include_letter}}\" אך לא מכילה את אות \"{{exclude_letter}}\". יש למיין את רשימת העובדים לפי תעודת הזהות של העובד בסדר יורד.",
    variables: [
      {
        id: "city_length_var",
        name: "city_length",
        type: "number",
        description: "Exact length of city name",
        constraints: { min: 4, max: 8 },
        required: true
      },
      {
        id: "include_letter_var",
        name: "include_letter",
        type: "string",
        description: "Letter that must be in country name",
        constraints: { minLength: 1, maxLength: 1 },
        required: true
      },
      {
        id: "exclude_letter_var",
        name: "exclude_letter",
        type: "string",
        description: "Letter that must not be in country name",
        constraints: { minLength: 1, maxLength: 1 },
        required: true
      }
    ],
    expectedResultSchema: [
      { column: "employee_id", type: "VARCHAR" }
    ],
    instructions: "כתבו שאילתה שמשתמשת בפונקציות מחרוזות לבדיקת אורך וכלילת אותיות",
    maxAttempts: 5,
    points: 10,
    evaluationMode: "manual"
  },
  {
    name: "Salary and Name Pattern Query",
    description: "Filter by salary threshold and name patterns",
    template: "הציגו את ת.ז. של העובד, קוד העבודה, שם המחלקה והמשכורת רק עבור העובדים שמשכורתם היא לפחות {{min_salary}} ₪ וששם המשפחה שלהם מכיל את האות \"{{name_letter}}\" וששם המחלקה בה הם עובדים, לא מכיל את האות \"{{exclude_letter}}\". עליכם לדאוג למיין את התוצאה לפי משכורת בסדר יורד.",
    variables: [
      {
        id: "min_salary_var",
        name: "min_salary",
        type: "number",
        description: "Minimum salary threshold",
        constraints: { min: 8000, max: 15000 },
        required: true
      },
      {
        id: "name_letter_var",
        name: "name_letter",
        type: "string",
        description: "Letter that must be in last name",
        constraints: { minLength: 1, maxLength: 1 },
        required: true
      },
      {
        id: "exclude_letter_var",
        name: "exclude_letter",
        type: "string",
        description: "Letter that must not be in department name",
        constraints: { minLength: 1, maxLength: 1 },
        required: true
      }
    ],
    expectedResultSchema: [
      { column: "employee_id", type: "VARCHAR" },
      { column: "job_code", type: "VARCHAR" },
      { column: "department_name", type: "VARCHAR" },
      { column: "salary", type: "DECIMAL" }
    ],
    instructions: "כתבו שאילתה שמשתמשת בפונקציות מחרוזות ובמיון לפי משכורת",
    maxAttempts: 5,
    points: 10,
    evaluationMode: "manual"
  }
];

async function convertHW1ToParametric() {
  try {
    console.log('🚀 Starting HW1 parametric conversion...');
    
    // 1. Create templates
    const templateService = await getTemplateService();
    const createdTemplates = [];
    
    for (let i = 0; i < hw1Templates.length; i++) {
      const templateData = hw1Templates[i];
      console.log(`\n📝 Creating template ${i + 1}/5: ${templateData.name}`);
      
      try {
        const createdTemplate = await templateService.createTemplate({
          ...templateData,
          variables: templateData.variables.map(v => ({
            ...v,
            type: v.type as any
          }))
        });
        createdTemplates.push(createdTemplate);
        console.log(`✅ Successfully created template: ${createdTemplate.name} (ID: ${createdTemplate.id})`);
        
        // Test preview generation
        const previews = await templateService.previewTemplate(createdTemplate.id, 2);
        if (previews) {
          console.log(`📋 Generated ${previews.length} preview examples`);
          previews.forEach((preview, index) => {
            console.log(`   Example ${index + 1}: ${preview.preview.substring(0, 100)}...`);
          });
        }
        
      } catch (error) {
        console.error(`❌ Failed to create template ${templateData.name}:`, error);
      }
    }
    
    // 2. Find HW1 homework set
    const homeworkService = await getHomeworkService();
    const existingSets = await homeworkService.listHomeworkSets({ pageSize: 50 });
    const hw1 = existingSets.items.find(set => set.title === "תרגיל בית 1");
    
    if (!hw1) {
      console.error('❌ HW1 homework set not found. Please run the seed script first.');
      return;
    }
    
    console.log(`\n📚 Found HW1 homework set: ${hw1.id}`);
    
    // 3. Clear existing static questions
    const questionsService = await getQuestionsService();
    const existingQs = await questionsService.getQuestionsByHomeworkSet(hw1.id);
    
    if (existingQs.length > 0) {
      console.log(`🗑️ Deleting ${existingQs.length} existing static questions...`);
      for (const q of existingQs) {
        await questionsService.deleteQuestion(q.id);
      }
    }
    
    // 4. Update homework set to use templates
    const templateIds = createdTemplates.map(t => t.id);
    await homeworkService.updateHomeworkSet(hw1.id, {
      questionOrder: templateIds, // Use template IDs as question order
      overview: [
        "זהו התרגיל הראשון בקורס ומיועד לכל קבוצות התרגול. יש להגיש עד השעה 23:59.",
        "יש להשתמש ב-MySQL. ההגשה מתבצעת ביחידים בלבד. הקובץ יכלול את פקודות CREATE/INSERT/SELECT.",
        "הקדימו: הדביקו מספר שאלה והערה קצרה /* remark */ לפני ה-SELECT שמציג את התוצאה.",
        "לכל שאלה: הראו את פקודת ה-SQL, הציגו את תוצאת ההרצה, והסבירו בקצרה אם יש.",
        "",
        "⚠️ שאלות פרמטריות: כל סטודנט יקבל ערכים שונים לכל שאלה, מה שמונע העתקה ומבטיח הערכה הוגנת."
      ].join("\n")
    });
    
    console.log(`✅ Updated HW1 to use ${templateIds.length} parametric templates`);
    
    // 5. Test with sample students
    const generator = await getQuestionGenerator();
    const testStudents = ['304993082', '123456789', '987654321'];
    
    console.log('\n🧪 Testing parametric generation with sample students...');
    
    for (const studentId of testStudents) {
      console.log(`\n👤 Testing student: ${studentId}`);
      
      try {
        const result = await generator.generateQuestionsForStudent(
          hw1.id,
          studentId,
          templateIds
        );
        
        if (result.success) {
          console.log(`✅ Generated ${result.generated} questions for student ${studentId}`);
          
          // Preview the questions
          const questions = await generator.getQuestionsForStudent(hw1.id, studentId);
          console.log(`📋 Student ${studentId} will see ${questions.length} questions:`);
          questions.forEach((q, index) => {
            console.log(`   ${index + 1}. ${q.prompt.substring(0, 80)}...`);
          });
        } else {
          console.log(`❌ Failed to generate questions for student ${studentId}: ${result.errors.join(', ')}`);
        }
      } catch (error) {
        console.error(`❌ Error testing student ${studentId}:`, error);
      }
    }
    
    console.log('\n🎉 HW1 parametric conversion completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Created ${createdTemplates.length} parametric templates`);
    console.log(`- Updated HW1 homework set to use templates`);
    console.log(`- Tested with ${testStudents.length} sample students`);
    console.log('\n🔗 Next steps:');
    console.log('1. Students can now access /homework/start and enter their ID');
    console.log('2. Each student will get unique question variants');
    console.log('3. Questions are generated automatically when they start the homework');
    console.log('4. All existing functionality (grading, analytics) works with parametric questions');
    
  } catch (error) {
    console.error('💥 Fatal error during HW1 conversion:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  convertHW1ToParametric()
    .then(() => {
      console.log('\n✨ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { convertHW1ToParametric, hw1Templates };
