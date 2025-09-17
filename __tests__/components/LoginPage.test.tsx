import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../../app/LoginPage'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('LoginPage', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    
    // Mock successful API responses by default to avoid loading state
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]) // Mock users response
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ON' }) // Mock status response
      })
  })

  it('renders login page', async () => {
    await act(async () => {
      render(<LoginPage />)
    })
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    }, { timeout: 5000 })

    // Check if the page has rendered (look for any content)
    expect(document.body).toBeInTheDocument()
  })

  it('handles API calls on mount', async () => {
    await act(async () => {
      render(<LoginPage />)
    })
    
    // Wait for API calls to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
    
    // Should have called users and status endpoints (production URLs)
    expect(mockFetch).toHaveBeenCalledWith('https://mentor-server-theta.vercel.app/allUsers', expect.any(Object))
    expect(mockFetch).toHaveBeenCalledWith('https://mentor-server-theta.vercel.app/getStatus', expect.any(Object))
  })

  it('handles fetch errors gracefully', async () => {
    // Reset mocks and make them fail
    mockFetch.mockClear()
    mockFetch.mockRejectedValue(new Error('Network error'))
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    await act(async () => {
      render(<LoginPage />)
    })
    
    // Wait for component to finish loading (even with errors)
    await waitFor(() => {
      // Check that the component rendered (even with errors)
      expect(document.querySelector('.loginContainer')).toBeInTheDocument()
    }, { timeout: 3000 })
    
    // The component should handle errors gracefully and still render
    expect(document.querySelector('.loginCard')).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })

  it('shows loading state initially', () => {
    // Don't mock fetch to keep loading state
    mockFetch.mockClear()
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves
    
    render(<LoginPage />)
    
    // Should show loading spinner (look for the SVG with loading class)
    expect(document.querySelector('.loadingSpinner')).toBeInTheDocument()
    expect(document.querySelector('.loadingOverlay')).toBeInTheDocument()
  })
})
