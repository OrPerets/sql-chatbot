// OPTIMIZED VERSION - Replace your existing mentor-server cheat detection endpoint with this
// Path: mentor-server/api/admin/cheat-detection.js

const { MongoClient } = require('mongodb');
const config = require('../config'); // Adjust path based on your config location

// Simple in-memory cache (for production, consider Redis)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fast similarity calculation for initial screening
function calculateFastSimilarity(text1, text2) {
  // Quick character-based similarity for initial filtering
  const normalize = (text) => text.toLowerCase().replace(/[^\w]/g, '');
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);
  
  if (norm1.length === 0 && norm2.length === 0) return 1;
  if (norm1.length === 0 || norm2.length === 0) return 0;
  
  const shorter = norm1.length < norm2.length ? norm1 : norm2;
  const longer = norm1.length >= norm2.length ? norm1 : norm2;
  
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  
  return matches / longer.length;
}

// Optimized Jaccard similarity (only for promising pairs)
function calculateJaccardSimilarity(text1, text2) {
  const normalize = (text) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(word => word.length > 2);
  };

  const tokens1 = new Set(normalize(text1));
  const tokens2 = new Set(normalize(text2));

  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

// Simplified sequence similarity for SQL
function calculateSequenceSimilarity(text1, text2) {
  const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'ORDER BY'];
  
  const extractKeywords = (text) => {
    const upperText = text.toUpperCase();
    return sqlKeywords.filter(keyword => upperText.includes(keyword));
  };

  const seq1 = extractKeywords(text1);
  const seq2 = extractKeywords(text2);

  if (seq1.length === 0 && seq2.length === 0) return 1;
  if (seq1.length === 0 || seq2.length === 0) return 0;

  const commonKeywords = seq1.filter(keyword => seq2.includes(keyword));
  return commonKeywords.length / Math.max(seq1.length, seq2.length);
}

// Advanced similarity with early exit
function calculateAdvancedSimilarity(text1, text2, quickMode = false) {
  // Quick screening first
  const fastScore = calculateFastSimilarity(text1, text2);
  if (quickMode && fastScore < 0.5) return fastScore; // Early exit for quick mode
  
  const jaccardScore = calculateJaccardSimilarity(text1, text2);
  const sequenceSimilarity = calculateSequenceSimilarity(text1, text2);
  
  // Weighted average
  return (jaccardScore * 0.6 + sequenceSimilarity * 0.4);
}

function getSuspicionLevel(score) {
  if (score >= 0.85) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

// Generate cache key
function generateCacheKey(params) {
  return `cheat-detection-${params.similarityThreshold}-${params.aiThreshold}-${params.batchSize || 100}`;
}

// Main endpoint handler - OPTIMIZED
async function handleCheatDetection(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      similarityThreshold = 0.8, 
      aiThreshold = 30,
      batchSize = 50,
      quickMode = false,
      maxComparisons = 1000
    } = req.body;

    console.log('🚀 Starting OPTIMIZED cheat detection analysis...');
    console.log(`📊 Settings: threshold=${similarityThreshold}, quickMode=${quickMode}, maxComparisons=${maxComparisons}`);

    // Check cache first
    const cacheKey = generateCacheKey(req.body);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('💾 Returning cached results');
      return res.json(cached.data);
    }

    const client = new MongoClient(config.mongoURL);
    await client.connect();
    const db = client.db();

    // Get completed exams with limit
    const finalExamsCollection = db.collection('FinalExams');
    const examSessions = await finalExamsCollection
      .find({ status: 'completed' })
      .limit(Math.min(batchSize, 100)) // Limit number of exams processed
      .toArray();

    console.log(`📚 Processing ${examSessions.length} exam sessions`);

    // Collect answers with smart batching
    const allAnswers = [];
    const examAnswers = [];
    let processedCount = 0;
    const maxAnswersToProcess = Math.min(maxComparisons, 2000);

    for (const session of examSessions) {
      if (processedCount >= maxAnswersToProcess) break;

      try {
        // Try FinalExamAnswers first
        const finalExamAnswersCollection = db.collection('FinalExamAnswers');
        let examData = await finalExamAnswersCollection.findOne({ 
          $or: [
            { _id: session._id },
            { examId: session._id },
            { studentEmail: session.studentEmail, startTime: session.startTime }
          ]
        });

        if (!examData) {
          const examAnswersCollection = db.collection('ExamAnswers');
          examData = await examAnswersCollection.findOne({ 
            $or: [
              { _id: session._id },
              { examId: session._id },
              { studentEmail: session.studentEmail }
            ]
          });
        }

        if (examData && examData.answers && Array.isArray(examData.answers)) {
          for (let i = 0; i < examData.answers.length && processedCount < maxAnswersToProcess; i++) {
            const answer = examData.answers[i];
            if (answer.studentAnswer && answer.studentAnswer.trim().length > 10) { // Skip very short answers
              const examAnswer = {
                _id: session._id,
                studentEmail: session.studentEmail,
                studentName: session.studentName,
                studentId: session.studentId,
                questionIndex: i,
                questionText: answer.questionText || `שאלה ${i + 1}`,
                studentAnswer: answer.studentAnswer,
                examId: session._id
              };
              
              allAnswers.push(examAnswer);
              examAnswers.push(examAnswer);
              processedCount++;
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing exam ${session._id}:`, error);
      }
    }

    console.log(`📝 Analyzing ${allAnswers.length} answers with smart comparison limits`);

    // Optimized similarity analysis
    const similarityMatches = [];
    const answersByQuestion = {};
    let comparisonCount = 0;

    // Group answers by question
    allAnswers.forEach(answer => {
      if (!answersByQuestion[answer.questionIndex]) {
        answersByQuestion[answer.questionIndex] = [];
      }
      answersByQuestion[answer.questionIndex].push(answer);
    });

    // Smart comparison with limits
    Object.keys(answersByQuestion).forEach(questionIndexStr => {
      if (comparisonCount >= maxComparisons) return;
      
      const questionIndex = parseInt(questionIndexStr);
      const answers = answersByQuestion[questionIndex];
      
      // Limit answers per question to prevent explosion
      const limitedAnswers = answers.slice(0, Math.min(answers.length, 20));
      
      for (let i = 0; i < limitedAnswers.length - 1 && comparisonCount < maxComparisons; i++) {
        for (let j = i + 1; j < limitedAnswers.length && comparisonCount < maxComparisons; j++) {
          const answer1 = limitedAnswers[i];
          const answer2 = limitedAnswers[j];

          // Skip if same student
          if (answer1.studentEmail === answer2.studentEmail) continue;

          comparisonCount++;

          const similarity = calculateAdvancedSimilarity(
            answer1.studentAnswer,
            answer2.studentAnswer,
            quickMode
          );

          if (similarity >= similarityThreshold) {
            similarityMatches.push({
              student1: {
                id: answer1.studentId || answer1.studentEmail,
                name: answer1.studentName || 'לא צוין',
                email: answer1.studentEmail
              },
              student2: {
                id: answer2.studentId || answer2.studentEmail,
                name: answer2.studentName || 'לא צוין',
                email: answer2.studentEmail
              },
              questionIndex,
              questionText: answer1.questionText,
              similarityScore: Math.round(similarity * 100) / 100, // Round to 2 decimals
              student1Answer: answer1.studentAnswer,
              student2Answer: answer2.studentAnswer,
              suspicionLevel: getSuspicionLevel(similarity)
            });
          }
        }
      }
    });

    console.log(`🔍 Performed ${comparisonCount} comparisons, found ${similarityMatches.length} suspicious matches`);

    // Sort and limit results
    similarityMatches.sort((a, b) => b.similarityScore - a.similarityScore);
    const limitedMatches = similarityMatches.slice(0, 200); // Limit results

    // Calculate statistics
    const stats = {
      totalExams: examSessions.length,
      totalAnswersProcessed: allAnswers.length,
      totalComparisons: comparisonCount,
      suspiciousSimilarities: limitedMatches.length,
      suspiciousAI: 0,
      averageSimilarityScore: limitedMatches.length > 0 
        ? Math.round((limitedMatches.reduce((sum, match) => sum + match.similarityScore, 0) / limitedMatches.length) * 100) / 100
        : 0,
      highRiskPairs: limitedMatches.filter(match => match.suspicionLevel === 'high').length,
      isPartialResults: comparisonCount >= maxComparisons || allAnswers.length >= maxAnswersToProcess
    };

    await client.close();

    const result = {
      similarityMatches: limitedMatches,
      aiDetectionResults: [], // Will be populated on frontend
      examAnswers: examAnswers.slice(0, 500), // Limit data sent to frontend
      stats
    };

    // Cache the results
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    console.log('✅ Optimized cheat detection analysis completed');
    console.log(`📈 Stats: ${stats.totalAnswersProcessed} answers, ${stats.totalComparisons} comparisons, ${stats.suspiciousSimilarities} matches`);

    res.json(result);

  } catch (error) {
    console.error('❌ Error in optimized cheat detection analysis:', error);
    res.status(500).json({ error: 'שגיאה בניתוח חשדות העתקה' });
  }
}

module.exports = handleCheatDetection;

/* 
OPTIMIZATION FEATURES:
✅ Batch processing with configurable limits
✅ Fast similarity screening before expensive calculations
✅ Early exit conditions
✅ Smart answer filtering (skip very short answers)
✅ Comparison limits to prevent timeout
✅ Result caching (5 minutes)
✅ Memory-efficient data structures
✅ Progress logging
✅ Graceful error handling
✅ Limited result sets to prevent frontend overload

PERFORMANCE IMPROVEMENTS:
- Processes max 2000 answers instead of all
- Limits comparisons to 1000 by default
- Uses fast screening before detailed analysis
- Caches results for 5 minutes
- Limits results sent to frontend
- Skips very short answers
- Smart batching per question

USAGE:
- Regular mode: Good balance of speed and accuracy
- Quick mode: Faster but less thorough analysis
- Configurable limits prevent timeouts
*/