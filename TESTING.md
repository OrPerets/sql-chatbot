# Testing Guide - Frontend (Next.js + React)

This guide covers the comprehensive testing setup for the SQL Chatbot frontend application.

## 🧪 Testing Stack

- **Jest** - Testing framework
- **React Testing Library** - Component testing
- **Playwright** - End-to-end testing
- **MSW** - API mocking
- **GitHub Actions** - CI/CD pipeline

## 📁 Test Structure

```
__tests__/
├── components/              # Component tests
│   ├── LoginPage.test.tsx
│   ├── ChatInterface.test.tsx
│   └── SqlEditor.test.tsx
├── api/                     # API route tests
│   ├── assistants.test.ts
│   └── auth.test.ts
├── pages/                   # Page tests
│   ├── index.test.tsx
│   └── admin.test.tsx
└── utils/
    └── testUtils.ts         # Test utilities

tests/e2e/                   # E2E tests
├── login.spec.ts
├── assistant-interaction.spec.ts
└── sql-queries.spec.ts

jest.config.js               # Jest configuration
jest.setup.js               # Global test setup
playwright.config.ts        # Playwright configuration
```

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run component tests only
npm run test:component

# Run API tests only
npm run test:api

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

### 3. Environment Setup

Create a `.env.test` file:

```env
NODE_ENV=test
NEXT_PUBLIC_APP_ENV=test
OPENAI_API_KEY=test-openai-key
ASSISTANT_ID=test-assistant-id
DISABLE_EXTERNAL_APIS=true
MOCK_OPENAI=true
NEXT_PUBLIC_API_URL=http://localhost:5555
```

## 📝 Writing Tests

### Component Tests

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../app/LoginPage'

describe('LoginPage', () => {
  test('renders login form correctly', () => {
    render(<LoginPage />)
    
    expect(screen.getByText(/login/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument()
  })

  test('submits form with valid credentials', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /login/i }))
    
    // Assert expected behavior
  })
})
```

### API Route Tests

```typescript
import { NextRequest } from 'next/server'
import { POST } from '../app/api/assistants/route'

describe('/api/assistants', () => {
  test('creates a new assistant successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/assistants', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Assistant',
        instructions: 'You are helpful.',
        model: 'gpt-4'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('id')
  })
})
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test('should handle login form submission', async ({ page }) => {
    await page.goto('/')
    
    await page.getByRole('textbox', { name: /email/i }).fill('test@example.com')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /login/i }).click()

    await expect(page).toHaveURL(/dashboard/)
  })
})
```

## 🔧 Test Utilities

### Custom Render Function

```typescript
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

const AllProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const customRender = (ui: ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: AllProviders, ...options })

export { customRender as render }
```

### Mock Utilities

```typescript
// Mock fetch responses
export const mockFetch = (responses: { [url: string]: any }) => {
  const mockFn = jest.fn()
  // Implementation...
  global.fetch = mockFn as any
  return mockFn
}

// Mock OpenAI
export const mockOpenAI = {
  createAssistant: (response: any) => ({
    beta: {
      assistants: {
        create: jest.fn().mockResolvedValue(response)
      }
    }
  })
}
```

## 🎯 Testing Best Practices

### 1. Test User Interactions, Not Implementation

```tsx
// Good ✅ - Tests what user sees and does
test('shows error when login fails', async () => {
  render(<LoginPage />)
  
  await userEvent.click(screen.getByRole('button', { name: /login/i }))
  
  expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
})

// Bad ❌ - Tests implementation details
test('calls setError with correct message', () => {
  const setError = jest.fn()
  // ...
})
```

### 2. Use Semantic Queries

```tsx
// Good ✅
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/password/i)
screen.getByText(/welcome/i)

// Bad ❌
screen.getByClassName('submit-btn')
screen.getByTestId('password-input')
```

### 3. Mock External Dependencies

```typescript
// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
    query: {}
  })
}))

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => mockOpenAI)
}))
```

### 4. Test Accessibility

```tsx
test('has proper accessibility attributes', () => {
  render(<LoginForm />)
  
  const emailInput = screen.getByRole('textbox', { name: /email/i })
  expect(emailInput).toHaveAttribute('aria-required', 'true')
  
  const form = screen.getByRole('form')
  expect(form).toHaveAttribute('aria-label', 'Login form')
})
```

## 🎭 E2E Testing with Playwright

### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
})
```

### Page Object Model

```typescript
// tests/e2e/pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/')
  }

  async login(email: string, password: string) {
    await this.page.getByRole('textbox', { name: /email/i }).fill(email)
    await this.page.getByLabel(/password/i).fill(password)
    await this.page.getByRole('button', { name: /login/i }).click()
  }

  async expectErrorMessage(message: string) {
    await expect(this.page.getByText(message)).toBeVisible()
  }
}
```

## 🚀 CI/CD Integration

### GitHub Actions Workflow

The workflow includes:

1. **Linting** - ESLint and TypeScript checks
2. **Unit Tests** - Component and API tests
3. **E2E Tests** - Full user journey tests
4. **Build Test** - Ensure production build works
5. **Coverage Reports** - Code coverage analysis

### Environment Variables for CI

Set these secrets in GitHub:

- `OPENAI_API_KEY` - OpenAI API key
- `ASSISTANT_ID` - Assistant ID

## 📊 Coverage and Reports

### Jest Coverage

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

### Playwright Reports

```bash
npm run test:e2e
npx playwright show-report
```

## 🐛 Debugging

### Debug Jest Tests

```bash
# Debug specific test
npm test -- --testNamePattern="should login successfully" --no-coverage

# Run with verbose output
npm test -- --verbose

# Watch mode for development
npm run test:watch
```

### Debug Playwright Tests

```bash
# Run with UI mode
npm run test:e2e:ui

# Debug specific test
npx playwright test login.spec.ts --debug

# Run headed mode
npx playwright test --headed
```

### VS Code Integration

```json
// .vscode/launch.json
{
  "configurations": [
    {
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal"
    }
  ]
}
```

## 🔍 Common Testing Patterns

### Testing Forms

```tsx
test('validates form inputs', async () => {
  const user = userEvent.setup()
  render(<ContactForm />)
  
  // Submit empty form
  await user.click(screen.getByRole('button', { name: /submit/i }))
  
  // Check validation errors
  expect(screen.getByText(/name is required/i)).toBeInTheDocument()
  expect(screen.getByText(/email is required/i)).toBeInTheDocument()
})
```

### Testing Async Operations

```tsx
test('loads and displays data', async () => {
  mockFetch({
    '/api/users': { data: [{ id: 1, name: 'John' }] }
  })
  
  render(<UserList />)
  
  // Wait for loading to complete
  await waitForElementToBeRemoved(screen.getByText(/loading/i))
  
  // Check data is displayed
  expect(screen.getByText('John')).toBeInTheDocument()
})
```

### Testing Error States

```tsx
test('handles API errors gracefully', async () => {
  mockFetch({
    '/api/users': { ok: false, status: 500 }
  })
  
  render(<UserList />)
  
  await waitFor(() => {
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })
})
```

## 📚 Additional Resources

- [React Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Next.js Testing Documentation](https://nextjs.org/docs/testing)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
