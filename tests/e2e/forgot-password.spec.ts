import { test, expect } from '@playwright/test'

test.describe('Forgot Password Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for consistent testing
    await page.route('/api/auth/forgot-password', async route => {
      const request = route.request()
      const postData = request.postDataJSON()
      
      if (postData?.email === 'test@example.com') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            success: true, 
            message: 'Password reset email sent successfully' 
          })
        })
      } else if (postData?.email === 'rate-limited@example.com') {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Too many requests. Please wait 30 minutes before trying again.',
            rateLimited: true,
            remainingTime: 30
          })
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            success: true, 
            message: 'If the email exists, a password reset link has been sent' 
          })
        })
      }
    })

    await page.route('/api/auth/reset-password/validate*', async route => {
      const url = new URL(route.request().url())
      const token = url.searchParams.get('token')
      
      if (token === 'valid-token') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            valid: true, 
            email: 'test@example.com' 
          })
        })
      } else if (token === 'expired-token') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ 
            valid: false, 
            error: 'Token expired' 
          })
        })
      } else if (token === 'invalid-token') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ 
            valid: false, 
            error: 'Invalid token' 
          })
        })
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ 
            valid: false, 
            error: 'Invalid token' 
          })
        })
      }
    })

    await page.route('/api/auth/reset-password', async route => {
      const request = route.request()
      const postData = request.postDataJSON()
      
      if (postData?.token === 'valid-token' && postData?.newPassword === postData?.confirmPassword) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            success: true, 
            message: 'Password reset successfully' 
          })
        })
      } else if (postData?.newPassword !== postData?.confirmPassword) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Passwords do not match' 
          })
        })
      } else if (postData?.newPassword === 'shenkar') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Cannot use default password' 
          })
        })
      } else if (postData?.newPassword?.length < 6) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Password must be at least 6 characters long' 
          })
        })
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Invalid or expired token' 
          })
        })
      }
    })
  })

  test('should complete forgot password flow successfully', async ({ page }) => {
    // Go to login page
    await page.goto('/')
    
    // Wait for page to load
    await page.waitForSelector('text=התחברות')
    
    // Click forgot password link
    await page.click('text=שכחת סיסמה?')
    
    // Wait for modal to appear
    await page.waitForSelector('text=איפוס סיסמה')
    
    // Fill email
    await page.fill('input[type="email"]', 'test@example.com')
    
    // Submit
    await page.click('text=שלח קישור')
    
    // Check success message
    await expect(page.locator('text=נשלח קישור לאיפוס סיסמה למייל שלך')).toBeVisible()
    
    // Modal should close
    await expect(page.locator('text=איפוס סיסמה')).not.toBeVisible()
  })

  test('should handle rate limiting', async ({ page }) => {
    // Go to login page
    await page.goto('/')
    
    // Click forgot password link
    await page.click('text=שכחת סיסמה?')
    
    // Fill email with rate-limited email
    await page.fill('input[type="email"]', 'rate-limited@example.com')
    
    // Submit
    await page.click('text=שלח קישור')
    
    // Check rate limit error message
    await expect(page.locator('text=Too many requests')).toBeVisible()
  })

  test('should allow canceling forgot password modal', async ({ page }) => {
    // Go to login page
    await page.goto('/')
    
    // Click forgot password link
    await page.click('text=שכחת סיסמה?')
    
    // Wait for modal to appear
    await page.waitForSelector('text=איפוס סיסמה')
    
    // Click cancel button
    await page.click('text=ביטול')
    
    // Modal should close
    await expect(page.locator('text=איפוס סיסמה')).not.toBeVisible()
  })

  test('should reset password with valid token', async ({ page }) => {
    // Go to reset page with valid token
    await page.goto('/auth/reset-password?token=valid-token')
    
    // Wait for page to load and validate token
    await page.waitForSelector('text=איפוס סיסמה')
    
    // Check that email is displayed
    await expect(page.locator('text=test@example.com')).toBeVisible()
    
    // Fill new password
    await page.fill('input[placeholder="סיסמה חדשה"]', 'newpassword123')
    await page.fill('input[placeholder="אישור סיסמה"]', 'newpassword123')
    
    // Submit
    await page.click('text=אפס סיסמה')
    
    // Check success message
    await expect(page.locator('text=הסיסמה עודכנה בהצלחה!')).toBeVisible()
    
    // Should redirect to login page after 3 seconds
    await page.waitForURL('/', { timeout: 5000 })
  })

  test('should handle invalid token', async ({ page }) => {
    // Go to reset page with invalid token
    await page.goto('/auth/reset-password?token=invalid-token')
    
    // Wait for error to appear
    await page.waitForSelector('text=שגיאה')
    
    // Check error message
    await expect(page.locator('text=קישור לא תקין או פג תוקף')).toBeVisible()
    
    // Should have button to return to login
    await expect(page.locator('text=חזור לעמוד הכניסה')).toBeVisible()
  })

  test('should handle expired token', async ({ page }) => {
    // Go to reset page with expired token
    await page.goto('/auth/reset-password?token=expired-token')
    
    // Wait for error to appear
    await page.waitForSelector('text=שגיאה')
    
    // Check error message
    await expect(page.locator('text=קישור לא תקין או פג תוקף')).toBeVisible()
  })

  test('should validate password requirements', async ({ page }) => {
    // Go to reset page with valid token
    await page.goto('/auth/reset-password?token=valid-token')
    
    // Wait for page to load
    await page.waitForSelector('text=איפוס סיסמה')
    
    // Try with mismatched passwords
    await page.fill('input[placeholder="סיסמה חדשה"]', 'password123')
    await page.fill('input[placeholder="אישור סיסמה"]', 'different123')
    
    await page.click('text=אפס סיסמה')
    
    // Check error message
    await expect(page.locator('text=הסיסמאות אינן תואמות')).toBeVisible()
  })

  test('should prevent using default password', async ({ page }) => {
    // Go to reset page with valid token
    await page.goto('/auth/reset-password?token=valid-token')
    
    // Wait for page to load
    await page.waitForSelector('text=איפוס סיסמה')
    
    // Try with default password
    await page.fill('input[placeholder="סיסמה חדשה"]', 'shenkar')
    await page.fill('input[placeholder="אישור סיסמה"]', 'shenkar')
    
    await page.click('text=אפס סיסמה')
    
    // Check error message
    await expect(page.locator('text=לא ניתן להשתמש בסיסמה ברירת המחדל')).toBeVisible()
  })

  test('should validate password length', async ({ page }) => {
    // Go to reset page with valid token
    await page.goto('/auth/reset-password?token=valid-token')
    
    // Wait for page to load
    await page.waitForSelector('text=איפוס סיסמה')
    
    // Try with short password
    await page.fill('input[placeholder="סיסמה חדשה"]', '123')
    await page.fill('input[placeholder="אישור סיסמה"]', '123')
    
    await page.click('text=אפס סיסמה')
    
    // Check error message
    await expect(page.locator('text=הסיסמה חייבת להכיל לפחות 6 תווים')).toBeVisible()
  })

  test('should handle missing token parameter', async ({ page }) => {
    // Go to reset page without token
    await page.goto('/auth/reset-password')
    
    // Wait for error to appear
    await page.waitForSelector('text=שגיאה')
    
    // Check error message
    await expect(page.locator('text=קישור לא תקין')).toBeVisible()
  })

  test('should show loading state during token validation', async ({ page }) => {
    // Go to reset page with valid token
    await page.goto('/auth/reset-password?token=valid-token')
    
    // Should show loading state initially
    await expect(page.locator('text=מאמת קישור...')).toBeVisible()
    
    // Wait for validation to complete
    await page.waitForSelector('text=איפוס סיסמה', { timeout: 5000 })
    
    // Loading state should be gone
    await expect(page.locator('text=מאמת קישור...')).not.toBeVisible()
  })

  test('should show loading state during password reset', async ({ page }) => {
    // Go to reset page with valid token
    await page.goto('/auth/reset-password?token=valid-token')
    
    // Wait for page to load
    await page.waitForSelector('text=איפוס סיסמה')
    
    // Fill passwords
    await page.fill('input[placeholder="סיסמה חדשה"]', 'newpassword123')
    await page.fill('input[placeholder="אישור סיסמה"]', 'newpassword123')
    
    // Submit and check loading state
    await page.click('text=אפס סיסמה')
    
    // Button should show loading spinner
    await expect(page.locator('.loadingSpinner')).toBeVisible()
  })
})
