console.log('🔍 Debug: Analyzing grade structure from logs...\n');

// From the logs, we see:
// "📊 Mapped grade for question 10: score=6, feedback=..."
// "💾 Marking questions as saved: (4) [12, 2, 11, 10]"

// The issue: My condition was looking for existing.maxScore === 1
// But the existing grade might not have maxScore property!

console.log('🚨 CRITICAL FINDING:');
console.log('The existing grade object structure is different!');
console.log('');
console.log('Expected structure: { score: 6, maxScore: 1, feedback: "..." }');
console.log('Actual structure:   { score: 6, feedback: "..." } // maxScore missing!');
console.log('');
console.log('My condition was: existing.maxScore === 1 && existing.score > 1');
console.log('But if maxScore is undefined, condition = undefined === 1 && 6 > 1 = false');
console.log('');
console.log('🎯 FIX: Check existing.score > 1 directly (since all problematic questions have score > 1)');
console.log('Or check against the database grades which definitely have maxScore=1');
console.log('');
console.log('💡 The 1/1 you see comes from answer.isCorrect=true + questionPoints=1');
console.log('We need to detect problematic fallback questions differently!');