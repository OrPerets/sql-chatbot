import { test, expect } from '@playwright/test'

test.describe('Assistant Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/responses/sessions', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'responses',
          sessionId: 'sess_test123',
          responseId: 'resp_bootstrap_1',
        }),
      });
    });

    await page.goto('/entities/basic-chat');
  })

  test('should load assistant chat interface', async ({ page }) => {
    await expect(page.locator('textarea')).toBeVisible()
  })

  test('should send message to assistant', async ({ page }) => {
    await page.route('/api/responses/messages', async route => {
      const ndjson = [
        JSON.stringify({ type: 'response.created', responseId: 'resp_test123' }),
        JSON.stringify({ type: 'response.output_text.delta', delta: 'Hello! ' }),
        JSON.stringify({ type: 'response.output_text.delta', delta: 'How can I help you today?' }),
        JSON.stringify({
          type: 'response.completed',
          responseId: 'resp_test123',
          outputText: 'Hello! How can I help you today?',
        }),
      ].join('\n') + '\n';

      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: ndjson,
      });
    });

    const messageInput = page.locator('textarea').first();
    await messageInput.fill('Hello, assistant!');
    await messageInput.press('Enter');

    // Wait for the message to appear in the chat
    await expect(page.getByText('Hello, assistant!')).toBeVisible()
    await expect(page.getByText('Hello! How can I help you today?')).toBeVisible()
  })

  test('should handle file upload', async ({ page }) => {
    await page.goto('/entities/file-search');

    await page.route('/api/responses/files', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            mode: 'responses',
            fileId: 'file_test123',
            vectorStoreId: 'vs_test123',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'responses',
          files: [{ file_id: 'file_test123', filename: 'test.txt', status: 'completed' }],
          vectorStoreId: 'vs_test123',
        }),
      });
    });

    // Create a test file
    const fileContent = 'This is a test file content'
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Attach files').first().click();
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(fileContent)
    })

    // Verify file upload success
    await expect(page.getByText('test.txt')).toBeVisible()
  })

  test('should handle voice input', async ({ page }) => {
    // Mock getUserMedia for microphone access
    await page.addInitScript(() => {
      // @ts-ignore
      navigator.mediaDevices = {
        getUserMedia: () => Promise.resolve({
          getTracks: () => [{ stop: () => {} }]
        })
      }
    })

    // Mock speech recognition
    await page.addInitScript(() => {
      // @ts-ignore
      window.SpeechRecognition = class MockSpeechRecognition {
        start() {}
        stop() {}
        addEventListener(event: string, callback: Function) {
          if (event === 'result') {
            setTimeout(() => {
              callback({
                results: [{
                  0: { transcript: 'Hello from voice input' }
                }]
              })
            }, 100)
          }
        }
      }
      // @ts-ignore
      window.webkitSpeechRecognition = window.SpeechRecognition
    })

    const voiceButton = page.getByRole('button', { name: /voice input/i })
    await voiceButton.click()

    // Wait for voice input to be processed
    await expect(page.getByText('Hello from voice input')).toBeVisible()
  })
})

test.describe('SQL Query Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/entities/file-search')
  })

  test('should execute SQL queries', async ({ page }) => {
    // Mock SQL execution API
    await page.route('/api/execute-sql', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 1, name: 'John Doe', email: 'john@example.com' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
          ],
          columns: ['id', 'name', 'email']
        })
      })
    })

    const sqlEditor = page.locator('.monaco-editor') // Adjust selector for your SQL editor
    const executeButton = page.getByRole('button', { name: /execute/i })

    // Type SQL query
    await sqlEditor.click()
    await page.keyboard.type('SELECT * FROM users;')
    
    await executeButton.click()

    // Verify results are displayed
    await expect(page.getByText('John Doe')).toBeVisible()
    await expect(page.getByText('jane@example.com')).toBeVisible()
  })

  test('should handle SQL errors', async ({ page }) => {
    // Mock SQL error response
    await page.route('/api/execute-sql', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Syntax error: unexpected token'
        })
      })
    })

    const sqlEditor = page.locator('.monaco-editor')
    const executeButton = page.getByRole('button', { name: /execute/i })

    await sqlEditor.click()
    await page.keyboard.type('INVALID SQL QUERY;')
    
    await executeButton.click()

    // Verify error message is displayed
    await expect(page.getByText('Syntax error: unexpected token')).toBeVisible()
  })
})
