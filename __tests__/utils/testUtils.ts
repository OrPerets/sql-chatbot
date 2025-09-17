import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { jest } from '@jest/globals'

/**
 * Test utilities for React components and API testing
 */

// Mock providers wrapper
interface AllProvidersProps {
  children: React.ReactNode
}

const AllProviders = ({ children }: AllProvidersProps) => {
  // Add your providers here (Router, Theme, etc.)
  return children as ReactElement
}

// Custom render function with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

/**
 * Mock fetch with custom responses
 */
export const mockFetch = (responses: { [url: string]: any }) => {
  const mockFn = jest.fn()
  
  Object.entries(responses).forEach(([url, response]) => {
    mockFn.mockImplementationOnce((requestUrl: string) => {
      if (requestUrl.includes(url)) {
        return Promise.resolve({
          ok: response.ok !== false,
          status: response.status || 200,
          json: async () => response.data || response,
          text: async () => JSON.stringify(response.data || response),
        })
      }
    })
  })
  
  global.fetch = mockFn as any
  return mockFn
}

/**
 * Mock OpenAI responses
 */
export const mockOpenAI = {
  createAssistant: (response: any) => ({
    beta: {
      assistants: {
        create: jest.fn().mockResolvedValue(response)
      }
    }
  }),
  
  createThread: (response: any) => ({
    beta: {
      threads: {
        create: jest.fn().mockResolvedValue(response)
      }
    }
  }),
  
  createMessage: (response: any) => ({
    beta: {
      threads: {
        messages: {
          create: jest.fn().mockResolvedValue(response),
          list: jest.fn().mockResolvedValue({
            data: Array.isArray(response) ? response : [response]
          })
        }
      }
    }
  }),
  
  createRun: (response: any) => ({
    beta: {
      threads: {
        runs: {
          create: jest.fn().mockResolvedValue(response),
          retrieve: jest.fn().mockResolvedValue(response)
        }
      }
    }
  })
}

/**
 * Wait for element to appear/disappear
 */
export const waitForElement = async (
  getElement: () => HTMLElement | null,
  timeout = 5000
): Promise<HTMLElement> => {
  const start = Date.now()
  
  while (Date.now() - start < timeout) {
    const element = getElement()
    if (element) {
      return element
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  throw new Error(`Element not found within ${timeout}ms`)
}

/**
 * Mock Next.js router with custom values
 */
export const mockRouter = (overrides: Partial<any> = {}) => {
  const router = {
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    pop: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    isFallback: false,
    ...overrides
  }
  
  require('next/router').__setMockRouter(router)
  return router
}

/**
 * Create mock component props
 */
export const createMockProps = <T extends object>(overrides: Partial<T> = {}): T => {
  const defaultProps = {
    // Add common default props here
  }
  
  return { ...defaultProps, ...overrides } as T
}

/**
 * Mock localStorage
 */
export const mockLocalStorage = () => {
  const store: { [key: string]: string } = {}
  
  const mockStorage = {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length
    }
  }
  
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true
  })
  
  return mockStorage
}

/**
 * Mock sessionStorage
 */
export const mockSessionStorage = () => {
  const store: { [key: string]: string } = {}
  
  const mockStorage = {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length
    }
  }
  
  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: true
  })
  
  return mockStorage
}

/**
 * Mock file for upload testing
 */
export const createMockFile = (
  name = 'test.txt',
  content = 'test content',
  type = 'text/plain'
) => {
  const file = new File([content], name, { type })
  return file
}

/**
 * Test data generators
 */
export const testData = {
  user: {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'student'
  },
  
  assistant: {
    id: 'asst_test123',
    object: 'assistant',
    created_at: Date.now(),
    name: 'Test Assistant',
    description: 'A test assistant',
    model: 'gpt-4',
    instructions: 'You are a helpful assistant.',
    tools: [],
    file_ids: [],
    metadata: {}
  },
  
  thread: {
    id: 'thread_test123',
    object: 'thread',
    created_at: Date.now(),
    metadata: {}
  },
  
  message: {
    id: 'msg_test123',
    object: 'thread.message',
    created_at: Date.now(),
    thread_id: 'thread_test123',
    role: 'user',
    content: [
      {
        type: 'text',
        text: {
          value: 'Test message',
          annotations: []
        }
      }
    ]
  }
}

/**
 * Assert that an element has specific CSS properties
 */
export const expectElementToHaveStyles = (
  element: HTMLElement,
  styles: { [property: string]: string }
) => {
  const computedStyles = window.getComputedStyle(element)
  
  Object.entries(styles).forEach(([property, expectedValue]) => {
    expect(computedStyles.getPropertyValue(property)).toBe(expectedValue)
  })
}

// Add a test to prevent "no tests" error
describe('Test Utils', () => {
  it('should export utility functions', () => {
    expect(typeof mockFetch).toBe('function')
    expect(typeof mockLocalStorage).toBe('function')
    expect(typeof testData).toBe('object')
  })
})
