#!/usr/bin/env tsx

import { getTemplateService } from '../lib/template-service';

/**
 * Comprehensive test script for HW1 parametric templates
 * Tests template creation, preview generation, and variable substitution
 */

interface TestResult {
  templateName: string;
  templateId: string;
  success: boolean;
  error?: string;
  previewCount: number;
  variableCount: number;
  samplePreview?: string;
}

async function testTemplates() {
  console.log('🧪 Starting comprehensive HW1 template testing...\n');
  
  const service = await getTemplateService();
  const results: TestResult[] = [];
  
  try {
    // Get all templates
    const templates = await service.getTemplates();
    console.log(`📋 Found ${templates.length} templates in the system\n`);
    
    // Filter for our HW1 templates (they should have specific names)
    const hw1Templates = templates.filter(t => 
      t.name.includes('Age and Salary Range') ||
      t.name.includes('Age and Currency Conversion') ||
      t.name.includes('Job Role Salary Increase') ||
      t.name.includes('City and Country Pattern') ||
      t.name.includes('Salary and Name Pattern')
    );
    
    console.log(`🎯 Found ${hw1Templates.length} HW1 parametric templates\n`);
    
    // Test each template
    for (const template of hw1Templates) {
      console.log(`🔍 Testing template: ${template.name}`);
      
      const result: TestResult = {
        templateName: template.name,
        templateId: template.id,
        success: false,
        previewCount: 0,
        variableCount: template.variables.length
      };
      
      try {
        // Test preview generation
        const previews = await service.previewTemplate(template.id, 3);
        
        if (previews && previews.length > 0) {
          result.previewCount = previews.length;
          result.samplePreview = previews[0].preview;
          result.success = true;
          
          console.log(`  ✅ Preview generation: ${previews.length} samples`);
          console.log(`  📝 Variables: ${template.variables.length}`);
          console.log(`  🔤 Sample preview: ${previews[0].preview.substring(0, 80)}...`);
          
          // Validate that variables are properly substituted
          const hasPlaceholders = previews[0].preview.includes('{{');
          if (hasPlaceholders) {
            result.success = false;
            result.error = 'Template still contains variable placeholders';
            console.log(`  ❌ Variable substitution failed - placeholders remain`);
          } else {
            console.log(`  ✅ Variable substitution working correctly`);
          }
          
          // Test variable value generation
          const variableValues = previews[0].variables;
          console.log(`  🔢 Generated values: ${variableValues.map(v => `${v.variableId}: ${v.value}`).join(', ')}`);
          
        } else {
          result.error = 'No previews generated';
          console.log(`  ❌ Preview generation failed`);
        }
        
      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';
        console.log(`  ❌ Error: ${result.error}`);
      }
      
      results.push(result);
      console.log('');
    }
    
    // Summary
    console.log('📊 Test Results Summary:');
    console.log('=' .repeat(50));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}\n`);
    
    if (successful.length > 0) {
      console.log('✅ Working Templates:');
      successful.forEach(result => {
        console.log(`  • ${result.templateName} (${result.variableCount} variables, ${result.previewCount} previews)`);
      });
      console.log('');
    }
    
    if (failed.length > 0) {
      console.log('❌ Failed Templates:');
      failed.forEach(result => {
        console.log(`  • ${result.templateName}: ${result.error}`);
      });
      console.log('');
    }
    
    // Test template instantiation for a specific student
    console.log('👨‍🎓 Testing student-specific question instantiation...');
    
    if (successful.length > 0) {
      const testTemplate = successful[0];
      const testStudentId = 'test-student-123';
      const testHomeworkSetId = 'test-homework-456';
      
      try {
        const instantiatedQuestion = await service.instantiateQuestion(
          testTemplate.templateId,
          testStudentId,
          testHomeworkSetId,
          'test-seed'
        );
        
        if (instantiatedQuestion) {
          console.log(`  ✅ Question instantiation successful`);
          console.log(`  📝 Generated prompt: ${instantiatedQuestion.prompt.substring(0, 80)}...`);
          console.log(`  🔢 Variables used: ${instantiatedQuestion.variables.length}`);
        } else {
          console.log(`  ❌ Question instantiation failed`);
        }
      } catch (error) {
        console.log(`  ❌ Instantiation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log('\n🎉 Template testing completed!');
    
    // Recommendations
    if (successful.length === results.length) {
      console.log('\n✨ All templates are working correctly!');
      console.log('📋 Next steps:');
      console.log('  1. Use these templates in homework sets');
      console.log('  2. Generate unique questions for each student');
      console.log('  3. Test with real student data');
      console.log('  4. Monitor question generation performance');
    } else {
      console.log('\n⚠️  Some templates need attention before deployment');
    }
    
  } catch (error) {
    console.error('💥 Fatal error during testing:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testTemplates()
    .then(() => {
      console.log('\n🏁 Test script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test script failed:', error);
      process.exit(1);
    });
}

export { testTemplates };
