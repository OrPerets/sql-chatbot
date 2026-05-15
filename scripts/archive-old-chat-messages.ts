#!/usr/bin/env ts-node
/**
 * Archive old chatMessages documents to a compressed JSONL file, then optionally
 * delete exactly the archived documents from MongoDB.
 *
 * Dry run:
 *   npx ts-node --project tsconfig.scripts.json scripts/archive-old-chat-messages.ts
 *
 * Archive only:
 *   npx ts-node --project tsconfig.scripts.json scripts/archive-old-chat-messages.ts --archive
 *
 * Archive and delete exactly the archived documents:
 *   npx ts-node --project tsconfig.scripts.json scripts/archive-old-chat-messages.ts --archive --execute-delete
 *
 * Delete from a previously-created archive:
 *   npx ts-node --project tsconfig.scripts.json scripts/archive-old-chat-messages.ts --delete-from-archive=exports/chatMessages-archive/file.jsonl.gz --execute-delete
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as zlib from 'zlib';
import { ObjectId } from 'mongodb';
import { COLLECTIONS, connectToDatabase } from '../lib/database';

interface ArchiveOptions {
  archive: boolean;
  executeDelete: boolean;
  monthsToKeep: number;
  cutoff?: Date;
  deleteFromArchive?: string;
  outputDir: string;
  batchSize: number;
}

interface ArchiveManifest {
  collection: string;
  createdAt: string;
  mode: 'dry-run' | 'archive-only' | 'archive-and-delete';
  cutoff: string;
  monthsToKeep: number;
  query: Record<string, unknown>;
  countsBefore: {
    olderThanCutoff: number;
    keptByTimestamp: number;
    missingTimestamp: number;
    total: number;
  };
  archive?: {
    file: string;
    documents: number;
    gzipBytes: number;
    sha256UncompressedJsonl: string;
    firstTimestamp: string | null;
    lastTimestamp: string | null;
  };
  deletion?: {
    requested: boolean;
    deletedDocuments: number;
    olderThanCutoffRemainingAfterDelete: number;
  };
}

function parseArgs(argv: string[]): ArchiveOptions {
  const options: ArchiveOptions = {
    archive: false,
    executeDelete: false,
    monthsToKeep: 5,
    outputDir: path.resolve(process.cwd(), 'exports', 'chatMessages-archive'),
    batchSize: 1000,
  };

  for (const arg of argv) {
    if (arg === '--archive') {
      options.archive = true;
    } else if (arg === '--execute-delete') {
      options.executeDelete = true;
    } else if (arg.startsWith('--months=')) {
      options.monthsToKeep = Number(arg.slice('--months='.length));
    } else if (arg.startsWith('--cutoff=')) {
      options.cutoff = new Date(arg.slice('--cutoff='.length));
    } else if (arg.startsWith('--delete-from-archive=')) {
      options.deleteFromArchive = path.resolve(process.cwd(), arg.slice('--delete-from-archive='.length));
    } else if (arg.startsWith('--outDir=')) {
      options.outputDir = path.resolve(process.cwd(), arg.slice('--outDir='.length));
    } else if (arg.startsWith('--batchSize=')) {
      options.batchSize = Number(arg.slice('--batchSize='.length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.monthsToKeep) || options.monthsToKeep <= 0) {
    throw new Error('--months must be a positive number');
  }
  if (options.cutoff && Number.isNaN(options.cutoff.getTime())) {
    throw new Error('--cutoff must be a valid date, for example --cutoff=2025-12-11T00:00:00.000Z');
  }
  if (!Number.isInteger(options.batchSize) || options.batchSize <= 0) {
    throw new Error('--batchSize must be a positive integer');
  }
  if (options.executeDelete && !options.archive) {
    if (!options.deleteFromArchive) {
      throw new Error('--execute-delete requires --archive or --delete-from-archive');
    }
  }
  if (options.deleteFromArchive && options.archive) {
    throw new Error('Use either --archive or --delete-from-archive, not both');
  }
  if (options.deleteFromArchive && !options.executeDelete) {
    throw new Error('--delete-from-archive requires --execute-delete');
  }

  return options;
}

function defaultCutoff(monthsToKeep: number): Date {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsToKeep);
  return cutoff;
}

function timestampForFilename(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function serializeForArchive(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return { $date: value.toISOString() };
  if (value instanceof ObjectId) return { $oid: value.toHexString() };
  if (Array.isArray(value)) return value.map(serializeForArchive);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = serializeForArchive(nested);
    }
    return out;
  }
  return value;
}

function asIsoTimestamp(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

async function writeGzipJsonl(
  filePath: string,
  documents: AsyncIterable<Record<string, unknown>>,
): Promise<{
  count: number;
  sha256UncompressedJsonl: string;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  archivedIds: ObjectId[];
}> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

  const gzip = zlib.createGzip({ level: 9 });
  const output = fs.createWriteStream(filePath, { flags: 'wx' });
  const hash = crypto.createHash('sha256');
  const archivedIds: ObjectId[] = [];
  let count = 0;
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  const done = new Promise<void>((resolve, reject) => {
    output.on('finish', resolve);
    output.on('error', reject);
    gzip.on('error', reject);
  });
  gzip.pipe(output);

  try {
    for await (const doc of documents) {
      if (doc._id instanceof ObjectId) {
        archivedIds.push(doc._id);
      } else {
        throw new Error('Refusing to archive/delete a document without an ObjectId _id');
      }

      const timestamp = asIsoTimestamp(doc.timestamp);
      if (timestamp && firstTimestamp == null) firstTimestamp = timestamp;
      if (timestamp) lastTimestamp = timestamp;

      const line = `${JSON.stringify(serializeForArchive(doc))}\n`;
      hash.update(line);
      if (!gzip.write(line, 'utf8')) {
        await new Promise<void>((resolve) => gzip.once('drain', resolve));
      }
      count += 1;
    }
  } catch (error) {
    gzip.destroy();
    output.destroy();
    throw error;
  }

  gzip.end();
  await done;

  return {
    count,
    sha256UncompressedJsonl: hash.digest('hex'),
    firstTimestamp,
    lastTimestamp,
    archivedIds,
  };
}

async function deleteByIdBatches(
  collection: ReturnType<Awaited<ReturnType<typeof connectToDatabase>>['db']['collection']>,
  ids: ObjectId[],
  batchSize: number,
): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const result = await collection.deleteMany({ _id: { $in: batch } });
    deleted += result.deletedCount ?? 0;
    console.log(`Deleted ${deleted}/${ids.length} archived documents...`);
  }
  return deleted;
}

async function readIdsFromArchive(archiveFile: string): Promise<ObjectId[]> {
  const ids: ObjectId[] = [];
  const input = fs.createReadStream(archiveFile);
  const gunzip = zlib.createGunzip();
  const lines = readline.createInterface({
    input: input.pipe(gunzip),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.trim()) continue;
    const doc = JSON.parse(line);
    const oid = doc?._id?.$oid;
    if (typeof oid !== 'string' || !ObjectId.isValid(oid)) {
      throw new Error(`Archive contains a document without a valid _id.$oid: ${line.slice(0, 200)}`);
    }
    ids.push(new ObjectId(oid));
  }

  return ids;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cutoff = options.cutoff ?? defaultCutoff(options.monthsToKeep);
  const query = { timestamp: { $lt: cutoff } };
  const mode: ArchiveManifest['mode'] = options.executeDelete
    ? 'archive-and-delete'
    : options.archive
      ? 'archive-only'
      : 'dry-run';

  console.log(`Connecting to MongoDB...`);
  const { db, client } = await connectToDatabase();
  const collection = db.collection(COLLECTIONS.CHAT_MESSAGES);

  if (options.deleteFromArchive) {
    console.log(`Reading archived document IDs from ${options.deleteFromArchive}...`);
    const ids = await readIdsFromArchive(options.deleteFromArchive);
    console.log(`Archive contains ${ids.length} document IDs.`);

    const deletedDocuments = await deleteByIdBatches(collection, ids, options.batchSize);
    const deletionManifest = {
      collection: COLLECTIONS.CHAT_MESSAGES,
      createdAt: new Date().toISOString(),
      sourceArchive: options.deleteFromArchive,
      requestedDocumentIds: ids.length,
      deletedDocuments,
    };
    const deletionManifestFile = `${options.deleteFromArchive}.delete-manifest-${timestampForFilename(new Date())}.json`;
    await fs.promises.writeFile(deletionManifestFile, `${JSON.stringify(deletionManifest, null, 2)}\n`, 'utf8');
    console.log(`Deleted ${deletedDocuments} archived documents.`);
    console.log(`Deletion manifest written to ${deletionManifestFile}`);

    await client.close();
    return;
  }

  const [olderThanCutoff, keptByTimestamp, missingTimestamp, total] = await Promise.all([
    collection.countDocuments(query),
    collection.countDocuments({ timestamp: { $gte: cutoff } }),
    collection.countDocuments({ $or: [{ timestamp: { $exists: false } }, { timestamp: null }] }),
    collection.countDocuments({}),
  ]);

  const manifest: ArchiveManifest = {
    collection: COLLECTIONS.CHAT_MESSAGES,
    createdAt: new Date().toISOString(),
    mode,
    cutoff: cutoff.toISOString(),
    monthsToKeep: options.monthsToKeep,
    query: { timestamp: { $lt: cutoff.toISOString() } },
    countsBefore: {
      olderThanCutoff,
      keptByTimestamp,
      missingTimestamp,
      total,
    },
  };

  console.log(`Mode: ${mode}`);
  console.log(`Cutoff: ${cutoff.toISOString()} (keeping last ${options.monthsToKeep} months)`);
  console.log(`Total chatMessages: ${total}`);
  console.log(`Older than cutoff: ${olderThanCutoff}`);
  console.log(`Kept by timestamp: ${keptByTimestamp}`);
  console.log(`Missing timestamp (left untouched): ${missingTimestamp}`);

  if (!options.archive) {
    console.log('Dry run only. Re-run with --archive to write a compressed file.');
    await client.close();
    return;
  }

  const archiveFile = path.join(
    options.outputDir,
    `chatMessages-before-${timestampForFilename(cutoff)}.jsonl.gz`,
  );
  const manifestFile = `${archiveFile}.manifest.json`;

  console.log(`Archiving to ${archiveFile}...`);
  const cursor = collection
    .find(query)
    .batchSize(options.batchSize);
  const archiveResult = await writeGzipJsonl(archiveFile, cursor as AsyncIterable<Record<string, unknown>>);
  const gzipBytes = (await fs.promises.stat(archiveFile)).size;

  if (archiveResult.count !== olderThanCutoff) {
    throw new Error(
      `Archive count mismatch: expected ${olderThanCutoff}, wrote ${archiveResult.count}. No deletion attempted.`,
    );
  }

  manifest.archive = {
    file: archiveFile,
    documents: archiveResult.count,
    gzipBytes,
    sha256UncompressedJsonl: archiveResult.sha256UncompressedJsonl,
    firstTimestamp: archiveResult.firstTimestamp,
    lastTimestamp: archiveResult.lastTimestamp,
  };

  console.log(`Archived ${archiveResult.count} documents (${gzipBytes} compressed bytes).`);

  if (options.executeDelete) {
    console.log('Deleting exactly the archived document IDs...');
    const deletedDocuments = await deleteByIdBatches(collection, archiveResult.archivedIds, options.batchSize);
    const olderThanCutoffRemainingAfterDelete = await collection.countDocuments(query);
    manifest.deletion = {
      requested: true,
      deletedDocuments,
      olderThanCutoffRemainingAfterDelete,
    };
    console.log(`Deleted ${deletedDocuments} documents.`);
    console.log(`Older-than-cutoff documents remaining: ${olderThanCutoffRemainingAfterDelete}`);
  } else {
    manifest.deletion = {
      requested: false,
      deletedDocuments: 0,
      olderThanCutoffRemainingAfterDelete: olderThanCutoff,
    };
    console.log('Archive complete. No documents were deleted because --execute-delete was not provided.');
  }

  await fs.promises.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Manifest written to ${manifestFile}`);
  await client.close();
}

main().catch((error) => {
  console.error('Archive failed:', error);
  process.exit(1);
});
