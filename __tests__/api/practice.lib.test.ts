import { getPracticeTables, getPracticeQueries, submitPracticeAnswer } from '@/lib/practice'

describe('Practice lib', () => {
  it('exports functions', () => {
    expect(typeof getPracticeTables).toBe('function')
    expect(typeof getPracticeQueries).toBe('function')
    expect(typeof submitPracticeAnswer).toBe('function')
  })
})


