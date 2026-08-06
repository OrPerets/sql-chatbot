import { render, waitFor, act } from '@testing-library/react'
import LoginPage from '../../app/LoginPage'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock as any

describe('LoginPage', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
  })

  it('renders login page', async () => {
    await act(async () => {
      render(<LoginPage />)
    })

    expect(document.body).toBeInTheDocument()
    expect(document.querySelector('.loginContainer')).toBeInTheDocument()
  })

  it('does not require API calls on mount', async () => {
    await act(async () => {
      render(<LoginPage />)
    })

    expect(document.querySelector('.loginContainer')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('handles fetch errors gracefully', async () => {
    mockFetch.mockClear()
    mockFetch.mockRejectedValue(new Error('Network error'))

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => {
      render(<LoginPage />)
    })

    await waitFor(() => {
      expect(document.querySelector('.loginContainer')).toBeInTheDocument()
    }, { timeout: 5000 })

    expect(document.querySelector('.loginCard')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('shows non-blocking loading state initially', async () => {
    mockFetch.mockClear()
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    await act(async () => {
      render(<LoginPage />)
    })

    // UI should remain visible while initial fetch is pending
    expect(document.querySelector('.loginCard')).toBeInTheDocument()
    // No full-page blocking overlay should be shown
    expect(document.querySelector('.loadingOverlay')).not.toBeInTheDocument()
  })
})
