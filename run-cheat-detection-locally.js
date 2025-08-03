#!/usr/bin/env node
/**
 * LOCAL CHEAT DETECTION ANALYZER
 * 
 * Run this script locally to analyze all exams for cheating and store results in DB.
 * The web interface will then fetch pre-computed results instantly.
 * 
 * Usage:
 *   node run-cheat-detection-locally.js
 * 
 * This eliminates timeout issues by pre-computing everything offline.
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');

// Configuration
const CONFIG = {
  // Update with your MongoDB connection string
  mongoURL: process.env.MONGODB_URI || "mongodb+srv://sql-admin:SMff5PqhhoVbX6z7@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor",
  
  // Analysis settings
  similarityThreshold: 0.8,
  aiThreshold: 30,
  
  // Processing limits (can be higher since running locally)
  maxExamsToProcess: 200,
  maxAnswersPerExam: 10,
  maxComparisons: 5000,
  
  // Collection names (correct lowercase as used in database)
  resultsCollection: 'CheatDetectionResults',
  finalExamsCollection: 'finalExams',
  examAnswersCollection: 'finalExams' // Same collection contains both exam info and answers
};

// Text similarity algorithms (optimized versions)
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

function calculateLevenshteinSimilarity(str1, str2) {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len2][len1]) / maxLen;
}

function calculateSequenceSimilarity(text1, text2) {
  const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'HAVING', 'ORDER BY', 'INSERT', 'UPDATE', 'DELETE'];
  
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

function calculateAdvancedSimilarity(text1, text2) {
  const jaccardScore = calculateJaccardSimilarity(text1, text2);
  const levenshteinSimilarity = calculateLevenshteinSimilarity(text1, text2);
  const sequenceSimilarity = calculateSequenceSimilarity(text1, text2);
  
  return (jaccardScore * 0.4 + levenshteinSimilarity * 0.3 + sequenceSimilarity * 0.3);
}

function getSuspicionLevel(score) {
  if (score >= 0.85) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

// AI Detection (simplified version - you can import your full trapDetector logic here)
function detectAITraps(text) {
  // Simplified AI detection patterns
  const aiPatterns = [
    /Time_to_Avg_Pilot_with_Flight/i,
    /sophisticated/i,
    /comprehensive/i,
    /furthermore/i,
    /moreover/i,
    /utilize/i,
    /implementation/i,
    /leveraging/i
  ];

  let suspicionScore = 0;
  const triggeredTraps = [];

  aiPatterns.forEach((pattern, index) => {
    if (pattern.test(text)) {
      suspicionScore += 15;
      triggeredTraps.push({
        type: 'ai_pattern',
        description: `חשד לכלי AI - דפוס ${index + 1}`
      });
    }
  });

  return {
    suspicionScore: Math.min(suspicionScore, 100),
    triggeredTraps
  };
}

function getAISuspicionLevel(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// Main analysis function
async function runCheatDetectionAnalysis() {
  console.log('🚀 Starting LOCAL cheat detection analysis...');
  console.log('⚙️ Configuration:', CONFIG);

  const client = new MongoClient(CONFIG.mongoURL);
  await client.connect();
  const db = client.db("experiment");

  try {
    // First, let's see what exams exist and their statuses
    console.log('📚 Checking database content...');
    const totalExams = await db.collection(CONFIG.finalExamsCollection).countDocuments();
    console.log(`📊 Total exams in database: ${totalExams}`);
    
    // Check what status values exist
    const statusStats = await db.collection(CONFIG.finalExamsCollection)
      .aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
      .toArray();
    
    console.log('📈 Status breakdown:', statusStats);
    
    // Get sample exam to see structure
    const sampleExam = await db.collection(CONFIG.finalExamsCollection).findOne({});
    if (sampleExam) {
      console.log('📄 Sample exam structure:', {
        _id: sampleExam._id,
        studentEmail: sampleExam.studentEmail,
        status: sampleExam.status,
        hasAnswers: !!sampleExam.answers,
        answersCount: sampleExam.answers?.length || 0
      });
    }
    
    // Get all completed exams
    console.log('📚 Fetching completed exams...');
    let finalExams = await db.collection(CONFIG.finalExamsCollection)
      .find({ status: 'completed' })
      .limit(CONFIG.maxExamsToProcess)
      .toArray();

    // If no completed exams, try to get any exams with answers for analysis
    if (finalExams.length === 0) {
      console.log('⚠️ No completed exams found, trying to get any exams with answers...');
      finalExams = await db.collection(CONFIG.finalExamsCollection)
        .find({ 
          answers: { $exists: true, $not: { $size: 0 } } // Has non-empty answers array
        })
        .limit(CONFIG.maxExamsToProcess)
        .toArray();
      console.log(`📊 Found ${finalExams.length} exams with answers (any status)`);
    } else {
      console.log(`📊 Found ${finalExams.length} completed exams`);
    }

    // Collect all answers
    const allAnswers = [];
    const examAnswers = []; // For AI processing
    let processedExams = 0;

    for (const exam of finalExams) {
      try {
        // Get all answers for this exam from the examAnswers collection
        const examAnswersForThisExam = await db.collection('examAnswers').find({
          examId: exam._id.toString() // Convert ObjectId to string for matching
        }).toArray();

        if (processedExams < 3) {
          console.log(`🔍 DEBUG - Exam ${processedExams + 1}:`, {
            examId: exam._id,
            studentEmail: exam.studentEmail,
            answersFound: examAnswersForThisExam.length
          });
        }

        // Process each answer for this exam
        for (const answerDoc of examAnswersForThisExam) {
          if (answerDoc.studentAnswer && answerDoc.studentAnswer.trim().length > 10) {
            const examAnswer = {
              _id: exam._id,
              studentEmail: exam.studentEmail,
              studentName: exam.studentName || 'לא צוין',
              studentId: exam.studentId,
              questionIndex: answerDoc.questionIndex,
              questionText: answerDoc.questionText || `שאלה ${answerDoc.questionIndex + 1}`,
              studentAnswer: answerDoc.studentAnswer,
              examId: exam._id
            };
            
            allAnswers.push(examAnswer);
            examAnswers.push(examAnswer);
          }
        }

        processedExams++;
        if (processedExams % 10 === 0) {
          console.log(`📈 Processed ${processedExams}/${finalExams.length} exams, collected ${allAnswers.length} answers`);
        }

      } catch (error) {
        console.error(`❌ Error processing exam ${exam._id}:`, error.message);
      }
    }

    console.log(`📝 Total answers collected: ${allAnswers.length}`);

    // Similarity Analysis
    console.log('🔍 Starting similarity analysis...');
    const similarityMatches = [];
    const answersByQuestion = {};

    // Group answers by question
    allAnswers.forEach(answer => {
      if (!answersByQuestion[answer.questionIndex]) {
        answersByQuestion[answer.questionIndex] = [];
      }
      answersByQuestion[answer.questionIndex].push(answer);
    });

    let totalComparisons = 0;
    const maxComparisons = CONFIG.maxComparisons;

    Object.keys(answersByQuestion).forEach(questionIndexStr => {
      if (totalComparisons >= maxComparisons) return;
      
      const questionIndex = parseInt(questionIndexStr);
      const answers = answersByQuestion[questionIndex];
      
      console.log(`🔍 Analyzing question ${questionIndex}: ${answers.length} answers`);
      
      for (let i = 0; i < answers.length - 1 && totalComparisons < maxComparisons; i++) {
        for (let j = i + 1; j < answers.length && totalComparisons < maxComparisons; j++) {
          const answer1 = answers[i];
          const answer2 = answers[j];

          if (answer1.studentEmail === answer2.studentEmail) continue;

          totalComparisons++;
          if (totalComparisons % 100 === 0) {
            console.log(`📊 Comparisons completed: ${totalComparisons}`);
          }

          const similarity = calculateAdvancedSimilarity(
            answer1.studentAnswer,
            answer2.studentAnswer
          );

          if (similarity >= CONFIG.similarityThreshold) {
            similarityMatches.push({
              student1: {
                id: answer1.studentId || answer1.studentEmail,
                name: answer1.studentName,
                email: answer1.studentEmail
              },
              student2: {
                id: answer2.studentId || answer2.studentEmail,
                name: answer2.studentName,
                email: answer2.studentEmail
              },
              questionIndex,
              questionText: answer1.questionText,
              similarityScore: Math.round(similarity * 1000) / 1000,
              student1Answer: answer1.studentAnswer,
              student2Answer: answer2.studentAnswer,
              suspicionLevel: getSuspicionLevel(similarity)
            });
          }
        }
      }
    });

    console.log(`✅ Similarity analysis complete: ${totalComparisons} comparisons, ${similarityMatches.length} matches found`);

    // AI Detection Analysis
    console.log('🤖 Starting AI detection analysis...');
    const aiDetectionResults = [];
    const examAnswersByStudent = {};

    // Group answers by student
    examAnswers.forEach(answer => {
      const studentId = answer.studentId || answer.studentEmail;
      if (!examAnswersByStudent[studentId]) {
        examAnswersByStudent[studentId] = [];
      }
      examAnswersByStudent[studentId].push(answer);
    });

    let processedStudents = 0;
    Object.keys(examAnswersByStudent).forEach(studentId => {
      const answers = examAnswersByStudent[studentId];
      if (!answers || answers.length === 0) return;

      const analysisResults = answers.map((answer, index) => {
        const analysis = detectAITraps(answer.studentAnswer || '');
        return {
          questionIndex: index,
          questionText: answer.questionText || `שאלה ${index + 1}`,
          answer: answer.studentAnswer || '',
          suspicionScore: analysis.suspicionScore,
          triggeredTraps: analysis.triggeredTraps.map(trap => trap.description)
        };
      });

      const suspiciousAnswers = analysisResults.filter(r => r.suspicionScore >= CONFIG.aiThreshold);
      const maxSuspicionScore = Math.max(...analysisResults.map(r => r.suspicionScore));
      const averageSuspicionScore = analysisResults.reduce((sum, r) => sum + r.suspicionScore, 0) / analysisResults.length;

      if (suspiciousAnswers.length > 0 || maxSuspicionScore >= CONFIG.aiThreshold) {
        const firstAnswer = answers[0];
        aiDetectionResults.push({
          studentId: firstAnswer.studentId || firstAnswer.studentEmail,
          studentName: firstAnswer.studentName,
          studentEmail: firstAnswer.studentEmail,
          examId: firstAnswer.examId,
          totalQuestions: answers.length,
          suspiciousAnswers: suspiciousAnswers.length,
          maxSuspicionScore,
          averageSuspicionScore: Math.round(averageSuspicionScore),
          aiSuspicionLevel: getAISuspicionLevel(maxSuspicionScore),
          details: suspiciousAnswers
        });
      }

      processedStudents++;
      if (processedStudents % 20 === 0) {
        console.log(`🤖 AI analysis progress: ${processedStudents}/${Object.keys(examAnswersByStudent).length} students`);
      }
    });

    console.log(`✅ AI detection complete: ${aiDetectionResults.length} suspicious students found`);

    // Sort results
    similarityMatches.sort((a, b) => b.similarityScore - a.similarityScore);
    aiDetectionResults.sort((a, b) => b.maxSuspicionScore - a.maxSuspicionScore);

    // Prepare final results
    const analysisResults = {
      _id: 'cheat-detection-results',
      timestamp: new Date(),
      config: CONFIG,
      similarityMatches,
      aiDetectionResults,
      examAnswers: examAnswers.slice(0, 1000), // Limit for storage
      stats: {
        totalExams: finalExams.length,
        totalAnswersProcessed: allAnswers.length,
        totalComparisons: totalComparisons,
        suspiciousSimilarities: similarityMatches.length,
        suspiciousAI: aiDetectionResults.length,
        averageSimilarityScore: similarityMatches.length > 0 
          ? Math.round((similarityMatches.reduce((sum, match) => sum + match.similarityScore, 0) / similarityMatches.length) * 1000) / 1000
          : 0,
        highRiskPairs: similarityMatches.filter(match => match.suspicionLevel === 'high').length,
        isPartialResults: totalComparisons >= maxComparisons
      }
    };

    // Store results in database
    console.log('💾 Storing results in database...');
    await db.collection(CONFIG.resultsCollection).replaceOne(
      { _id: 'cheat-detection-results' },
      analysisResults,
      { upsert: true }
    );

    // Also save to local file as backup
    const backupFile = `cheat-detection-results-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(analysisResults, null, 2));

    console.log('✅ Analysis complete!');
    console.log('📊 Final Statistics:');
    console.log(`   📚 Exams processed: ${analysisResults.stats.totalExams}`);
    console.log(`   📝 Answers analyzed: ${analysisResults.stats.totalAnswersProcessed}`);
    console.log(`   🔍 Comparisons made: ${analysisResults.stats.totalComparisons}`);
    console.log(`   👥 Suspicious similarity pairs: ${analysisResults.stats.suspiciousSimilarities}`);
    console.log(`   🤖 Suspicious AI cases: ${analysisResults.stats.suspiciousAI}`);
    console.log(`   📁 Results stored in: ${CONFIG.resultsCollection} collection`);
    console.log(`   💾 Backup saved to: ${backupFile}`);

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run the analysis
if (require.main === module) {
  runCheatDetectionAnalysis()
    .then(() => {
      console.log('🎉 Cheat detection analysis completed successfully!');
      console.log('🌐 Web interface can now fetch pre-computed results instantly.');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { runCheatDetectionAnalysis };