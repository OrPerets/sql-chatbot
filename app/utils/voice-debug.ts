/**
 * Voice Debug Utility
 * Debug voice issues and text processing
 */

import { voiceTextSanitizer } from './voice-text-sanitizer';

export function debugVoiceTextProcessing(text: string): void {
  console.log('🎤 Voice Debug - Text Processing');
  console.log('================================');
  console.log('Original text:', text);
  console.log('Original length:', text.length);
  
  // Test sanitization
  const sanitizationResult = voiceTextSanitizer.sanitizeText(text);
  console.log('Sanitized text:', sanitizationResult.sanitizedText);
  console.log('Sanitized length:', sanitizationResult.sanitizedText.length);
  console.log('Reduction percentage:', sanitizationResult.statistics.reductionPercentage.toFixed(2) + '%');
  
  if (sanitizationResult.removedElements.length > 0) {
    console.log('Removed elements:');
    sanitizationResult.removedElements.forEach((element, index) => {
      console.log(`  ${index + 1}. ${element.type}: "${element.content}"`);
    });
  }
  
  // Check if text would be too short
  const isTooShort = sanitizationResult.sanitizedText.trim().length < 10;
  console.log('Would be too short (< 10 chars):', isTooShort);
  
  if (isTooShort) {
    console.log('⚠️ WARNING: Sanitized text is too short, would use fallback');
  }
  
  console.log('---');
}

export function testCommonTexts(): void {
  const testTexts = [
    "Hello, this is a test message.",
    "The query executed successfully.",
    "Here's your SQL result: SELECT * FROM users WHERE age > 25",
    "Debug: Processing completed in 250ms",
    "Visit https://example.com for more information",
    "**Important:** This is a test with <break time=\"800ms\"/> formatting",
    "Response time: 1.2 seconds. Break time completed.",
    "Status: SUCCESS. Memory usage: 45MB.",
    "```SELECT * FROM users``` - This query returned 5 results"
  ];
  
  console.log('🧪 Testing Common Text Patterns');
  console.log('===============================');
  
  testTexts.forEach((text, index) => {
    console.log(`\nTest ${index + 1}:`);
    debugVoiceTextProcessing(text);
  });
}

// Quick test function
export function quickVoiceTest(): void {
  const testText = "Hello! This is a simple test message.";
  console.log('Quick Voice Test:');
  console.log('Input:', testText);
  
  const result = voiceTextSanitizer.sanitizeText(testText);
  console.log('Output:', result.sanitizedText);
  console.log('Should work:', result.sanitizedText.trim().length > 10);
}
