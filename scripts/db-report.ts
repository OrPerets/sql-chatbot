#!/usr/bin/env ts-node
/**
 * Database report: list all collections with counts, last activity, and codebase usage.
 * Writes docs/db-report.md.
 *
 * Run: npx ts-node --project tsconfig.scripts.json scripts/db-report.ts
 * Or:  MONGODB_URI=... DB_NAME=... npx ts-node --project tsconfig.scripts.json scripts/db-report.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Db, ObjectId } from 'mongodb';
import { connectToDatabase, COLLECTIONS } from '../lib/database';

const KNOWN_COLLECTION_NAMES = new Set<string>(Object.values(COLLECTIONS) as string[]);

/** Where each collection is referenced in the codebase (for the report). Keys are collection names as strings. */
const USAGE_SOURCES: Record<string, string[]> = {
  datasets: ['lib/datasets.ts', 'lib/data-generation.ts', 'scripts/migrate-to-database.ts', 'app/api/datasets'],
  homework_sets: ['lib/homework.ts', 'scripts/export-homework-1*.ts', 'scripts/check-*.ts', 'lib/submissions.ts'],
  questions: ['lib/questions.ts', 'lib/submissions.ts', 'scripts/export-homework-1*.ts'],
  submissions: ['lib/submissions.ts', 'lib/homework.ts', 'lib/ai-analysis-engine.ts', 'scripts/check-*.ts', 'app/api/submissions'],
  analytics_events: ['scripts/export-homework-1*.ts', 'scripts/export-michael-usage.ts'],
  audit_logs: ['lib/models.ts'],
  question_templates: ['lib/template-service.ts', 'scripts/export-homework-1*.ts'],
  instantiated_questions: ['lib/template-service.ts', 'scripts/export-homework-1*.ts'],
  analysis_results: ['lib/ai-analysis-engine.ts', 'app/api/analysis/insights/route.ts', 'app/api/analysis/student'],
  question_analytics: ['lib/question-analytics.ts', 'scripts/export-michael-usage.ts'],
  users: ['lib/users.ts', 'lib/student-profiles.ts', 'app/api/admin/students', 'scripts/upload-users-to-mongo.ts', 'scripts/analyze-student-data.ts'],
  chatSessions: ['lib/chat.ts', 'scripts/analyze-student-data.ts'],
  chatMessages: ['lib/chat.ts', 'lib/ai-analysis-engine.ts', 'scripts/analyze-student-data.ts'],
  Coins: ['lib/coins.ts'],
  userPoints: ['app/api/user-points/route.ts', 'scripts/analyze-student-data.ts'],
  Feedbacks: ['app/api/feedback.ts', 'scripts/analyze-student-data.ts', 'scripts/export-michael-usage.ts'],
  UserForms: ['app/api/feedback/user-form/route.ts'],
  Status: ['app/api/admin/status/route.ts'],
  CoinsStatus: ['lib/coins.ts'],
  practiceTables: ['lib/practice.ts'],
  practiceQueries: ['lib/practice.ts'],
  practiceAttempts: ['lib/practice.ts'],
  weekly_content: ['lib/content.ts', 'scripts/check-current-week.ts'],
  semester_config: ['lib/content.ts', 'lib/openai/runtime-config.ts', 'lib/openai/vector-store.ts', 'scripts/check-current-week.ts'],
  notifications: ['lib/notifications.ts', 'app/api/admin/notifications'],
  password_reset_tokens: ['lib/users.ts', 'scripts/cleanup-expired-tokens.ts', 'app/api/test-database/route.ts'],
  student_profiles: ['lib/student-profiles.ts', 'lib/activity-tracker.ts', 'app/api/admin/students', 'scripts/analyze-student-data.ts'],
  student_activities: ['lib/activity-tracker.ts', 'lib/student-profiles.ts', 'app/api/admin/students/export', 'scripts/analyze-student-data.ts'],
  conversation_summaries: ['scripts/analyze-student-data.ts'],
  rate_limits: ['lib/rate-limiter.ts', 'scripts/cleanup-expired-tokens.ts', 'scripts/setup-database-security.ts'],
  ip_rate_limits: ['scripts/cleanup-expired-tokens.ts', 'scripts/setup-database-security.ts'],
  security_events: ['lib/monitoring.ts', 'scripts/cleanup-expired-tokens.ts', 'scripts/setup-database-security.ts'],
  submitted: ['scripts/populate-submitted-collection.ts', 'scripts/view-submitted-collection.ts', 'scripts/resend-submission-email.ts'],
  generated_data: ['lib/data-generation.ts', 'app/api/datasets/[id]/preview-generated/route.ts'],
  monitoring_metrics: ['lib/monitoring.ts'],
  alerts: ['lib/monitoring.ts'],
};

interface CollectionStats {
  name: string;
  count: number;
  lastActivity: string | null;
  inCodebase: boolean;
  usageFiles: string[];
}

function getUsageFiles(collectionName: string): string[] {
  return USAGE_SOURCES[collectionName] ?? [];
}

async function getLastActivity(db: Db, collectionName: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- report script lists all DB collections by name
  const coll = db.collection(collectionName as any);
  const dateFields = ['updatedAt', 'createdAt', 'modifiedAt', 'timestamp', 'expiresAt'];
  for (const field of dateFields) {
    try {
      const doc = await coll
        .find({ [field]: { $exists: true, $ne: null } })
        .sort({ [field]: -1 })
        .limit(1)
        .project({ [field]: 1 })
        .toArray();
      if (doc.length > 0 && doc[0][field]) {
        const d = doc[0][field] instanceof Date ? doc[0][field] : new Date(doc[0][field]);
        return isNaN(d.getTime()) ? null : d.toISOString();
      }
    } catch {
      // ignore
    }
  }
  try {
    const byId = await coll.find({}).sort({ _id: -1 }).limit(1).project({ _id: 1 }).toArray();
    if (byId.length > 0 && byId[0]._id && typeof byId[0]._id.getTimestamp === 'function') {
      return (byId[0]._id as ObjectId).getTimestamp().toISOString();
    }
  } catch {
    // ignore
  }
  return null;
}

async function gatherStats(db: Db): Promise<CollectionStats[]> {
  const list = await db.listCollections().toArray();
  const names = list.map((c) => c.name).filter((n): n is string => n != null);
  const results: CollectionStats[] = [];

  for (const name of names.sort()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- report script lists all DB collections by name
    const coll = db.collection(name as any);
    let count = 0;
    try {
      count = await coll.countDocuments();
    } catch {
      // skip
    }
    const lastActivity = count > 0 ? await getLastActivity(db, name) : null;
    const inCodebase = KNOWN_COLLECTION_NAMES.has(name) || name in USAGE_SOURCES;
    const usageFiles = getUsageFiles(name);

    results.push({
      name,
      count,
      lastActivity,
      inCodebase,
      usageFiles,
    });
  }

  return results;
}

function formatReport(stats: CollectionStats[], generatedAt: string): string {
  const lines: string[] = [
    '# Database collections report',
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total collections | ${stats.length} |`,
    `| Known collections (in codebase) | ${stats.filter((s) => s.inCodebase).length} |`,
    `| Orphan / unknown collections | ${stats.filter((s) => !s.inCodebase).length} |`,
    `| Total documents | ${stats.reduce((a, s) => a + s.count, 0).toLocaleString()} |`,
    '',
    '---',
    '',
    '## Collections',
    '',
    '| Collection | Count | Last activity | In codebase | Usage |',
    '|------------|-------|----------------|-------------|-------|',
  ];

  for (const s of stats) {
    const last = s.lastActivity ? new Date(s.lastActivity).toLocaleString() : '—';
    const inCode = s.inCodebase ? 'Yes' : '**No**';
    const usage = s.usageFiles.length > 0 ? s.usageFiles.slice(0, 3).join(', ') : (s.inCodebase ? 'COLLECTIONS only' : '—');
    lines.push(`| ${s.name} | ${s.count.toLocaleString()} | ${last} | ${inCode} | ${usage} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Candidate for cleanup (not referenced in codebase)');
  lines.push('');
  const orphans = stats.filter((s) => !s.inCodebase);
  if (orphans.length === 0) {
    lines.push('None. All collections are referenced in the codebase.');
  } else {
    lines.push('| Collection | Count | Last activity |');
    lines.push('|------------|-------|----------------|');
    for (const s of orphans) {
      const last = s.lastActivity ? new Date(s.lastActivity).toLocaleString() : '—';
      lines.push(`| ${s.name} | ${s.count.toLocaleString()} | ${last} |`);
    }
    lines.push('');
    lines.push('Review these before dropping. They may be used by external tools or legacy code.');
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Usage detail (known collections)');
  lines.push('');
  for (const s of stats.filter((s) => s.usageFiles.length > 0 || s.inCodebase)) {
    lines.push(`### \`${s.name}\``);
    lines.push('');
    lines.push(`- **Count:** ${s.count.toLocaleString()}`);
    if (s.lastActivity) lines.push(`- **Last activity:** ${new Date(s.lastActivity).toLocaleString()}`);
    if (s.usageFiles.length > 0) {
      lines.push('- **Referenced in:**');
      s.usageFiles.forEach((f) => lines.push(`  - \`${f}\``));
    } else if (s.inCodebase) {
      lines.push('- **Referenced in:** `lib/database.ts` (COLLECTIONS constant only)');
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const outPath = path.join(__dirname, '..', 'docs', 'db-report.md');
  console.log('Connecting to database...');
  const { db } = await connectToDatabase();
  const dbName = db.databaseName;
  console.log('Database:', dbName);
  console.log('Gathering collection stats...');
  const stats = await gatherStats(db);
  const generatedAt = new Date().toISOString();
  const report = formatReport(stats, generatedAt);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf8');
  console.log('Report written to:', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
