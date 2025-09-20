import { getChatSessions, createChatSession, getChatMessages, saveChatMessage } from '@/lib/chat'

describe('Chat lib', () => {
  it('exports functions', () => {
    expect(typeof getChatSessions).toBe('function')
    expect(typeof createChatSession).toBe('function')
    expect(typeof getChatMessages).toBe('function')
    expect(typeof saveChatMessage).toBe('function')
  })
})


