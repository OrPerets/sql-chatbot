/**
 * Voice Text Sanitizer Demo
 * Demonstrates how the text sanitizer removes unwanted technical content
 */

import { voiceTextSanitizer, sanitizeTextForVoice } from './voice-text-sanitizer';

// Example texts that contain technical formatting that should be removed
const exampleTexts = [
  // Text with SSML tags
  "Hello there! <break time=\"800ms\"/> This is a test message with <emphasis level=\"moderate\">emphasis</emphasis> and <break time=\"400ms\"/> pauses.",
  
  // Text with technical formatting
  "The query executed in 250ms with a response time of 1.2 seconds. Break time: 500ms. Space character detected.",
  
  // Text with debug information
  "DEBUG: Processing request ID: abc123. Status: SUCCESS. Memory usage: 45MB. Response time: 150ms.",
  
  // Text with HTML and markdown
  "**Important:** This is <strong>bold text</strong> with `inline code` and [links](https://example.com).",
  
  // Text with code blocks and technical content
  "Here's the SQL query: ```SELECT * FROM users WHERE age > 25```. The result was processed in 100ms.",
  
  // Text with URLs and emails
  "Visit https://example.com for more info or contact us at support@example.com.",
  
  // Mixed technical content
  "Query: SELECT * FROM users <break time=\"500ms\"/> Response time: 200ms. Status: SUCCESS. Break time completed."
];

export function demonstrateTextSanitization(): void {
  console.log('🎤 Voice Text Sanitization Demo');
  console.log('=====================================\n');

  exampleTexts.forEach((text, index) => {
    console.log(`Example ${index + 1}:`);
    console.log('Original:', text);
    
    const result = voiceTextSanitizer.sanitizeText(text);
    
    console.log('Sanitized:', result.sanitizedText);
    console.log('Removed elements:', result.removedElements.length);
    
    if (result.removedElements.length > 0) {
      console.log('Removed:', result.removedElements.map(el => `${el.type}: "${el.content}"`).join(', '));
    }
    
    console.log('Reduction:', result.statistics.reductionPercentage.toFixed(1) + '%');
    console.log('---\n');
  });

  // Show statistics
  const stats = voiceTextSanitizer.getStatistics();
  console.log('Overall Statistics:');
  console.log('Total elements removed:', stats.totalElementsRemoved);
  console.log('Elements by type:', stats.elementsByType);
  console.log('Most common removed elements:', stats.commonRemovedElements.slice(0, 5));
}

// Quick demo function
export function quickDemo(): void {
  const problematicText = "Hello! <break time=\"800ms\"/> The query took 250ms to execute. Break time completed. Visit https://example.com for more info.";
  
  console.log('Quick Demo:');
  console.log('Original:', problematicText);
  console.log('Sanitized:', sanitizeTextForVoice(problematicText));
}

// Export for use in other files
export { voiceTextSanitizer, sanitizeTextForVoice };
