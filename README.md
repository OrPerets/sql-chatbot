# SQL Chatbot with Animated AI Assistant "Michael"

An AI-powered SQL teaching assistant built with Next.js and OpenAI Assistants API, featuring a fully **animated, emotionally responsive character** that brings learning to life.

## 🎭 **New Feature: Animated Michael Avatar**

Michael now features a **live animated avatar** that responds dynamically to different states and interactions, creating an engaging and personable learning experience.

### ✨ **Avatar Features**

- **🎪 Emotional States**: Dynamic animations for idle, thinking, talking, and listening
- **🌟 Visual Effects**: Breathing halos, energy rings, and state-specific indicators  
- **🎙️ Speech Synchronization**: Mouth movements and expressions sync with speech
- **👂 Interactive Feedback**: Visual responses to user input and voice interaction
- **📱 Responsive Design**: Three size variants (small, medium, large) for different layouts
- **⚡ Performance Optimized**: Efficient Lottie animations with smooth transitions

### 🎛️ **Avatar States**

1. **Idle State** - Gentle breathing, blinking, and floating animations
2. **Listening State** - Attentive eyes with pulsing effects and sound wave indicators  
3. **Thinking State** - Thoughtful expressions with rotating energy rings
4. **Talking State** - Animated mouth movements with expressive gestures

### 🎨 **Implementation**

```tsx
import AnimatedMichael from './components/animated-michael';

<AnimatedMichael
  text="Hello! I'm here to help you learn SQL!"
  autoPlay={true}
  isListening={false}
  size="large"
  onSpeechStart={() => console.log('Michael started speaking')}
  onSpeechEnd={() => console.log('Michael finished speaking')}
/>
```

## 🚀 **Quick Start**

### Prerequisites
- Node.js 18+ 
- OpenAI API key
- Modern browser with Web Speech API support

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sql-chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🎯 **Demo Pages**

- **Main Application**: `/` - Login and chat interface with animated Michael
- **Avatar Demo**: `/demo/animated-avatar` - Interactive showcase of all avatar states
- **Admin Panel**: `/admin` - Management interface for system administrators

## Deployment

You can deploy this project to Vercel or any other platform that supports Next.js.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fopenai%2Fopenai-assistants-quickstart&env=OPENAI_API_KEY,OPENAI_ASSISTANT_ID&envDescription=API%20Keys%20and%20Instructions&envLink=https%3A%2F%2Fgithub.com%2Fopenai%2Fopenai-assistants-quickstart%2Fblob%2Fmain%2F.env.example)

## Overview

This project is intended to serve as a template for using the Assistants API in Next.js with [streaming](https://platform.openai.com/docs/assistants/overview/step-4-create-a-run), tool use ([code interpreter](https://platform.openai.com/docs/assistants/tools/code-interpreter) and [file search](https://platform.openai.com/docs/assistants/tools/file-search)), and [function calling](https://platform.openai.com/docs/assistants/tools/function-calling). While there are multiple pages to demonstrate each of these capabilities, they all use the same underlying assistant with all capabilities enabled.

The main logic for chat will be found in the `Chat` component in `app/components/chat.tsx`, and the handlers starting with `api/assistants/threads` (found in `api/assistants/threads/...`). Feel free to start your own project and copy some of this logic in! The `Chat` component itself can be copied and used directly, provided you copy the styling from `app/components/chat.module.css` as well.

### Pages

- Basic Chat Example: [http://localhost:3000/examples/basic-chat](http://localhost:3000/examples/basic-chat)
- Function Calling Example: [http://localhost:3000/examples/function-calling](http://localhost:3000/examples/function-calling)
- File Search Example: [http://localhost:3000/examples/file-search](http://localhost:3000/examples/file-search)
- Full-featured Example: [http://localhost:3000/examples/all](http://localhost:3000/examples/all)

### Main Components

- `app/components/chat.tsx` - handles chat rendering, [streaming](https://platform.openai.com/docs/assistants/overview?context=with-streaming), and [function call](https://platform.openai.com/docs/assistants/tools/function-calling/quickstart?context=streaming&lang=node.js) forwarding
- `app/components/file-viewer.tsx` - handles uploading, fetching, and deleting files for [file search](https://platform.openai.com/docs/assistants/tools/file-search)

### Endpoints

- `api/assistants` - `POST`: create assistant (only used at startup)
- `api/assistants/threads` - `POST`: create new thread
- `api/assistants/threads/[threadId]/messages` - `POST`: send message to assistant
- `api/assistants/threads/[threadId]/actions` - `POST`: inform assistant of the result of a function it decided to call
- `api/assistants/files` - `GET`/`POST`/`DELETE`: fetch, upload, and delete assistant files for file search

## Feedback

Let us know if you have any thoughts, questions, or feedback in [this form](https://docs.google.com/forms/d/e/1FAIpQLScn_RSBryMXCZjCyWV4_ebctksVvQYWkrq90iN21l1HLv3kPg/viewform?usp=sf_link)!
