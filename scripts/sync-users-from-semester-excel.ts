#!/usr/bin/env ts-node
/**
 * 1) Delete all users except a fixed allowlist (by email or Hebrew name).
 * 2) Insert users from the semester Excel: שם מלא → lastName + firstName (Israeli roster order:
 *    first token = family name, remaining = given name), strip trailing ";" from email.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/sync-users-from-semester-excel.ts [path/to/file.xlsx]
 *   ... --dry-run
 */

import * as path from 'path'
import * as XLSX from 'xlsx'
import dotenv from 'dotenv'
import { connectToDatabase, COLLECTIONS } from '../lib/database'

dotenv.config({ path: path.join(__dirname, '../.env.local') })
dotenv.config({ path: path.join(__dirname, '../.env') })

const DEFAULT_EXCEL = path.join(
  __dirname,
  '../docs/רשימת סטודנטים קורס בסיסי נתונים תשפו סמסטר ב.xlsx'
)

/** Emails that must always remain (plus אור פרץ / רואי זרחיה by name below). */
const KEEP_EMAILS = new Set(
  [
    'tamaratshenkar@gmail.com',
    'edenetinger7@gmail.com',
    'itaialon12@gmail.com',
    // Instructor account used in admin allowlists (אור פרץ)
    'orperets11@gmail.com',
  ].map((e) => e.toLowerCase())
)

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function shouldKeepUser(u: { email?: string; name?: string; firstName?: string; lastName?: string }): boolean {
  const em = (u.email || '').toLowerCase().trim()
  if (KEEP_EMAILS.has(em)) return true

  const full = normalizeSpaces(u.name || `${u.firstName || ''} ${u.lastName || ''}`)
  if (full === 'אור פרץ' || full === 'פרץ אור') return true
  if (full === 'רואי זרחיה' || full === 'זרחיה רואי') return true

  const fn = normalizeSpaces(u.firstName || '')
  const ln = normalizeSpaces(u.lastName || '')
  if (fn === 'אור' && ln === 'פרץ') return true
  if (fn === 'פרץ' && ln === 'אור') return true
  if (fn === 'רואי' && ln === 'זרחיה') return true
  if (fn === 'זרחיה' && ln === 'רואי') return true

  return false
}

function normalizeEmail(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim().replace(/;+\s*$/g, '').trim()
  if (!s || !s.includes('@')) return null
  return s.toLowerCase()
}

/**
 * Roster "שם מלא" is typically משפחה פרטי (family name, then given name).
 */
function splitFullName(fullRaw: unknown): { firstName: string; lastName: string } | null {
  if (fullRaw === null || fullRaw === undefined) return null
  const full = normalizeSpaces(String(fullRaw))
  if (!full) return null
  const parts = full.split(' ')
  if (parts.length === 1) {
    return { lastName: parts[0], firstName: '' }
  }
  const lastName = parts[0]
  const firstName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

function findTz(row: Record<string, unknown>): string | undefined {
  for (const key of Object.keys(row)) {
    const k = key.trim().toLowerCase()
    if (k.includes('ת.ז') || k === 'תז' || k.includes('ת ז')) {
      const v = row[key]
      if (v === null || v === undefined || v === '') return undefined
      return String(v).replace(/\D/g, '') || String(v).trim()
    }
  }
  return undefined
}

function rowToUser(row: Record<string, unknown>): {
  email: string
  firstName: string
  lastName: string
  studentIdNumber?: string
} | null {
  let fullKey: string | undefined
  let emailKey: string | undefined
  for (const key of Object.keys(row)) {
    const nk = key.trim().toLowerCase()
    if (nk.includes('שם') && nk.includes('מלא')) fullKey = key
    if (nk.includes('דוא') || nk.includes('mail') || nk.includes('אימייל')) emailKey = key
  }
  if (!fullKey || !emailKey) return null

  const names = splitFullName(row[fullKey])
  const email = normalizeEmail(row[emailKey])
  if (!names || !email) return null

  const studentIdNumber = findTz(row)
  return {
    email,
    firstName: names.firstName,
    lastName: names.lastName,
    ...(studentIdNumber ? { studentIdNumber } : {}),
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
  const dryRun = process.argv.includes('--dry-run')
  const excelPath = args[0] ? path.resolve(args[0]) : DEFAULT_EXCEL

  console.log(`Excel: ${excelPath}`)
  console.log(dryRun ? 'DRY RUN (no DB writes)' : 'LIVE RUN')

  const workbook = XLSX.readFile(excelPath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  console.log(`Sheet "${sheetName}": ${rows.length} rows`)

  const fromExcel: ReturnType<typeof rowToUser>[] = []
  for (const row of rows) {
    const u = rowToUser(row)
    if (u) fromExcel.push(u)
  }

  const seen = new Set<string>()
  const uniqueFromExcel = fromExcel.filter((u) => {
    if (seen.has(u!.email)) return false
    seen.add(u!.email)
    return true
  })

  console.log(`Parsed ${uniqueFromExcel.length} unique users from Excel (with email + name)`)

  const { db } = await connectToDatabase()
  const coll = db.collection(COLLECTIONS.USERS)

  const all = await coll.find({}).toArray()
  const keep = all.filter((u) => shouldKeepUser(u as Record<string, unknown>))
  const keepIds = keep.map((u) => u._id)
  const removeCount = all.length - keep.length

  console.log(`Current users: ${all.length}, keep: ${keep.length}, remove: ${removeCount}`)
  keep.forEach((u) => {
    console.log(`  KEEP: ${u.email} | ${u.name || `${u.firstName} ${u.lastName}`}`)
  })

  if (dryRun) {
    const existingEmails = new Set(
      all.map((d) => String(d.email || '').toLowerCase())
    )
    const wouldInsert = uniqueFromExcel.filter((u) => u && !existingEmails.has(u.email))
    const wouldSkip = uniqueFromExcel.length - wouldInsert.length
    console.log(`Would insert (no account after delete sim): ${wouldInsert.length} (already in DB now: ${wouldSkip})`)
    console.log('Sample would-insert (first 5):')
    wouldInsert.slice(0, 5).forEach((u) => console.log(`  ${u!.email} | ${u!.firstName} ${u!.lastName}`))
    console.log(
      'Note: after delete, more rows may insert if their email belonged only to removed users.'
    )
    return
  }

  if (removeCount > 0) {
    const del = await coll.deleteMany({ _id: { $nin: keepIds } })
    console.log(`Deleted ${del.deletedCount} users`)
  } else {
    console.log('No users to delete')
  }

  let inserted = 0
  let skippedStillThere = 0
  for (const u of uniqueFromExcel) {
    if (!u) continue
    const dup = await coll.findOne({ email: u.email })
    if (dup) {
      skippedStillThere++
      continue
    }

    const doc = {
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      name: normalizeSpaces(`${u.firstName} ${u.lastName}`),
      password: 'shenkar',
      isFirst: true,
      ...(u.studentIdNumber ? { studentIdNumber: u.studentIdNumber } : {}),
    }
    await coll.insertOne(doc as any)
    inserted++
  }
  console.log(`Skipped (email still present): ${skippedStillThere}`)

  console.log(`Inserted ${inserted} users`)
  const finalCount = await coll.countDocuments()
  console.log(`Total users in collection: ${finalCount}`)
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
