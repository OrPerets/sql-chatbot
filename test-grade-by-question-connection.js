// Test script to verify grade-by-question API connection
import config from './app/config.ts';

console.log('🔧 Testing grade-by-question API connection...');
console.log('Config server URL:', config.serverUrl);

// Test the API endpoints directly
async function testAPIEndpoints() {
  try {
    console.log('\n📊 Testing מועד ב (questions-optimized)...');
    
    // Test the frontend API route (which should proxy to backend)
    const frontendResponse = await fetch('http://localhost:3000/api/admin/questions-optimized?page=1&limit=2&includeGradingStatus=true');
    console.log('Frontend API Status:', frontendResponse.status);
    
    if (frontendResponse.ok) {
      const frontendData = await frontendResponse.json();
      console.log('Frontend API Response:', {
        questionsCount: frontendData.questions?.length || 0,
        hasQuestions: !!frontendData.questions?.length,
        serverUrl: config.serverUrl
      });
    } else {
      console.log('Frontend API Error:', await frontendResponse.text());
    }
    
    console.log('\n📊 Testing מועד א (questions-with-answers)...');
    const frontendResponse2 = await fetch('http://localhost:3000/api/admin/questions-with-answers?page=1&limit=2&includeGradingStatus=true');
    console.log('Frontend API Status (moed-a):', frontendResponse2.status);
    
    if (frontendResponse2.ok) {
      const frontendData2 = await frontendResponse2.json();
      console.log('Frontend API Response (moed-a):', {
        questionsCount: frontendData2.questions?.length || 0,
        hasQuestions: !!frontendData2.questions?.length,
        serverUrl: config.serverUrl
      });
    } else {
      console.log('Frontend API Error (moed-a):', await frontendResponse2.text());
    }
    
    console.log('\n🎯 Summary:');
    console.log('- If you see questions data, the connection is working');
    console.log('- If you see errors, there might be a connection issue');
    console.log('- The server URL should be:', config.serverUrl);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Only run if we're in a browser-like environment
if (typeof fetch !== 'undefined') {
  testAPIEndpoints();
} else {
  console.log('⚠️ This test needs to run in a browser environment with fetch support');
  console.log('Please run this in the browser console or check the network tab');
}
