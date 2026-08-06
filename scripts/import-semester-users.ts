#!/usr/bin/env ts-node

import path from "path";

import dotenv from "dotenv";
import ExcelJS from "exceljs";

dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });

interface RosterUser {
  email: string;
  firstName: string;
  lastName: string;
  studentIdNumber: string;
}

const NAME_OVERRIDES = new Map<string, Pick<RosterUser, "firstName" | "lastName">>([
  ["חן סיבוני מאיה", { firstName: "מאיה", lastName: "חן סיבוני" }],
]);

function getNumericArg(name: string): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  const value = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`A positive --${name}=... argument is required.`);
  }
  return value;
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractFirstEmail(value: string): string | null {
  const candidates = value
    .split(/[;,\n]+/)
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean);

  return candidates.find((candidate) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate)) ?? null;
}

function splitRosterName(rawValue: string): Pick<RosterUser, "firstName" | "lastName"> | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const normalized = normalizeSpaces(trimmed);
  const override = NAME_OVERRIDES.get(normalized);
  if (override) return override;

  const explicitBoundary = trimmed.match(/^(.+?)\s{2,}(.+)$/);
  if (explicitBoundary) {
    return {
      lastName: normalizeSpaces(explicitBoundary[1]),
      firstName: normalizeSpaces(explicitBoundary[2]),
    };
  }

  const parts = normalized.split(" ");
  if (parts.length < 2) return null;
  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(" "),
  };
}

async function readRoster(filePath: string): Promise<RosterUser[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("The workbook does not contain a worksheet.");

  const users: RosterUser[] = [];
  const errors: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const names = splitRosterName(row.getCell(1).text);
    const studentIdNumber = row.getCell(2).text.replace(/\D/g, "").padStart(9, "0");
    const email = extractFirstEmail(row.getCell(7).text);

    if (!names || !email || !/^\d{9}$/.test(studentIdNumber)) {
      errors.push(`row ${rowNumber}`);
      return;
    }

    users.push({ email, ...names, studentIdNumber });
  });

  const duplicateEmails = users.filter((user, index) => users.findIndex((item) => item.email === user.email) !== index);
  const duplicateIds = users.filter(
    (user, index) => users.findIndex((item) => item.studentIdNumber === user.studentIdNumber) !== index,
  );

  if (errors.length || duplicateEmails.length || duplicateIds.length) {
    throw new Error(
      `Roster validation failed: invalid rows=${errors.join(",") || "none"}, `
      + `duplicate emails=${duplicateEmails.length}, duplicate IDs=${duplicateIds.length}.`,
    );
  }

  return users;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const fileArg = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  if (!fileArg) {
    throw new Error("Usage: import-semester-users.ts <roster.xlsx> --year=2026 --semester=3 [--apply]");
  }

  const year = getNumericArg("year");
  const semester = getNumericArg("semester");
  const roster = await readRoster(path.resolve(fileArg));
  const { COLLECTIONS, connectToDatabase } = await import("../lib/database");
  const { client, db } = await connectToDatabase();

  try {
    const emails = roster.map((user) => user.email);
    const studentIds = roster.map((user) => user.studentIdNumber);
    const collection = db.collection(COLLECTIONS.USERS);
    const existing = await collection.find({
      $or: [
        { email: { $in: emails } },
        { studentIdNumber: { $in: studentIds } },
        { id: { $in: studentIds } },
      ],
    }).toArray();

    const byEmail = new Map(existing.map((user) => [String(user.email ?? "").trim().toLowerCase(), user]));
    const byStudentId = new Map<string, (typeof existing)[number]>();
    existing.forEach((user) => {
      if (user.studentIdNumber) byStudentId.set(String(user.studentIdNumber), user);
      if (user.id) byStudentId.set(String(user.id), user);
    });

    const identityConflicts = roster.filter((user) => {
      const emailMatch = byEmail.get(user.email);
      const idMatch = byStudentId.get(user.studentIdNumber);
      return emailMatch && idMatch && String(emailMatch._id) !== String(idMatch._id);
    });
    if (identityConflicts.length) {
      throw new Error(`Import stopped: ${identityConflicts.length} roster rows match conflicting DB accounts.`);
    }

    const existingMatches = roster.filter(
      (user) => byEmail.has(user.email) || byStudentId.has(user.studentIdNumber),
    );
    const alreadyInTarget = existingMatches.filter((user) => {
      const match = byEmail.get(user.email) ?? byStudentId.get(user.studentIdNumber);
      return Number(match?.year) === year && Number(match?.semester) === semester;
    });

    console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
    console.log(`Target period: ${year}/${semester}`);
    console.log(`Validated roster users: ${roster.length}`);
    console.log(`New accounts: ${roster.length - existingMatches.length}`);
    console.log(`Existing accounts moving to target period: ${existingMatches.length - alreadyInTarget.length}`);
    console.log(`Existing accounts already in target period: ${alreadyInTarget.length}`);

    if (!apply) {
      console.log("No writes performed. Re-run with --apply to import the roster.");
      return;
    }

    const operations = roster.map((user) => {
      const existingUser = byEmail.get(user.email) ?? byStudentId.get(user.studentIdNumber);
      return {
        updateOne: {
          filter: existingUser ? { _id: existingUser._id } : { email: user.email },
          update: {
            $set: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              name: `${user.firstName} ${user.lastName}`,
              studentIdNumber: user.studentIdNumber,
              year,
              semester,
            },
            $setOnInsert: {
              password: "shenkar",
              isFirst: true,
            },
          },
          upsert: true,
        },
      };
    });

    const result = await collection.bulkWrite(operations);
    const verified = await collection.countDocuments({
      email: { $in: emails },
      year,
      semester,
    });

    console.log(`Matched existing accounts: ${result.matchedCount}`);
    console.log(`Modified existing accounts: ${result.modifiedCount}`);
    console.log(`Inserted new accounts: ${result.upsertedCount}`);
    console.log(`Verified roster accounts in ${year}/${semester}: ${verified}/${roster.length}`);

    if (verified !== roster.length) {
      throw new Error(`Post-import verification failed: expected ${roster.length}, found ${verified}.`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Semester user import failed:", error);
  process.exit(1);
});
