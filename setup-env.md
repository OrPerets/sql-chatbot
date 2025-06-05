# Environment Setup Guide

## Required Environment Variables

To fix the 500 error when sending images, you need to set up the following environment variables:

### 1. Create `.env.local` file

Create a file named `.env.local` in your project root directory with the following content:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_ASSISTANT_ID=your_assistant_id_here
```

### 2. Get your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key or use an existing one
3. Copy the key and replace `your_openai_api_key_here` in `.env.local`

### 3. Get your Assistant ID

1. Go to [OpenAI Platform Assistants](https://platform.openai.com/assistants)
2. Find your assistant or create a new one
3. Copy the Assistant ID (starts with `asst_`)
4. Replace `your_assistant_id_here` in `.env.local`

### 4. Restart your development server

After creating the `.env.local` file:

```bash
npm run dev
```

### 5. Verify Setup

The console should now show proper logging instead of configuration errors. If you see messages like:

```
Processing message: { threadId: '...', hasContent: true, hasImage: true, assistantId: 'asst_xxx...' }
```

Then your configuration is working correctly.

## Troubleshooting

- **File not found errors**: Make sure `.env.local` is in the root directory (same level as `package.json`)
- **Still getting 500 errors**: Check the console for specific error messages
- **Invalid Assistant ID**: Make sure your Assistant ID starts with `asst_`
- **API Key issues**: Verify your API key is active and has sufficient credits

## Notes

- Never commit `.env.local` to version control (it's already in `.gitignore`)
- The environment file is only loaded on server restart
- You can also set these directly in `app/assistant-config.ts` for testing, but environment variables are recommended 