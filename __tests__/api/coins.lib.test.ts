import { updateCoinsBalance, getAllCoins, getCoinsStatus, setCoinsStatus } from '@/lib/coins'

describe('Coins lib', () => {
  it('exports functions', () => {
    expect(typeof updateCoinsBalance).toBe('function')
    expect(typeof getAllCoins).toBe('function')
    expect(typeof getCoinsStatus).toBe('function')
    expect(typeof setCoinsStatus).toBe('function')
  })
})


