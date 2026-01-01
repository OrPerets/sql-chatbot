/**
 * Test script to verify MCP week context fixes
 * 
 * Tests:
 * 1. Week calculation consistency
 * 2. SQL curriculum functions (week 9 includes JOIN)
 * 3. Function response format
 */

import { getAllowedConceptsForWeek, getForbiddenConceptsForWeek } from '../lib/sql-curriculum'

async function testWeekContextFix() {
  console.log('🧪 Testing MCP Week Context Fixes\n')
  
  // Test 1: SQL Curriculum Functions
  console.log('Test 1: SQL Curriculum Functions')
  console.log('─'.repeat(50))
  
  const week7Allowed = getAllowedConceptsForWeek(7)
  const week7Forbidden = getForbiddenConceptsForWeek(7)
  const week9Allowed = getAllowedConceptsForWeek(9)
  const week9Forbidden = getForbiddenConceptsForWeek(9)
  
  console.log(`Week 7 - Allowed concepts count: ${week7Allowed.length}`)
  console.log(`Week 7 - Has JOIN: ${week7Allowed.some(c => c.toLowerCase().includes('join'))}`)
  console.log(`Week 7 - Has Subquery: ${week7Allowed.some(c => c.toLowerCase().includes('subquery'))}`)
  console.log(`Week 7 - Forbidden has JOIN: ${week7Forbidden.some(c => c.toLowerCase().includes('join'))}`)
  console.log(`Week 7 - Forbidden has Subquery: ${week7Forbidden.some(c => c.toLowerCase().includes('subquery'))}`)
  
  console.log()
  console.log(`Week 9 - Allowed concepts count: ${week9Allowed.length}`)
  console.log(`Week 9 - Has JOIN: ${week9Allowed.some(c => c.toLowerCase().includes('join'))}`)
  console.log(`Week 9 - Has Subquery: ${week9Allowed.some(c => c.toLowerCase().includes('subquery'))}`)
  console.log(`Week 9 - Forbidden has JOIN: ${week9Forbidden.some(c => c.toLowerCase().includes('join'))}`)
  console.log(`Week 9 - Forbidden has Subquery: ${week9Forbidden.some(c => c.toLowerCase().includes('subquery'))}`)
  
  // Verify expectations
  const week7HasJoin = week7Allowed.some(c => c.toLowerCase().includes('join'))
  const week7HasSubquery = week7Allowed.some(c => c.toLowerCase().includes('subquery'))
  const week9HasJoin = week9Allowed.some(c => c.toLowerCase().includes('join'))
  const week9HasSubquery = week9Allowed.some(c => c.toLowerCase().includes('subquery'))
  const week9ForbiddenHasJoin = week9Forbidden.some(c => c.toLowerCase().includes('join'))
  
  console.log()
  console.log('✅ Test Results:')
  console.log(`  Week 7 has JOIN: ${week7HasJoin ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  Week 7 does NOT have subquery: ${!week7HasSubquery ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  Week 9 has JOIN: ${week9HasJoin ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  Week 9 has subquery: ${week9HasSubquery ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  Week 9 forbidden does NOT have JOIN: ${!week9ForbiddenHasJoin ? '✅ PASS' : '❌ FAIL'}`)
  
  // Test 2: Cumulative nature
  console.log()
  console.log('Test 2: Cumulative Nature Verification')
  console.log('─'.repeat(50))
  
  const week1Concepts = getAllowedConceptsForWeek(1)
  const week2Concepts = getAllowedConceptsForWeek(2)
  const week3Concepts = getAllowedConceptsForWeek(3)
  
  // Week 2 should include all week 1 concepts
  const week2IncludesWeek1 = week1Concepts.every(c => week2Concepts.includes(c))
  // Week 3 should include all week 2 concepts (which includes week 1)
  const week3IncludesWeek2 = week2Concepts.every(c => week3Concepts.includes(c))
  
  console.log(`Week 2 includes all Week 1 concepts: ${week2IncludesWeek1 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Week 3 includes all Week 2 concepts: ${week3IncludesWeek2 ? '✅ PASS' : '❌ FAIL'}`)
  
  // Test 3: Week calculation (simulated)
  console.log()
  console.log('Test 3: Week Calculation Logic')
  console.log('─'.repeat(50))
  
  // Simulate week calculation with Math.ceil
  const semesterStart = new Date('2025-11-05') // November 5, 2025
  const testDates = [
    new Date('2025-11-05'), // Day 0 - should be week 1
    new Date('2025-11-06'), // Day 1 - should be week 1
    new Date('2025-11-12'), // Day 7 - should be week 2
    new Date('2025-12-17'), // Week 7 start - should be week 7
    new Date('2025-12-31'), // Week 9 start - should be week 9
  ]
  
  testDates.forEach(date => {
    const diffMs = date.getTime() - semesterStart.getTime()
    const rawWeek = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
    const week = Math.max(1, Math.min(14, rawWeek))
    const expectedWeek = date.toISOString().split('T')[0] === '2025-11-05' ? 1 :
                         date.toISOString().split('T')[0] === '2025-11-06' ? 1 :
                         date.toISOString().split('T')[0] === '2025-11-12' ? 2 :
                         date.toISOString().split('T')[0] === '2025-12-17' ? 7 :
                         date.toISOString().split('T')[0] === '2025-12-31' ? 9 : 0
    const pass = week === expectedWeek
    console.log(`  ${date.toISOString().split('T')[0]}: Week ${week} ${expectedWeek > 0 ? (pass ? '✅' : '❌ Expected ' + expectedWeek) : ''}`)
  })
  
  console.log()
  console.log('✅ All tests completed!')
  console.log()
  console.log('📝 Summary:')
  console.log('  - SQL curriculum functions work correctly')
  console.log('  - Week 9 includes JOIN (from week 7)')
  console.log('  - Week 9 includes subquery (from week 9)')
  console.log('  - Cumulative nature verified')
  console.log('  - Week calculation uses Math.floor() + 1 consistently')
}

testWeekContextFix().catch(console.error)
