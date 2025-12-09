#!/usr/bin/env tsx

import { getTemplateService } from '../lib/template-service';
import { generateId } from '../lib/models';
import type { VariableType } from '../app/homework/types';

/**
 * Script to create the 5 parametric templates for HW1 conversion
 * Based on the specifications in AGENTS.md
 */

interface TemplateData {
  name: string;
  description: string;
  template: string;
  variables: Array<{
    id: string;
    name: string;
    type: VariableType;
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

const templates: TemplateData[] = [
  {
    name: "Age and Salary Range Query",
    description: "Filter employees by age range and salary range",
    template: "הציגו את השם הפרטי, שם המשפחה ושנת הלידה, עבור העובדים שנולדו בין השנים {{start_year}} ל-{{end_year}} (כולל קצוות) והמשכורת שלהם נעה בין {{min_salary}} ל {{max_salary}} ₪ (לא כולל קצוות).",
    variables: [
      {
        id: generateId(),
        name: "start_year",
        type: "number",
        description: "Start year for birth year range",
        constraints: { min: 1990, max: 2000 },
        required: true
      },
      {
        id: generateId(),
        name: "end_year",
        type: "number",
        description: "End year for birth year range",
        constraints: { min: 2020, max: 2030 },
        required: true
      },
      {
        id: generateId(),
        name: "min_salary",
        type: "number",
        description: "Minimum salary threshold",
        constraints: { min: 5000, max: 8000 },
        required: true
      },
      {
        id: generateId(),
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
    maxAttempts: 3,
    points: 10,
    evaluationMode: "auto"
  },
  {
    name: "Age and Currency Conversion Query",
    description: "Filter by age and convert salary from EUR to ₪",
    template: "הציגו את שם המשפחה והשם הפרטי של העובדים אשר גילם פחות מ-{{max_age}} ומשכורתם גדולה מ-{{eur_amount}} אירו, לפי השער היציג כיום של {{exchange_rate}} ₪ ל-1 אירו.",
    variables: [
      {
        id: generateId(),
        name: "max_age",
        type: "number",
        description: "Maximum age threshold",
        constraints: { min: 25, max: 40 },
        required: true
      },
      {
        id: generateId(),
        name: "eur_amount",
        type: "number",
        description: "Minimum salary in EUR",
        constraints: { min: 1500, max: 3000 },
        required: true
      },
      {
        id: generateId(),
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
    maxAttempts: 3,
    points: 10,
    evaluationMode: "auto"
  },
  {
    name: "Job Role Salary Increase Query",
    description: "Calculate salary increase for specific job role",
    template: "לאור המצב בארץ, הוחלט שכל מי שעובד בתפקיד {{job_role}} בישראל, יקבל העלאה, לאור כך נרצה לבדוק מה תהיה המשכורת לאחר תוספת של {{increase_percent}}%. עליכם להציג בתוצאה שם משפחה, שם פרטי, השכר לפני התוספת והשכר החדש לאחר התוספת.",
    variables: [
      {
        id: generateId(),
        name: "job_role",
        type: "list",
        description: "Job role for salary increase",
        constraints: { 
          options: ["clerk", "manager", "engineer", "analyst", "developer"] 
        },
        required: true
      },
      {
        id: generateId(),
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
    maxAttempts: 3,
    points: 10,
    evaluationMode: "auto"
  },
  {
    name: "City and Country Pattern Query",
    description: "Filter by city name length and country name patterns",
    template: "הציגו את מס' ת.ז של העובדים שעובדים בעיר ששמה מכיל בדיוק {{city_length}} תווים ושהמדינה בה הם עובדים מכילה אות \"{{include_letter}}\" אך לא מכילה את אות \"{{exclude_letter}}\". יש למיין את רשימת העובדים לפי תעודת הזהות של העובד בסדר יורד.",
    variables: [
      {
        id: generateId(),
        name: "city_length",
        type: "number",
        description: "Exact length of city name",
        constraints: { min: 4, max: 8 },
        required: true
      },
      {
        id: generateId(),
        name: "include_letter",
        type: "string",
        description: "Letter that must be in country name",
        constraints: { minLength: 1, maxLength: 1 },
        required: true
      },
      {
        id: generateId(),
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
    maxAttempts: 3,
    points: 10,
    evaluationMode: "auto"
  },
  {
    name: "Salary and Name Pattern Query",
    description: "Filter by salary threshold and name patterns",
    template: "הציגו את ת.ז. של העובד, קוד העבודה, שם המחלקה והמשכורת רק עבור העובדים שמשכורתם היא לפחות {{min_salary}} ₪ וששם המשפחה שלהם מכיל את האות \"{{name_letter}}\" וששם המחלקה בה הם עובדים, לא מכיל את האות \"{{exclude_letter}}\". עליכם לדאוג למיין את התוצאה לפי משכורת בסדר יורד.",
    variables: [
      {
        id: generateId(),
        name: "min_salary",
        type: "number",
        description: "Minimum salary threshold",
        constraints: { min: 8000, max: 15000 },
        required: true
      },
      {
        id: generateId(),
        name: "name_letter",
        type: "string",
        description: "Letter that must be in last name",
        constraints: { minLength: 1, maxLength: 1 },
        required: true
      },
      {
        id: generateId(),
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
    maxAttempts: 3,
    points: 10,
    evaluationMode: "auto"
  }
];

async function createTemplates() {
  try {
    console.log('🚀 Starting HW1 parametric template creation...');
    
    const service = await getTemplateService();
    
    for (let i = 0; i < templates.length; i++) {
      const templateData = templates[i];
      console.log(`\n📝 Creating template ${i + 1}/5: ${templateData.name}`);
      
      try {
        const createdTemplate = await service.createTemplate(templateData);
        console.log(`✅ Successfully created template: ${createdTemplate.name} (ID: ${createdTemplate.id})`);
        
        // Test preview generation
        const previews = await service.previewTemplate(createdTemplate.id, 2);
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
    
    console.log('\n🎉 Template creation process completed!');
    console.log('\n📊 Summary:');
    console.log('- Template 1: Age and Salary Range Filtering');
    console.log('- Template 2: Age and Currency Conversion');
    console.log('- Template 3: Job Role and Salary Increase');
    console.log('- Template 4: City and Country Pattern Filtering');
    console.log('- Template 5: Salary and Name Pattern Filtering');
    
    console.log('\n🔗 Next steps:');
    console.log('1. Visit /admin/templates to view the created templates');
    console.log('2. Test template previews and variable generation');
    console.log('3. Use these templates in homework sets for parametric questions');
    console.log('4. Generate unique question variants for each student');
    
  } catch (error) {
    console.error('💥 Fatal error during template creation:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createTemplates()
    .then(() => {
      console.log('\n✨ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { createTemplates, templates };
