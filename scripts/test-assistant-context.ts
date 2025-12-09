import { getCurrentWeekContextNormalized, getWeekContextByNumberNormalized } from '../lib/content';

async function testAssistantContext() {
  console.log('🧪 Testing Assistant Context Integration\n');
  console.log('='.repeat(80));
  
  try {
    // Test 1: Get current week context (what the assistant will receive)
    console.log('\n📋 Test 1: Current Week Context (Auto-detected)');
    console.log('-'.repeat(80));
    
    const currentWeek = await getCurrentWeekContextNormalized(null);
    
    console.log('✅ Current Week Data:');
    console.log(`   Week Number: ${currentWeek.weekNumber}`);
    console.log(`   Date Range: ${currentWeek.dateRange}`);
    console.log(`   Has Content: ${currentWeek.content ? 'Yes' : 'No'}`);
    
    if (currentWeek.content) {
      console.log(`\n   📖 Content Preview:`);
      const lines = currentWeek.content.split('\n');
      lines.forEach((line, idx) => {
        if (line.trim() && idx < 5) {
          console.log(`      ${line}`);
        }
      });
      if (lines.length > 5) {
        console.log(`      ... (${lines.length - 5} more lines)`);
      }
    }
    
    console.log(`\n   ⏰ Last Updated: ${currentWeek.updatedAt || 'N/A'}`);
    console.log(`   👤 Updated By: ${currentWeek.updatedBy || 'N/A'}`);
    
    // Test 2: Get specific week context
    console.log('\n\n📋 Test 2: Specific Week Context (Week 1)');
    console.log('-'.repeat(80));
    
    const week1 = await getWeekContextByNumberNormalized(1);
    
    console.log('✅ Week 1 Data:');
    console.log(`   Week Number: ${week1.weekNumber}`);
    console.log(`   Date Range: ${week1.dateRange}`);
    console.log(`   Content Length: ${week1.content?.length || 0} characters`);
    
    // Test 3: Simulate assistant function call
    console.log('\n\n📋 Test 3: Simulating Assistant Function Call');
    console.log('-'.repeat(80));
    
    // This is what the assistant receives when it calls get_course_week_context()
    const assistantResponse = {
      weekNumber: currentWeek.weekNumber,
      content: currentWeek.content,
      dateRange: currentWeek.dateRange,
      updatedAt: currentWeek.updatedAt || null,
      updatedBy: currentWeek.updatedBy || null,
      fetchedAt: new Date().toISOString(),
    };
    
    console.log('✅ Assistant will receive:');
    console.log(JSON.stringify(assistantResponse, null, 2));
    
    // Test 4: Verify integration points
    console.log('\n\n📋 Test 4: Integration Points Verification');
    console.log('-'.repeat(80));
    
    const checks = [
      {
        name: 'Database has semester config',
        status: currentWeek.weekNumber !== null,
        detail: currentWeek.weekNumber !== null 
          ? `✓ Current week: ${currentWeek.weekNumber}` 
          : '✗ No semester start date configured'
      },
      {
        name: 'Current week has content',
        status: !!(currentWeek.content && currentWeek.content.trim()),
        detail: currentWeek.content 
          ? `✓ Content available (${currentWeek.content.length} chars)` 
          : '✗ No content for current week'
      },
      {
        name: 'Date range is set',
        status: !!(currentWeek.dateRange),
        detail: currentWeek.dateRange 
          ? `✓ ${currentWeek.dateRange}` 
          : '✗ No date range'
      },
      {
        name: 'Content is in Hebrew',
        status: /[\u0590-\u05FF]/.test(currentWeek.content || ''),
        detail: /[\u0590-\u05FF]/.test(currentWeek.content || '') 
          ? '✓ Hebrew content detected' 
          : '✗ No Hebrew content'
      }
    ];
    
    checks.forEach((check, idx) => {
      const icon = check.status ? '✅' : '❌';
      console.log(`\n${icon} ${idx + 1}. ${check.name}`);
      console.log(`   ${check.detail}`);
    });
    
    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    
    const allPassed = checks.every(c => c.status);
    
    if (allPassed) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('\n✅ The assistant context integration is working correctly.');
      console.log('\n📝 What this means:');
      console.log('   • When students ask "What are we learning this week?"');
      console.log('   • The assistant will call get_course_week_context()');
      console.log(`   • It will receive: Week ${currentWeek.weekNumber} content`);
      console.log('   • The assistant will provide context-aware responses');
      console.log('\n🚀 Try asking Michael:');
      console.log('   - "מה לומדים השבוע?" (What are we learning this week?)');
      console.log('   - "תספר לי על הנושא השבועי" (Tell me about this week\'s topic)');
      console.log('   - "What topics are we covering this week?"');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED');
      const failedChecks = checks.filter(c => !c.status);
      console.log(`\n${failedChecks.length} issue(s) need attention:`);
      failedChecks.forEach((check, idx) => {
        console.log(`   ${idx + 1}. ${check.name}: ${check.detail}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:');
    console.error(error);
    process.exit(1);
  }
}

// Run the tests
testAssistantContext();

