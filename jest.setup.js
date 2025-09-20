import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
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
    }
  },
}))

// Mock Next.js navigation (App Router)
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    beta: {
      assistants: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      threads: {
        create: jest.fn(),
        messages: {
          create: jest.fn(),
          list: jest.fn(),
        },
        runs: {
          create: jest.fn(),
          retrieve: jest.fn(),
        },
      },
    },
  })),
}))

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-api-key'
process.env.ASSISTANT_ID = 'test-assistant-id'

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

// Mock Blob for Node.js environment
global.Blob = class MockBlob {
  constructor(data, options = {}) {
    this.data = data;
    this.type = options.type || 'application/octet-stream';
    this.size = data.reduce((total, item) => total + (typeof item === 'string' ? item.length : item.length || 0), 0);
  }
  
  slice() {
    return new MockBlob(this.data, { type: this.type });
  }
  
  stream() {
    return new ReadableStream();
  }
  
  text() {
    return Promise.resolve(this.data.join(''));
  }
  
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(this.size));
  }
};

// Mock window.matchMedia (only in browser environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock navigator.userAgent to be writable
Object.defineProperty(navigator, 'userAgent', {
  writable: true,
  value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
});

// Mock HTMLMediaElement.prototype for JSDOM (only if HTMLMediaElement exists)
if (typeof HTMLMediaElement !== 'undefined') {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    writable: true,
    value: jest.fn().mockImplementation(() => {
      return Promise.resolve();
    })
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    writable: true,
    value: jest.fn()
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    writable: true,
    value: jest.fn()
  });
}
