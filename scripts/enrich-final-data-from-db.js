#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const ExcelJS = require("exceljs");

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

const EXAM_PREP_SET_ID = process.env.EXAM_PREP_SET_ID || "697b602f8d8cd886902367b1";
const DB_NAME = process.env.DB_NAME || "experiment";
const INPUT_FINAL_CSV =
  process.env.FINAL_DATA_CSV || path.join(process.cwd(), "output", "final-data.csv");
const FORECAST_XLSX =
  process.env.FORECAST_XLSX ||
  "/Users/orperetz/Documents/מחקרים/מייקל-חיזוי/outputs/true_data/optimized_forecast/student_actual_vs_forecast.xlsx";
const OUTPUT_DIR = process.env.ENRICHED_OUTPUT_DIR || path.join(process.cwd(), "output");
const OUTPUT_CSV = path.join(OUTPUT_DIR, "final-data-enriched.csv");
const OUTPUT_XLSX = path.join(OUTPUT_DIR, "final-data-enriched.xlsx");
const OUTPUT_SUMMARY = path.join(OUTPUT_DIR, "final-data-enrichment-summary.json");

const COLLECTIONS = {
  users: "users",
  submissions: "submissions",
  questionAnalytics: "question_analytics",
  questions: "questions",
  homeworkSets: "homework_sets",
  chatSessions: "chatSessions",
  chatMessages: "chatMessages",
  studentProfiles: "student_profiles",
  studentActivities: "student_activities",
  conversationSummaries: "conversation_summaries",
  learningSummaries: "learning_summaries",
  learningQuizResults: "learning_quiz_results",
  coins: "Coins",
  userPoints: "userPoints",
  analyticsEvents: "analytics_events",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const clean = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    if (row.some((value) => value !== "")) rows.push(row);
  }
  const [headers, ...data] = rows;
  return data.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(filePath, rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return headers;
}

async function readForecastWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  const headerRow = sheet.getRow(1).values.slice(1).map((value) => String(value).trim());
  const rows = new Map();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record = {};
    headerRow.forEach((header, index) => {
      record[header] = row.getCell(index + 1).value ?? "";
    });
    if (record.numerical_forecast_grade != null && record.forecast_grade == null) {
      record.forecast_grade = record.numerical_forecast_grade;
    }
    if (record.prediction != null && record.forecast_label == null) {
      record.forecast_label = record.prediction;
    }
    if (record.forecast_correct != null && record.binary_correct == null) {
      record.binary_correct = record.forecast_correct;
    }
    if (
      record.actual_grade != null &&
      record.forecast_grade != null &&
      record.error == null
    ) {
      const actual = Number(record.actual_grade);
      const predicted = Number(record.forecast_grade);
      if (Number.isFinite(actual) && Number.isFinite(predicted)) {
        record.error = predicted - actual;
        record.abs_error = Math.abs(record.error);
      }
    }
    const student = String(record.student ?? "").trim();
    if (student) rows.set(student, record);
  });
  return rows;
}

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function iso(value) {
  const date = asDate(value);
  return date ? date.toISOString() : "";
}

function numberOrBlank(value, digits = null) {
  if (value == null || value === "") return "";
  if (typeof value === "object") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return digits == null ? num : Number(num.toFixed(digits));
}

function boolish(value) {
  if (value === true) return 1;
  if (value === false) return 0;
  if (value === "true") return 1;
  if (value === "false") return 0;
  return value ? 1 : 0;
}

function addToSet(set, value) {
  if (value == null) return;
  const text = String(value).trim();
  if (text) set.add(text);
}

function compactList(values, limit = 12) {
  return [...new Set(values.filter(Boolean).map(compactText).filter(Boolean))]
    .slice(0, limit)
    .join("; ");
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function makeStudentSeed(baseRow) {
  return {
    baseStudentId: String(baseRow.studentId || "").trim(),
    nationalId: String(baseRow.ID || "").trim(),
    keys: new Set([baseRow.studentId, baseRow.ID].filter(Boolean).map((v) => String(v).trim())),
  };
}

function buildQuestionColumns(questions, submissions, questionAnalytics, homeworkSet) {
  const questionById = new Map();
  for (const question of questions) {
    if (question.id) questionById.set(question.id, question);
    if (question._id) questionById.set(String(question._id), question);
  }

  const firstSeen = new Map();
  const counts = new Map();
  let order = 0;
  const track = (id) => {
    if (!id) return;
    const key = String(id);
    if (!firstSeen.has(key)) firstSeen.set(key, order++);
    counts.set(key, (counts.get(key) || 0) + 1);
  };

  for (const submission of submissions) {
    Object.keys(submission.answers || {}).forEach(track);
  }
  for (const item of questionAnalytics) {
    track(item.questionId);
  }

  const homeworkOrder = new Map((homeworkSet?.questionOrder || []).map((id, index) => [id, index]));
  const ids = [...firstSeen.keys()].sort((a, b) => {
    const orderA = homeworkOrder.has(a) ? homeworkOrder.get(a) : Number.POSITIVE_INFINITY;
    const orderB = homeworkOrder.has(b) ? homeworkOrder.get(b) : Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    return firstSeen.get(a) - firstSeen.get(b);
  });

  return ids.map((id, index) => {
    const question = questionById.get(id) || { id };
    return {
    index: index + 1,
    id: question.id || id,
    dbId: question._id ? String(question._id) : id,
    prompt: question.prompt || "",
    points: question.points ?? "",
    recordCount: counts.get(id) || 0,
    prefix: `q${String(index + 1).padStart(2, "0")}`,
    };
  });
}

function scoreFromAnswer(answer) {
  const score = answer?.feedback?.score;
  return typeof score === "number" ? score : "";
}

function querySetId(setId) {
  return {
    $or: [{ homeworkSetId: setId }, { homeworkSetId: ObjectId.isValid(setId) ? new ObjectId(setId).toString() : setId }],
  };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required in .env or .env.local");
  }
  if (!fs.existsSync(INPUT_FINAL_CSV)) throw new Error(`Missing input CSV: ${INPUT_FINAL_CSV}`);
  if (!fs.existsSync(FORECAST_XLSX)) throw new Error(`Missing forecast XLSX: ${FORECAST_XLSX}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const baseRows = parseCsv(fs.readFileSync(INPUT_FINAL_CSV, "utf8"));
  const forecastByStudent = await readForecastWorkbook(FORECAST_XLSX);
  const students = baseRows.map(makeStudentSeed);
  const baseStudentIds = students.map((s) => s.baseStudentId).filter(Boolean);
  const nationalIds = students.map((s) => s.nationalId).filter(Boolean);
  const objectIds = baseStudentIds
    .filter((id) => /^[a-fA-F0-9]{24}$/.test(id) && ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    maxPoolSize: 8,
  });
  await client.connect();
  const db = client.db(DB_NAME);

  const [
    users,
    homeworkSet,
    questions,
    submissions,
    questionAnalytics,
    profiles,
    activities,
    conversationSummaries,
    learningSummaries,
    quizResults,
    coins,
    userPoints,
  ] = await Promise.all([
    db.collection(COLLECTIONS.users).find({}, { projection: { password: 0 } }).toArray(),
    db.collection(COLLECTIONS.homeworkSets).findOne({ _id: new ObjectId(EXAM_PREP_SET_ID) }).catch(() => null),
    db.collection(COLLECTIONS.questions).find({ homeworkSetId: EXAM_PREP_SET_ID }).toArray(),
    db.collection(COLLECTIONS.submissions).find({
      ...querySetId(EXAM_PREP_SET_ID),
      studentId: { $in: baseStudentIds },
    }).toArray(),
    db.collection(COLLECTIONS.questionAnalytics).find({
      ...querySetId(EXAM_PREP_SET_ID),
      studentId: { $in: baseStudentIds },
    }).toArray(),
    db.collection(COLLECTIONS.studentProfiles).find({
      $or: [
        { userId: { $in: [...baseStudentIds, ...nationalIds] } },
        { email: { $in: baseStudentIds } },
        ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
      ],
    }).toArray(),
    db.collection(COLLECTIONS.studentActivities).find({
      userId: { $in: [...baseStudentIds, ...nationalIds] },
    }).toArray(),
    db.collection(COLLECTIONS.conversationSummaries).find({
      userId: { $in: [...baseStudentIds, ...nationalIds] },
    }).toArray(),
    db.collection(COLLECTIONS.learningSummaries).find({
      userId: { $in: [...baseStudentIds, ...nationalIds] },
    }).toArray(),
    db.collection(COLLECTIONS.learningQuizResults).find({
      userId: { $in: [...baseStudentIds, ...nationalIds] },
    }).toArray(),
    db.collection(COLLECTIONS.coins).find({}).toArray(),
    db.collection(COLLECTIONS.userPoints).find({}).toArray(),
  ]);

  const userByKey = new Map();
  for (const user of users) {
    const keys = [user._id && String(user._id), user.id, user.studentIdNumber, user.email].filter(Boolean);
    for (const key of keys) userByKey.set(String(key).trim(), user);
  }

  for (const student of students) {
    const user = userByKey.get(student.baseStudentId) || userByKey.get(student.nationalId);
    student.user = user || null;
    if (user) {
      addToSet(student.keys, user._id && String(user._id));
      addToSet(student.keys, user.id);
      addToSet(student.keys, user.studentIdNumber);
      addToSet(student.keys, user.email);
    }
  }

  const keyToStudent = new Map();
  for (const student of students) {
    for (const key of student.keys) keyToStudent.set(key, student.baseStudentId);
  }
  const allKeys = [...keyToStudent.keys()];

  const sessions = await db
    .collection(COLLECTIONS.chatSessions)
    .find({ userId: { $in: allKeys } })
    .toArray();
  const sessionIds = sessions.map((session) => String(session._id));
  const messages = sessionIds.length
    ? await db
        .collection(COLLECTIONS.chatMessages)
        .find({ chatId: { $in: sessionIds } }, { projection: { chatId: 1, role: 1, text: 1, timestamp: 1 } })
        .toArray()
    : [];

  await client.close();

  const questionColumns = buildQuestionColumns(questions, submissions, questionAnalytics, homeworkSet);
  const submissionsByStudent = new Map(submissions.map((sub) => [sub.studentId, sub]));
  const qaByStudent = new Map();
  for (const item of questionAnalytics) {
    const list = qaByStudent.get(item.studentId) || [];
    list.push(item);
    qaByStudent.set(item.studentId, list);
  }

  const chatByStudent = new Map();
  const messagesBySession = new Map();
  for (const message of messages) {
    const sid = String(message.chatId);
    const list = messagesBySession.get(sid) || [];
    list.push(message);
    messagesBySession.set(sid, list);
  }
  for (const session of sessions) {
    const owner = keyToStudent.get(String(session.userId));
    if (!owner) continue;
    const stats = chatByStudent.get(owner) || {
      sessions: 0,
      messages: 0,
      userMessages: 0,
      assistantMessages: 0,
      textChars: 0,
      totalDurationMs: 0,
      first: null,
      last: null,
      titles: [],
    };
    const sessionMessages = messagesBySession.get(String(session._id)) || [];
    const timestamps = sessionMessages.map((m) => asDate(m.timestamp)).filter(Boolean);
    const firstMessage = timestamps.length ? new Date(Math.min(...timestamps.map((d) => d.getTime()))) : null;
    const lastMessage = timestamps.length ? new Date(Math.max(...timestamps.map((d) => d.getTime()))) : null;
    const created = asDate(session.createdAt);
    const last = lastMessage || asDate(session.lastMessageTimestamp) || created;
    const first = firstMessage || created;
    stats.sessions += 1;
    stats.messages += sessionMessages.length;
    stats.userMessages += sessionMessages.filter((m) => m.role === "user").length;
    stats.assistantMessages += sessionMessages.filter((m) => m.role === "assistant").length;
    stats.textChars += sessionMessages.reduce((sum, m) => sum + String(m.text || "").length, 0);
    if (first && last && last >= first) stats.totalDurationMs += last.getTime() - first.getTime();
    if (!stats.first || (first && first < stats.first)) stats.first = first;
    if (!stats.last || (last && last > stats.last)) stats.last = last;
    if (session.title) stats.titles.push(session.title);
    chatByStudent.set(owner, stats);
  }

  const activityByStudent = new Map();
  for (const activity of activities) {
    const owner = keyToStudent.get(String(activity.userId));
    if (!owner) continue;
    const stats = activityByStudent.get(owner) || {
      count: 0,
      chat: 0,
      homework: 0,
      login: 0,
      help: 0,
      practice: 0,
      quiz: 0,
      messageCount: 0,
      timeSpentMs: 0,
      sessionDuration: 0,
      first: null,
      last: null,
      topics: [],
    };
    stats.count += 1;
    if (activity.activityType === "chat") stats.chat += 1;
    if (activity.activityType === "homework") stats.homework += 1;
    if (activity.activityType === "login") stats.login += 1;
    if (activity.activityType === "help_request") stats.help += 1;
    if (activity.activityType === "practice") stats.practice += 1;
    if (activity.activityType === "quiz") stats.quiz += 1;
    stats.messageCount += Number(activity.activityData?.messageCount || 0);
    stats.timeSpentMs += Number(activity.activityData?.timeSpent || 0);
    stats.sessionDuration += Number(activity.activityData?.sessionDuration || 0);
    if (activity.activityData?.topic) stats.topics.push(activity.activityData.topic);
    const when = asDate(activity.timestamp);
    if (!stats.first || (when && when < stats.first)) stats.first = when;
    if (!stats.last || (when && when > stats.last)) stats.last = when;
    activityByStudent.set(owner, stats);
  }

  const byCollection = (docs, keyField) => {
    const map = new Map();
    for (const doc of docs) {
      for (const key of [doc[keyField], doc.userId, doc.email, doc.user].filter(Boolean)) {
        const owner = keyToStudent.get(String(key));
        if (!owner) continue;
        const list = map.get(owner) || [];
        list.push(doc);
        map.set(owner, list);
        break;
      }
    }
    return map;
  };

  const profilesByStudent = byCollection(profiles, "userId");
  const summariesByStudent = byCollection(conversationSummaries, "userId");
  const learningByStudent = byCollection(learningSummaries, "userId");
  const quizByStudent = byCollection(quizResults, "userId");
  const coinsByStudent = byCollection(coins, "user");
  const pointsByStudent = byCollection(userPoints, "userId");

  const enriched = baseRows.map((baseRow) => {
    const studentId = String(baseRow.studentId || "").trim();
    const nationalId = String(baseRow.ID || "").trim();
    const seed = students.find((s) => s.baseStudentId === studentId);
    const user = seed?.user || null;
    const forecast = forecastByStudent.get(nationalId) || forecastByStudent.get(studentId) || {};
    const submission = submissionsByStudent.get(studentId);
    const qaList = qaByStudent.get(studentId) || [];
    const qaByQuestion = new Map(qaList.map((qa) => [qa.questionId, qa]));
    const chat = chatByStudent.get(studentId) || {};
    const activity = activityByStudent.get(studentId) || {};
    const profile = (profilesByStudent.get(studentId) || [])[0] || {};
    const summaries = summariesByStudent.get(studentId) || [];
    const learning = learningByStudent.get(studentId) || [];
    const quizzes = quizByStudent.get(studentId) || [];
    const coinRows = coinsByStudent.get(studentId) || [];
    const pointRows = pointsByStudent.get(studentId) || [];

    let answeredFromSubmission = 0;
    let feedbackScoreTotal = 0;
    let feedbackScoreCount = 0;
    let totalExecutionCount = 0;
    const distribution = [];
    const questionFields = {};

    for (const q of questionColumns) {
      const answer = submission?.answers?.[q.id] || submission?.answers?.[q.dbId] || {};
      const qa = qaByQuestion.get(q.id) || qaByQuestion.get(q.dbId) || {};
      const sql = String(answer.sql || "");
      const answered = sql.trim() ? 1 : 0;
      const score = scoreFromAnswer(answer);
      answeredFromSubmission += answered;
      totalExecutionCount += Number(answer.executionCount || 0);
      if (typeof score === "number") {
        feedbackScoreTotal += score;
        feedbackScoreCount += 1;
      }
      distribution.push(answered);
      questionFields[`${q.prefix}_answered`] = answered;
      questionFields[`${q.prefix}_score`] = score;
      questionFields[`${q.prefix}_execution_count`] = numberOrBlank(answer.executionCount);
      questionFields[`${q.prefix}_sql_chars`] = sql.length || "";
      questionFields[`${q.prefix}_time_spent_ms`] = numberOrBlank(qa.metrics?.timeSpent);
      questionFields[`${q.prefix}_attempts`] = numberOrBlank(qa.metrics?.attempts);
      questionFields[`${q.prefix}_typing_speed`] = numberOrBlank(qa.metrics?.typingSpeed, 1);
      questionFields[`${q.prefix}_show_answer_clicks`] = numberOrBlank(qa.metrics?.showAnswerClicks);
      questionFields[`${q.prefix}_time_to_first_show_answer_ms`] = numberOrBlank(
        qa.metrics?.timeToFirstShowAnswer
      );
      questionFields[`${q.prefix}_copy_paste_count`] = numberOrBlank(qa.metrics?.copyPasteCount);
      questionFields[`${q.prefix}_ai_assistance_used`] = boolish(
        qa.metrics?.generalAnalysis?.aiAssistanceUsed
      );
    }

    const issueHistory = Array.isArray(profile.issueHistory) ? profile.issueHistory : [];
    const issueSeverities = issueHistory.reduce(
      (acc, issue) => {
        if (issue.severity === "high") acc.high += 1;
        if (issue.severity === "medium") acc.medium += 1;
        if (issue.severity === "low") acc.low += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 }
    );
    const summaryTopics = summaries.flatMap((summary) => summary.keyTopics || []);
    const challengeAreas = summaries.flatMap(
      (summary) => summary.learningIndicators?.challengeAreas || []
    );
    const quizScores = quizzes.map((quiz) => Number(quiz.score)).filter(Number.isFinite);

    return {
      ...baseRow,
      actual_grade: numberOrBlank(forecast.actual_grade),
      forecast_grade: numberOrBlank(forecast.forecast_grade, 3),
      actual_label: forecast.actual_label || "",
      forecast_label: forecast.forecast_label || "",
      forecast_pass_probability: numberOrBlank(forecast.forecast_pass_probability, 3),
      forecast_binary_correct: forecast.binary_correct ?? "",
      forecast_error: numberOrBlank(forecast.error, 3),
      forecast_abs_error: numberOrBlank(forecast.abs_error, 3),
      user_email: user?.email || "",
      user_name:
        user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "",
      user_first_name: user?.firstName || "",
      user_last_name: user?.lastName || "",
      user_db_id: user?._id ? String(user._id) : "",
      exam_prep_set_id: EXAM_PREP_SET_ID,
      exam_prep_set_title: homeworkSet?.title || "",
      exam_prep_submission_id: submission?._id ? String(submission._id) : "",
      exam_prep_created_at: iso(submission?.createdAt),
      exam_prep_updated_at: iso(submission?.updatedAt),
      exam_prep_answered_distribution: distribution.join("|"),
      exam_prep_answered_from_submission: answeredFromSubmission,
      exam_prep_unanswered_from_submission: questionColumns.length - answeredFromSubmission,
      exam_prep_feedback_score_total: feedbackScoreTotal || "",
      exam_prep_feedback_score_count: feedbackScoreCount || "",
      exam_prep_feedback_score_avg: feedbackScoreCount
        ? Number((feedbackScoreTotal / feedbackScoreCount).toFixed(2))
        : "",
      exam_prep_answer_execution_total: totalExecutionCount || "",
      exam_prep_question_analytics_records: qaList.length,
      ...questionFields,
      chat_total_sessions: numberOrBlank(chat.sessions),
      chat_total_messages: numberOrBlank(chat.messages),
      chat_user_messages: numberOrBlank(chat.userMessages),
      chat_assistant_messages: numberOrBlank(chat.assistantMessages),
      chat_total_text_chars: numberOrBlank(chat.textChars),
      chat_total_duration_ms: numberOrBlank(chat.totalDurationMs),
      chat_total_duration_minutes: chat.totalDurationMs
        ? Number((chat.totalDurationMs / 60000).toFixed(2))
        : "",
      chat_first_at: iso(chat.first),
      chat_last_at: iso(chat.last),
      chat_recent_titles: compactList(chat.titles || [], 5),
      activity_total_events: numberOrBlank(activity.count),
      activity_chat_events: numberOrBlank(activity.chat),
      activity_homework_events: numberOrBlank(activity.homework),
      activity_login_events: numberOrBlank(activity.login),
      activity_help_request_events: numberOrBlank(activity.help),
      activity_practice_events: numberOrBlank(activity.practice),
      activity_quiz_events: numberOrBlank(activity.quiz),
      activity_message_count_sum: numberOrBlank(activity.messageCount),
      activity_time_spent_ms_sum: numberOrBlank(activity.timeSpentMs),
      activity_session_duration_sum: numberOrBlank(activity.sessionDuration),
      activity_first_at: iso(activity.first),
      activity_last_at: iso(activity.last),
      activity_topics: compactList(activity.topics || []),
      profile_knowledge_score: profile.knowledgeScore || "",
      profile_last_activity: iso(profile.lastActivity),
      profile_total_questions: numberOrBlank(profile.totalQuestions),
      profile_correct_answers: numberOrBlank(profile.correctAnswers),
      profile_homework_submissions: numberOrBlank(profile.homeworkSubmissions),
      profile_average_grade: numberOrBlank(profile.averageGrade, 2),
      profile_sql_basics: numberOrBlank(profile.learningProgress?.sqlBasics),
      profile_joins: numberOrBlank(profile.learningProgress?.joins),
      profile_aggregations: numberOrBlank(profile.learningProgress?.aggregations),
      profile_subqueries: numberOrBlank(profile.learningProgress?.subqueries),
      profile_advanced_queries: numberOrBlank(profile.learningProgress?.advancedQueries),
      profile_engagement_chat_sessions: numberOrBlank(profile.engagementMetrics?.chatSessions),
      profile_engagement_avg_session_duration: numberOrBlank(
        profile.engagementMetrics?.averageSessionDuration
      ),
      profile_engagement_help_requests: numberOrBlank(profile.engagementMetrics?.helpRequests),
      profile_engagement_self_corrections: numberOrBlank(
        profile.engagementMetrics?.selfCorrections
      ),
      profile_risk_is_at_risk: boolish(profile.riskFactors?.isAtRisk),
      profile_risk_level: profile.riskFactors?.riskLevel || "",
      profile_risk_factors: compactList(profile.riskFactors?.riskFactors || []),
      profile_conversation_total_sessions: numberOrBlank(
        profile.conversationInsights?.totalSessions
      ),
      profile_conversation_avg_session_duration: numberOrBlank(
        profile.conversationInsights?.averageSessionDuration
      ),
      profile_conversation_topics: compactList(
        profile.conversationInsights?.mostCommonTopics || []
      ),
      profile_learning_trend: profile.conversationInsights?.learningTrend || "",
      profile_overall_engagement: profile.conversationInsights?.overallEngagement || "",
      profile_issue_count: numberOrBlank(profile.issueCount ?? issueHistory.length),
      profile_high_issue_count: issueSeverities.high,
      profile_medium_issue_count: issueSeverities.medium,
      profile_low_issue_count: issueSeverities.low,
      conversation_summary_count: summaries.length,
      conversation_summary_topics: compactList(summaryTopics),
      conversation_summary_challenge_areas: compactList(challengeAreas),
      conversation_summary_avg_confidence: summaries.length
        ? Number(
            (
              summaries.reduce((sum, s) => sum + Number(s.aiInsights?.confidenceScore || 0), 0) /
              summaries.length
            ).toFixed(2)
          )
        : "",
      learning_summary_count: learning.length,
      learning_summary_modes: compactList(learning.map((item) => item.summaryMode)),
      learning_summary_pdf_ids: compactList(learning.map((item) => item.pdfId)),
      learning_quiz_attempts: quizzes.length,
      learning_quiz_avg_score: quizScores.length
        ? Number((quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length).toFixed(2))
        : "",
      coins_balance: coinRows.length ? numberOrBlank(coinRows[0].coins) : "",
      user_points: pointRows.length ? numberOrBlank(pointRows[0].points) : "",
    };
  });

  const headers = writeCsv(OUTPUT_CSV, enriched);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("enriched_students", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(36, Math.max(12, header.length + 2)) }));
  sheet.addRows(enriched);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
  await workbook.xlsx.writeFile(OUTPUT_XLSX);

  const summary = {
    generatedAt: new Date().toISOString(),
    dbName: DB_NAME,
    examPrepSetId: EXAM_PREP_SET_ID,
    inputFinalCsv: INPUT_FINAL_CSV,
    inputForecastXlsx: FORECAST_XLSX,
    outputCsv: OUTPUT_CSV,
    outputXlsx: OUTPUT_XLSX,
    rowCount: enriched.length,
    columnCount: headers.length,
    sourceCounts: {
      baseRows: baseRows.length,
      forecastRows: forecastByStudent.size,
      users: users.length,
      submissions: submissions.length,
      questionAnalytics: questionAnalytics.length,
      chatSessions: sessions.length,
      chatMessages: messages.length,
      studentProfiles: profiles.length,
      studentActivities: activities.length,
      conversationSummaries: conversationSummaries.length,
      learningSummaries: learningSummaries.length,
      learningQuizResults: quizResults.length,
      coins: coins.length,
      userPoints: userPoints.length,
    },
      questionMap: questionColumns.map((q) => ({
      prefix: q.prefix,
      id: q.id,
      points: q.points,
      recordCount: q.recordCount,
      prompt: q.prompt,
    })),
  };
  fs.writeFileSync(OUTPUT_SUMMARY, JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
