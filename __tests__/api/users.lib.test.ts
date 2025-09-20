import { getAllUsers, updatePassword, getCoinsBalance, setCoinsBalance } from '@/lib/users'

describe('Users lib', () => {
  it('exports functions', () => {
    expect(typeof getAllUsers).toBe('function')
    expect(typeof updatePassword).toBe('function')
    expect(typeof getCoinsBalance).toBe('function')
    expect(typeof setCoinsBalance).toBe('function')
  })
})


