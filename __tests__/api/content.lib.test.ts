import { getWeeklyContent, setWeeklyContent, getCurrentWeekContent, setSemesterStartDate, getSemesterStartDate } from '@/lib/content'

describe('Content lib', () => {
  it('exports functions', () => {
    expect(typeof getWeeklyContent).toBe('function')
    expect(typeof setWeeklyContent).toBe('function')
    expect(typeof getCurrentWeekContent).toBe('function')
    expect(typeof setSemesterStartDate).toBe('function')
    expect(typeof getSemesterStartDate).toBe('function')
  })
})


