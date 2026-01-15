/**
 * Migration Script: Update all question scores from 10 points to 8 points
 * 
 * This script:
 * 1. Updates all Question.points from 10 to 8
 * 2. Updates all submission scores proportionally (e.g., 8/10 → 6/8)
 * 3. Uses proper rounding (0.5 and above rounds up)
 */

import { connectToDatabase, COLLECTIONS } from '../lib/database';

interface SqlAnswer {
  sql: string;
  resultPreview?: any;
  feedback?: {
    questionId: string;
    score: number;
    autoNotes?: string;
    instructorNotes?: string;
    rubricBreakdown: any[];
  };
  lastExecutedAt?: string;
  executionCount?: number;
}

interface SubmissionDoc {
  _id: any;
  id: string;
  homeworkSetId: string;
  studentId: string;
  attemptNumber: number;
  answers: Record<string, SqlAnswer>;
  overallScore: number;
  status: string;
  submittedAt?: string;
  gradedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface QuestionDoc {
  _id: any;
  id: string;
  homeworkSetId: string;
  points: number;
  prompt: string;
}

/**
 * Convert a score from 10-point scale to 8-point scale with proper rounding
 */
function convertScore(oldScore: number): number {
  // Formula: new_score = round(old_score * 8 / 10)
  const newScore = (oldScore * 8) / 10;
  return Math.round(newScore);
}

async function main() {
  console.log('🚀 Starting score migration from 10 points to 8 points...\n');

  const { db } = await connectToDatabase();
  const submissionsCollection = db.collection<SubmissionDoc>(COLLECTIONS.SUBMISSIONS);
  const questionsCollection = db.collection<QuestionDoc>(COLLECTIONS.QUESTIONS);

  let updatedSubmissions = 0;
  let updatedQuestions = 0;
  let totalScoresUpdated = 0;

  try {
    // Step 1: Update all questions with points = 10 to points = 8
    console.log('📝 Step 1: Updating questions...');
    const questionsResult = await questionsCollection.updateMany(
      { points: 10 },
      { $set: { points: 8 } }
    );
    updatedQuestions = questionsResult.modifiedCount;
    console.log(`   ✅ Updated ${updatedQuestions} questions from 10 to 8 points\n`);

    // Step 2: Update all submissions
    console.log('📊 Step 2: Updating submissions...');
    const submissions = await submissionsCollection.find({}).toArray();
    console.log(`   Found ${submissions.length} submissions to process\n`);

    for (const submission of submissions) {
      let hasChanges = false;
      let newOverallScore = 0;
      const updatedAnswers: Record<string, SqlAnswer> = {};

      // Process each answer
      for (const [questionId, answer] of Object.entries(submission.answers)) {
        const updatedAnswer = { ...answer };

        // Update score if feedback exists
        if (answer.feedback && typeof answer.feedback.score === 'number') {
          const oldScore = answer.feedback.score;
          const newScore = convertScore(oldScore);

          if (oldScore !== newScore) {
            updatedAnswer.feedback = {
              ...answer.feedback,
              score: newScore,
            };
            hasChanges = true;
            totalScoresUpdated++;

            console.log(
              `   📝 Submission ${submission.id.substring(0, 8)} - Question ${questionId.substring(0, 8)}: ${oldScore} → ${newScore}`
            );
          }

          newOverallScore += newScore;
        } else if (answer.feedback) {
          // No score yet, keep as is
          newOverallScore += answer.feedback.score || 0;
        }

        updatedAnswers[questionId] = updatedAnswer;
      }

      // Update submission if there are changes
      if (hasChanges) {
        await submissionsCollection.updateOne(
          { _id: submission._id },
          {
            $set: {
              answers: updatedAnswers,
              overallScore: newOverallScore,
              updatedAt: new Date().toISOString(),
            },
          }
        );
        updatedSubmissions++;
      }
    }

    // Summary
    console.log('\n✨ Migration completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Questions updated: ${updatedQuestions}`);
    console.log(`📊 Submissions updated: ${updatedSubmissions}`);
    console.log(`🎯 Individual scores updated: ${totalScoresUpdated}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Show some examples
    if (totalScoresUpdated > 0) {
      console.log('📋 Example conversions:');
      console.log('   10/10 → 8/8');
      console.log('   8/10 → 6/8 (6.4 rounded down)');
      console.log('   7/10 → 6/8 (5.6 rounded up)');
      console.log('   5/10 → 4/8 (4.0 exact)');
      console.log('   3/10 → 2/8 (2.4 rounded down)');
      console.log('   9/10 → 7/8 (7.2 rounded down)\n');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
main()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
