#!/usr/bin/env ts-node

/**
 * Export comprehensive Michael usage data for specified time periods
 * Exports all data related to Michael (chat sessions, messages, activities, analytics, etc.)
 */

import { connectToDatabase, COLLECTIONS } from '../lib/database';
import * as fs from 'fs';
import * as path from 'path';
import { ObjectId } from 'mongodb';

interface TimePeriod {
  name: string;
  startDate: Date;
  endDate: Date;
}

interface AnalyticsMetrics {
  // Chat metrics
  totalChatSessions: number;
  totalMessages: number;
  totalUsers: number;
  averageMessagesPerSession: number;
  averageMessagesPerUser: number;
  stdDevMessagesPerUser: number;
  stdDevMessagesPerSession: number;
  messagesByRole: { user: number; assistant: number };
  
  // Activity metrics
  totalActivities: number;
  activitiesByType: { [key: string]: number };
  
  // Conversation insights
  totalConversationSummaries: number;
  averageSessionDuration: number;
  comprehensionLevels: { low: number; medium: number; high: number };
  helpSeekingBehavior: { low: number; medium: number; high: number };
  engagementLevels: { low: number; medium: number; high: number };
  commonTopics: Array<{ topic: string; count: number }>;
  
  // Analytics events
  totalAnalyticsEvents: number;
  eventsByType: { [key: string]: number };
  
  // Question analytics
  totalQuestionAnalytics: number;
  averageTimeSpent: number;
  averageAttempts: number;
  averageTypingSpeed: number;
  
  // Feedback
  totalFeedbacks: number;
  feedbackByType: { [key: string]: number };
  
  // Analysis results
  totalAnalysisResults: number;
  knowledgeScoreDistribution: { empty: number; good: number; needs_attention: number; struggling: number };
  riskLevelDistribution: { low: number; medium: number; high: number };
  
  // Student profiles
  totalStudentProfiles: number;
  averageKnowledgeScore: string;
  averageEngagement: string;
}

interface MichaelUsageData {
  period: {
    name: string;
    startDate: string;
    endDate: string;
  };
  analytics: AnalyticsMetrics;
  conversationSummaries: any[];
  analysisResults: any[];
  questionAnalytics: any[];
  studentProfiles: any[];
  exportedAt: string;
}

// Helper to serialize MongoDB documents
function serializeDocument(doc: any): any {
  if (!doc) return doc;
  
  return JSON.parse(JSON.stringify(doc, (key, value) => {
    // Handle ObjectId
    if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'ObjectId') {
      return { $oid: value.toString() };
    }
    // Handle Date
    if (value instanceof Date) {
      return { $date: value.toISOString() };
    }
    return value;
  }));
}

// Helper to check if a date is within a period
function isDateInPeriod(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

// Helper to check if a document has any timestamp field within the period
function isDocumentInPeriod(doc: any, startDate: Date, endDate: Date): boolean {
  const timestampFields = ['timestamp', 'createdAt', 'updatedAt', 'lastMessageTimestamp', 'lastActivity', 'detectedAt', 'resolvedAt', 'lastIssueUpdate', 'lastAssessment', 'lastAnalysisDate'];
  
  for (const field of timestampFields) {
    if (doc[field]) {
      const date = doc[field] instanceof Date ? doc[field] : new Date(doc[field]);
      if (isDateInPeriod(date, startDate, endDate)) {
        return true;
      }
    }
  }
  
  return false;
}

async function exportPeriodData(db: any, period: TimePeriod): Promise<MichaelUsageData> {
  console.log(`\n📊 Exporting analytics for period: ${period.name}`);
  console.log(`   From: ${period.startDate.toISOString()}`);
  console.log(`   To: ${period.endDate.toISOString()}`);

  // 1. Get chat session counts (analytics only, no raw data)
  console.log('   🔄 Analyzing chat sessions...');
  const chatSessionsCount = await db.collection(COLLECTIONS.CHAT_SESSIONS)
    .countDocuments({
      $or: [
        { createdAt: { $gte: period.startDate, $lte: period.endDate } },
        { lastMessageTimestamp: { $gte: period.startDate, $lte: period.endDate } }
      ]
    });
  
  const chatSessions = await db.collection(COLLECTIONS.CHAT_SESSIONS)
    .find({
      $or: [
        { createdAt: { $gte: period.startDate, $lte: period.endDate } },
        { lastMessageTimestamp: { $gte: period.startDate, $lte: period.endDate } }
      ]
    })
    .project({ _id: 1, userId: 1, createdAt: 1, lastMessageTimestamp: 1 })
    .toArray();
  console.log(`   ✅ Found ${chatSessionsCount} chat sessions`);

  const sessionIds = chatSessions.map(s => s._id);
  const userIds = Array.from(new Set(chatSessions.map(s => s.userId).filter(Boolean)));

  // 2. Get message counts and metrics (analytics only)
  console.log('   🔄 Analyzing chat messages...');
  const chatMessages = await db.collection(COLLECTIONS.CHAT_MESSAGES)
    .find({
      $or: [
        { chatId: { $in: sessionIds } },
        { timestamp: { $gte: period.startDate, $lte: period.endDate } }
      ]
    })
    .project({ role: 1, timestamp: 1, chatId: 1 })
    .toArray();
  
  const messagesByRole = chatMessages.reduce((acc: any, msg: any) => {
    acc[msg.role || 'unknown'] = (acc[msg.role || 'unknown'] || 0) + 1;
    return acc;
  }, {});
  
  // Calculate per-user and per-session message counts for std dev
  const userMessageCounts = new Map<string, number>();
  const sessionMessageCounts = new Map<string, number>();
  
  chatMessages.forEach(msg => {
    const session = chatSessions.find(s => s._id?.toString() === msg.chatId?.toString());
    if (session) {
      const sessionId = session._id?.toString() || '';
      sessionMessageCounts.set(sessionId, (sessionMessageCounts.get(sessionId) || 0) + 1);
      
      if (session.userId) {
        const userId = String(session.userId);
        userMessageCounts.set(userId, (userMessageCounts.get(userId) || 0) + 1);
      }
    }
  });
  
  // Calculate std dev for messages per user
  const userMsgCounts = Array.from(userMessageCounts.values());
  const avgMsgsPerUser = userMsgCounts.length > 0 
    ? userMsgCounts.reduce((a, b) => a + b, 0) / userMsgCounts.length 
    : 0;
  const variancePerUser = userMsgCounts.length > 0
    ? userMsgCounts.reduce((sum, count) => sum + Math.pow(count - avgMsgsPerUser, 2), 0) / userMsgCounts.length
    : 0;
  const stdDevPerUser = Math.sqrt(variancePerUser);
  
  // Calculate std dev for messages per session
  const sessionMsgCounts = Array.from(sessionMessageCounts.values());
  const avgMsgsPerSession = sessionMsgCounts.length > 0
    ? sessionMsgCounts.reduce((a, b) => a + b, 0) / sessionMsgCounts.length
    : 0;
  const variancePerSession = sessionMsgCounts.length > 0
    ? sessionMsgCounts.reduce((sum, count) => sum + Math.pow(count - avgMsgsPerSession, 2), 0) / sessionMsgCounts.length
    : 0;
  const stdDevPerSession = Math.sqrt(variancePerSession);
  
  console.log(`   ✅ Found ${chatMessages.length} chat messages`);

  // 3. Get all user IDs from messages and sessions
  const allUserIds = new Set<string>();
  chatSessions.forEach(s => {
    if (s.userId) allUserIds.add(String(s.userId));
  });
  chatMessages.forEach(m => {
    if (m.userId) allUserIds.add(String(m.userId));
  });

  // 4. Get student activities analytics
  console.log('   🔄 Analyzing student activities...');
  const studentActivities = await db.collection(COLLECTIONS.STUDENT_ACTIVITIES)
    .find({
      $or: [
        { userId: { $in: Array.from(allUserIds) } },
        { timestamp: { $gte: period.startDate, $lte: period.endDate } }
      ]
    })
    .project({ activityType: 1, timestamp: 1 })
    .toArray();
  
  const filteredActivities = studentActivities.filter(activity => 
    isDocumentInPeriod(activity, period.startDate, period.endDate)
  );
  
  const activitiesByType = filteredActivities.reduce((acc: any, activity: any) => {
    const type = activity.activityType || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  console.log(`   ✅ Found ${filteredActivities.length} student activities`);

  // 5. Get conversation summaries
  console.log('   🔄 Fetching conversation summaries...');
  const conversationSummaries = await db.collection(COLLECTIONS.CONVERSATION_SUMMARIES)
    .find({
      $or: [
        { userId: { $in: Array.from(allUserIds) } },
        { createdAt: { $gte: period.startDate, $lte: period.endDate } },
        { updatedAt: { $gte: period.startDate, $lte: period.endDate } }
      ]
    })
    .toArray();
  // Filter by period
  const filteredSummaries = conversationSummaries.filter(summary => 
    isDocumentInPeriod(summary, period.startDate, period.endDate)
  );
  console.log(`   ✅ Found ${filteredSummaries.length} conversation summaries`);

  // 6. Get analytics events metrics
  console.log('   🔄 Analyzing analytics events...');
  const analyticsEvents = await db.collection(COLLECTIONS.ANALYTICS)
    .find({
      timestamp: { $gte: period.startDate, $lte: period.endDate }
    })
    .project({ eventType: 1, type: 1, timestamp: 1 })
    .toArray();
  
  const eventsByType = analyticsEvents.reduce((acc: any, event: any) => {
    const type = event.eventType || event.type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  console.log(`   ✅ Found ${analyticsEvents.length} analytics events`);

  // 7. Get question analytics (keep full data as it's analytics)
  console.log('   🔄 Fetching question analytics...');
  const questionAnalytics = await db.collection(COLLECTIONS.QUESTION_ANALYTICS)
    .find({
      $or: [
        { 'metrics.startedAt': { $gte: period.startDate.toISOString(), $lte: period.endDate.toISOString() } },
        { 'metrics.lastActivityAt': { $gte: period.startDate.toISOString(), $lte: period.endDate.toISOString() } }
      ]
    })
    .toArray();
  
  // Calculate question analytics metrics
  const timeSpentValues = questionAnalytics
    .map(qa => qa.metrics?.timeSpent)
    .filter((t): t is number => typeof t === 'number');
  const attemptsValues = questionAnalytics
    .map(qa => qa.metrics?.attempts)
    .filter((a): a is number => typeof a === 'number');
  const typingSpeedValues = questionAnalytics
    .map(qa => qa.metrics?.typingSpeed)
    .filter((t): t is number => typeof t === 'number');
  
  const averageTimeSpent = timeSpentValues.length > 0
    ? timeSpentValues.reduce((a, b) => a + b, 0) / timeSpentValues.length
    : 0;
  const averageAttempts = attemptsValues.length > 0
    ? attemptsValues.reduce((a, b) => a + b, 0) / attemptsValues.length
    : 0;
  const averageTypingSpeed = typingSpeedValues.length > 0
    ? typingSpeedValues.reduce((a, b) => a + b, 0) / typingSpeedValues.length
    : 0;
  
  console.log(`   ✅ Found ${questionAnalytics.length} question analytics`);

  // 8. Get feedbacks analytics
  console.log('   🔄 Analyzing feedbacks...');
  const feedbacks = await db.collection(COLLECTIONS.FEEDBACKS)
    .find({
      $or: [
        { userId: { $in: Array.from(allUserIds) } },
        { createdAt: { $gte: period.startDate, $lte: period.endDate } }
      ]
    })
    .project({ type: 1, feedback: 1, createdAt: 1 })
    .toArray();
  
  const filteredFeedbacks = feedbacks.filter(feedback => 
    isDocumentInPeriod(feedback, period.startDate, period.endDate)
  );
  
  const feedbackByType = filteredFeedbacks.reduce((acc: any, feedback: any) => {
    const type = feedback.type || feedback.feedback?.type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  console.log(`   ✅ Found ${filteredFeedbacks.length} feedbacks`);

  // 9. Get analysis results
  console.log('   🔄 Fetching analysis results...');
  const analysisResults = await db.collection(COLLECTIONS.ANALYSIS_RESULTS)
    .find({
      $or: [
        { userId: { $in: Array.from(allUserIds) } },
        { createdAt: { $gte: period.startDate, $lte: period.endDate } },
        { updatedAt: { $gte: period.startDate, $lte: period.endDate } }
      ]
    })
    .toArray();
  // Filter by period
  const filteredAnalysisResults = analysisResults.filter(result => 
    isDocumentInPeriod(result, period.startDate, period.endDate)
  );
  console.log(`   ✅ Found ${filteredAnalysisResults.length} analysis results`);

  // 9. Get student profiles for analytics
  console.log('   🔄 Analyzing student profiles...');
  const studentProfiles = await db.collection(COLLECTIONS.STUDENT_PROFILES)
    .find({
      userId: { $in: Array.from(allUserIds) }
    })
    .toArray();
  
  // Calculate profile metrics
  const knowledgeScoreDist = studentProfiles.reduce((acc: any, profile: any) => {
    const score = profile.knowledgeScore || 'empty';
    acc[score] = (acc[score] || 0) + 1;
    return acc;
  }, { empty: 0, good: 0, needs_attention: 0, struggling: 0 });
  
  const riskLevelDist = studentProfiles.reduce((acc: any, profile: any) => {
    const risk = profile.riskFactors?.riskLevel || 'low';
    acc[risk] = (acc[risk] || 0) + 1;
    return acc;
  }, { low: 0, medium: 0, high: 0 });
  
  const avgKnowledgeScore = studentProfiles.length > 0
    ? Object.keys(knowledgeScoreDist).reduce((max, key) => 
        knowledgeScoreDist[key] > knowledgeScoreDist[max] ? key : max, 'empty')
    : 'empty';
  
  console.log(`   ✅ Found ${studentProfiles.length} student profiles`);

  // 10. Get user information for analytics
  console.log('   🔄 Analyzing user data...');
  const userIdStrings = Array.from(allUserIds);
  const validObjectIds = userIdStrings.filter(id => ObjectId.isValid(id) && id.length === 24);
  const nonObjectIds = userIdStrings.filter(id => !ObjectId.isValid(id) || id.length !== 24);

  const queryConditions: any[] = [];
  if (validObjectIds.length > 0) {
    queryConditions.push({ _id: { $in: validObjectIds.map(id => new ObjectId(id)) } });
  }
  if (nonObjectIds.length > 0) {
    queryConditions.push({ _id: { $in: nonObjectIds } });
    queryConditions.push({ email: { $in: nonObjectIds } });
  }

  const users = queryConditions.length > 0
    ? await db.collection(COLLECTIONS.USERS)
        .find({ $or: queryConditions })
        .project({ _id: 1, email: 1, name: 1 })
        .toArray()
    : [];
  
  // Calculate unique users
  const uniqueUsers = new Set([
    ...chatSessions.map(s => String(s.userId)),
    ...filteredActivities.map(a => String(a.userId)),
    ...filteredSummaries.map(s => String(s.userId))
  ].filter(Boolean));

  // Calculate conversation summary metrics
  const comprehensionLevels = filteredSummaries.reduce((acc: any, summary: any) => {
    const level = summary.learningIndicators?.comprehensionLevel || 'medium';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, { low: 0, medium: 0, high: 0 });

  const helpSeekingBehavior = filteredSummaries.reduce((acc: any, summary: any) => {
    const level = summary.learningIndicators?.helpSeekingBehavior || 'medium';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, { low: 0, medium: 0, high: 0 });

  const engagementLevels = filteredSummaries.reduce((acc: any, summary: any) => {
    const level = summary.learningIndicators?.engagementLevel || 'medium';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, { low: 0, medium: 0, high: 0 });

  const sessionDurations = filteredSummaries
    .map(s => s.conversationMetadata?.sessionDuration)
    .filter((d): d is number => typeof d === 'number');
  const averageSessionDuration = sessionDurations.length > 0
    ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
    : 0;

  // Extract common topics
  const topicCounts = new Map<string, number>();
  filteredSummaries.forEach(summary => {
    const topics = summary.keyTopics || [];
    topics.forEach((topic: string) => {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    });
  });
  const commonTopics = Array.from(topicCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const analytics: AnalyticsMetrics = {
    // Chat metrics
    totalChatSessions: chatSessionsCount,
    totalMessages: chatMessages.length,
    totalUsers: uniqueUsers.size,
    averageMessagesPerSession: Math.round(avgMsgsPerSession * 100) / 100,
    averageMessagesPerUser: Math.round(avgMsgsPerUser * 100) / 100,
    stdDevMessagesPerUser: Math.round(stdDevPerUser * 100) / 100,
    stdDevMessagesPerSession: Math.round(stdDevPerSession * 100) / 100,
    messagesByRole: {
      user: messagesByRole.user || 0,
      assistant: messagesByRole.assistant || 0
    },
    
    // Activity metrics
    totalActivities: filteredActivities.length,
    activitiesByType,
    
    // Conversation insights
    totalConversationSummaries: filteredSummaries.length,
    averageSessionDuration: Math.round(averageSessionDuration * 100) / 100,
    comprehensionLevels,
    helpSeekingBehavior,
    engagementLevels,
    commonTopics,
    
    // Analytics events
    totalAnalyticsEvents: analyticsEvents.length,
    eventsByType,
    
    // Question analytics
    totalQuestionAnalytics: questionAnalytics.length,
    averageTimeSpent: Math.round(averageTimeSpent * 100) / 100,
    averageAttempts: Math.round(averageAttempts * 100) / 100,
    averageTypingSpeed: Math.round(averageTypingSpeed * 100) / 100,
    
    // Feedback
    totalFeedbacks: filteredFeedbacks.length,
    feedbackByType,
    
    // Analysis results
    totalAnalysisResults: filteredAnalysisResults.length,
    knowledgeScoreDistribution: knowledgeScoreDist,
    riskLevelDistribution: riskLevelDist,
    
    // Student profiles
    totalStudentProfiles: studentProfiles.length,
    averageKnowledgeScore: avgKnowledgeScore,
    averageEngagement: Object.keys(engagementLevels).reduce((max, key) => 
      engagementLevels[key] > engagementLevels[max] ? key : max, 'medium')
  };

  const data: MichaelUsageData = {
    period: {
      name: period.name,
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString()
    },
    analytics,
    conversationSummaries: filteredSummaries.map(serializeDocument),
    analysisResults: filteredAnalysisResults.map(serializeDocument),
    questionAnalytics: questionAnalytics.map(serializeDocument),
    studentProfiles: studentProfiles.map(serializeDocument),
    exportedAt: new Date().toISOString()
  };

  return data;
}

async function main() {
  console.log('🚀 Starting Michael Usage Data Export');
  console.log('=====================================\n');

  // Define time periods
  const periods: TimePeriod[] = [
    {
      name: 'July 2024 to September 2024',
      startDate: new Date('2024-07-01T00:00:00.000Z'),
      endDate: new Date('2024-09-30T23:59:59.999Z')
    },
    {
      name: 'October 2024 to February 2025',
      startDate: new Date('2024-10-01T00:00:00.000Z'),
      endDate: new Date('2025-02-28T23:59:59.999Z')
    },
    {
      name: 'March 2025 to June 2025',
      startDate: new Date('2025-03-01T00:00:00.000Z'),
      endDate: new Date('2025-06-30T23:59:59.999Z')
    },
    {
      name: 'July 2025 to September 2025',
      startDate: new Date('2025-07-01T00:00:00.000Z'),
      endDate: new Date('2025-09-30T23:59:59.999Z')
    },
    {
      name: 'October 2025 until now',
      startDate: new Date('2025-10-01T00:00:00.000Z'),
      endDate: new Date()
    }
  ];

  try {
    console.log('🔌 Connecting to MongoDB...');
    const { db } = await connectToDatabase();
    console.log('✅ Connected to database successfully!\n');

    // Create output directory
    const outputDir = path.join(process.cwd(), 'exports', 'michael-usage');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}\n`);
    }

    // Export data for each period
    const allPeriodsData: { [key: string]: MichaelUsageData } = {};

    for (const period of periods) {
      try {
        const periodData = await exportPeriodData(db, period);
        allPeriodsData[period.name] = periodData;

        // Save individual period file
        const safeFileName = period.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const filePath = path.join(outputDir, `michael-usage-${safeFileName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(periodData, null, 2), 'utf8');
        console.log(`   💾 Saved to: ${filePath}`);
      } catch (error) {
        console.error(`   ❌ Error exporting period ${period.name}:`, error);
      }
    }

    // Create combined export with all periods
    const combinedExport = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        totalPeriods: periods.length,
        periods: periods.map(p => ({
          name: p.name,
          startDate: p.startDate.toISOString(),
          endDate: p.endDate.toISOString()
        }))
      },
      data: allPeriodsData
    };

    const combinedFilePath = path.join(outputDir, 'michael-usage-all-periods.json');
    fs.writeFileSync(combinedFilePath, JSON.stringify(combinedExport, null, 2), 'utf8');
    console.log(`\n💾 Combined export saved to: ${combinedFilePath}`);

    // Print summary
    console.log('\n📊 Export Summary:');
    console.log('==================');
    Object.entries(allPeriodsData).forEach(([periodName, data]) => {
      console.log(`\n${periodName}:`);
      console.log(`  Chat Sessions: ${data.analytics.totalChatSessions}`);
      console.log(`  Messages: ${data.analytics.totalMessages}`);
      console.log(`  Users: ${data.analytics.totalUsers}`);
      console.log(`  Activities: ${data.analytics.totalActivities}`);
      console.log(`  Conversation Summaries: ${data.analytics.totalConversationSummaries}`);
      console.log(`  Analytics Events: ${data.analytics.totalAnalyticsEvents}`);
      console.log(`  Question Analytics: ${data.analytics.totalQuestionAnalytics}`);
      console.log(`  Feedbacks: ${data.analytics.totalFeedbacks}`);
      console.log(`  Analysis Results: ${data.analytics.totalAnalysisResults}`);
    });

    console.log('\n✨ Export completed successfully!');
    console.log(`📁 All files saved to: ${outputDir}`);

  } catch (error) {
    console.error('\n❌ Export failed:', error);
    process.exit(1);
  }
}

// Run the script
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}

export type { MichaelUsageData, TimePeriod, AnalyticsMetrics };
export { exportPeriodData };
