const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.{test,spec}.{js,jsx,ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/', 
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/', // Exclude Playwright tests
    '<rootDir>/__tests__/__mocks__/' // Exclude mock files
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(mongodb|bson|@mongodb-js/.*)/)'
  ],
  moduleNameMapper: {
    '^mongodb$': '<rootDir>/__tests__/__mocks__/mongodb.js',
    '^bson$': '<rootDir>/__tests__/__mocks__/bson.js'
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/layout.tsx',
    '!app/**/loading.tsx',
    '!app/**/error.tsx',
    '!app/**/not-found.tsx',
    '!app/**/_*.{js,jsx,ts,tsx}',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)