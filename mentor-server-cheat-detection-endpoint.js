// This file needs to be added to your mentor-server/api/ directory
// Suggested path: mentor-server/api/admin/cheat-detection.js

const { MongoClient } = require('mongodb');
const config = require('../config'); // Adjust path based on your config location

// Text similarity calculation using Jaccard similarity
function calculateJaccardSimilarity(text1, text2) {
  // Normalize and tokenize texts
  const normalize = (text) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(word => word.length > 2); // Filter out very short words
  };

  const tokens1 = new Set(normalize(text1));
  const tokens2 = new Set(normalize(text2));

  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  // Calculate intersection and union
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

// Levenshtein distance similarity (normalized)
function calculateLevenshteinSimilarity(str1, str2) {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  // Initialize matrix
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len2][len1]) / maxLen;
}

// SQL sequence similarity
function calculateSequenceSimilarity(text1, text2) {
  const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'HAVING', 'ORDER BY', 'INSERT', 'UPDATE', 'DELETE'];
  
  const extractKeywordSequence = (text) => {
    const upperText = text.toUpperCase();
    return sqlKeywords.filter(keyword => upperText.includes(keyword));
  };

  const seq1 = extractKeywordSequence(text1);
  const seq2 = extractKeywordSequence(text2);

  if (seq1.length === 0 && seq2.length === 0) return 1;
  if (seq1.length === 0 || seq2.length === 0) return 0;

  // Find longest common subsequence
  const lcs = findLCS(seq1, seq2);
  const maxLen = Math.max(seq1.length, seq2.length);
  
  return lcs.length / maxLen;
}

function findLCS(seq1, seq2) {
  const dp = Array(seq1.length + 1).fill(null).map(() => Array(seq2.length + 1).fill(0));
  
  for (let i = 1; i <= seq1.length; i++) {
    for (let j = 1; j <= seq2.length; j++) {
      if (seq1[i - 1] === seq2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Reconstruct LCS
  const lcs = [];
  let i = seq1.length, j = seq2.length;
  while (i > 0 && j > 0) {
    if (seq1[i - 1] === seq2[j - 1]) {
      lcs.unshift(seq1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

// Advanced similarity calculation combining multiple metrics
function calculateAdvancedSimilarity(text1, text2) {
  const jaccardScore = calculateJaccardSimilarity(text1, text2);
  const levenshteinSimilarity = calculateLevenshteinSimilarity(text1, text2);
  const sequenceSimilarity = calculateSequenceSimilarity(text1, text2);
  
  // Weighted average - giving more weight to Jaccard and sequence for SQL
  return (jaccardScore * 0.4 + levenshteinSimilarity * 0.3 + sequenceSimilarity * 0.3);
}

function getSuspicionLevel(score) {
  if (score >= 0.85) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

// Main endpoint handler
async function handleCheatDetection(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { similarityThreshold = 0.8, aiThreshold = 30 } = req.body;

    console.log('🔍 Starting cheat detection analysis...');

    const client = new MongoClient(config.mongoURL);
    await client.connect();
    const db = client.db();

    // Get all final exams from FinalExams collection
    const finalExamsCollection = db.collection('FinalExams');
    const examSessions = await finalExamsCollection.find({
      status: 'completed'
    }).toArray();

    console.log(`Found ${examSessions.length} completed exam sessions`);

    // Collect all answers from all exams
    const allAnswers = [];
    const examAnswers = []; // For frontend AI processing

    for (const session of examSessions) {
      try {
        // Try to get exam data from the collection
        let examData = null;
        
        // Try FinalExamAnswers first, then ExamAnswers
        const finalExamAnswersCollection = db.collection('FinalExamAnswers');
        examData = await finalExamAnswersCollection.findOne({ 
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
          for (let i = 0; i < examData.answers.length; i++) {
            const answer = examData.answers[i];
            if (answer.studentAnswer && answer.studentAnswer.trim()) {
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
              examAnswers.push(examAnswer); // For frontend processing
            }
          }
        }
      } catch (error) {
        console.error(`Error processing exam ${session._id}:`, error);
      }
    }

    console.log(`Collected ${allAnswers.length} answers for analysis`);

    // Similarity Analysis
    const similarityMatches = [];
    const answersByQuestion = {};

    // Group answers by question
    allAnswers.forEach(answer => {
      if (!answersByQuestion[answer.questionIndex]) {
        answersByQuestion[answer.questionIndex] = [];
      }
      answersByQuestion[answer.questionIndex].push(answer);
    });

    // Compare answers within each question
    Object.keys(answersByQuestion).forEach(questionIndexStr => {
      const questionIndex = parseInt(questionIndexStr);
      const answers = answersByQuestion[questionIndex];
      
      for (let i = 0; i < answers.length - 1; i++) {
        for (let j = i + 1; j < answers.length; j++) {
          const answer1 = answers[i];
          const answer2 = answers[j];

          // Skip if same student
          if (answer1.studentEmail === answer2.studentEmail) continue;

          const similarity = calculateAdvancedSimilarity(
            answer1.studentAnswer,
            answer2.studentAnswer
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
              similarityScore: similarity,
              student1Answer: answer1.studentAnswer,
              student2Answer: answer2.studentAnswer,
              suspicionLevel: getSuspicionLevel(similarity)
            });
          }
        }
      }
    });

    // Sort results by suspicion level and score
    similarityMatches.sort((a, b) => b.similarityScore - a.similarityScore);

    // Calculate statistics
    const stats = {
      totalExams: examSessions.length,
      suspiciousSimilarities: similarityMatches.length,
      suspiciousAI: 0, // Will be calculated on frontend
      averageSimilarityScore: similarityMatches.length > 0 
        ? similarityMatches.reduce((sum, match) => sum + match.similarityScore, 0) / similarityMatches.length 
        : 0,
      highRiskPairs: similarityMatches.filter(match => match.suspicionLevel === 'high').length
    };

    await client.close();

    console.log('✅ Cheat detection analysis completed on backend');

    res.json({
      similarityMatches,
      aiDetectionResults: [], // Will be populated on frontend
      examAnswers, // Send raw data for frontend AI processing
      stats
    });

  } catch (error) {
    console.error('Error in cheat detection analysis:', error);
    res.status(500).json({ error: 'שגיאה בניתוח חשדות העתקה' });
  }
}

module.exports = handleCheatDetection;

/* 
SETUP INSTRUCTIONS:

1. Save this file as: mentor-server/api/admin/cheat-detection.js

2. Add this route to your main server file (usually index.js):

   const cheatDetection = require('./admin/cheat-detection');
   app.post('/admin/cheat-detection', cheatDetection);

3. Make sure your config.js file exports the MongoDB URL:
   
   module.exports = {
     mongoURL: process.env.MONGODB_URI || 'your-mongodb-connection-string'
   };

4. The frontend will then be able to call this endpoint and process AI detection using the trapDetector.
*/