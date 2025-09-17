import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible()
  })

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.getByRole('button', { name: /login/i }).click()
    
    await expect(page.getByText(/email is required/i)).toBeVisible()
    await expect(page.getByText(/password is required/i)).toBeVisible()
  })

  test('should handle login form submission', async ({ page }) => {
    // Mock the API response
    await page.route('/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, token: 'mock-token' })
      })
    })

    await page.getByRole('textbox', { name: /email/i }).fill('test@example.com')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /login/i }).click()

    // Should redirect or show success message
    await expect(page).toHaveURL(/dashboard|home/) // Adjust based on your app's flow
  })

  test('should show error message on login failure', async ({ page }) => {
    // Mock failed login response
    await page.route('/api/auth/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' })
      })
    })

    await page.getByRole('textbox', { name: /email/i }).fill('test@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /login/i }).click()

    await expect(page.getByText(/invalid credentials/i)).toBeVisible()
  })

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i)
    const toggleButton = page.getByRole('button', { name: /show password/i })

    await expect(passwordInput).toHaveAttribute('type', 'password')
    
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'text')
    
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })
})

test.describe('Responsive Design', () => {
  test('should work on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE size
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible()
  })

  test('should work on tablet devices', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }) // iPad size
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
    // Test tablet-specific layout if needed
  })
})
