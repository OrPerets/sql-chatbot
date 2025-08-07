// Test script to verify server configuration
const config = require('./app/config.ts');

console.log('🔧 Testing server configuration...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Config:', config);

// Test the actual config import
import('./app/config.ts').then(configModule => {
  console.log('✅ Config module loaded successfully');
  console.log('Server URL:', configModule.default.serverUrl);
  
  // Test if it's the production URL
  if (configModule.default.serverUrl === 'https://mentor-server-theta.vercel.app') {
    console.log('✅ Using PRODUCTION server URL');
  } else if (configModule.default.serverUrl === 'http://127.0.0.1:5555') {
    console.log('⚠️ Using LOCAL server URL');
  } else {
    console.log('❓ Unknown server URL:', configModule.default.serverUrl);
  }
}).catch(err => {
  console.error('❌ Error loading config:', err);
});
