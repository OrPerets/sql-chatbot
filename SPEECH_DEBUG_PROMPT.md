# Advanced Model Prompt: Speech Synthesis Audio Collision Bug

## Problem Description
We have a React/Next.js SQL chatbot application with a 3D avatar that should speak assistant responses aloud. Despite implementing browser's native `speechSynthesis` API, the avatar is NOT speaking. We suspect there's an audio collision between our speech implementation and the TalkingHead 3D avatar library.

## Avatar Library Being Used
- **TalkingHead.js** (https://github.com/met4citizen/TalkingHead) - A THREE.js-based 3D avatar library
- The library has its own built-in TTS system with `ttsEndpoint` configuration
- We're using a **dummy TTS endpoint** (`/api/tts-dummy`) that returns silent MP3 audio
- TalkingHead configuration: `audioEnabled: false`, `useWebAudio: false`, `audioDevice: false`

## Current Implementation

### TalkingHead Configuration (MichaelAvatarDirect.tsx)
```javascript
const head = new TalkingHead(avatarRef.current, {
  ttsEndpoint: '/api/tts-dummy',        // Returns silent MP3
  ttsApikey: 'dummy-key',
  ttsVoice: 'en-US-Standard-A',
  lipsyncModules: [],                   // Disabled
  audioDevice: false,                   // Disabled
  audioEnabled: false,                  // Disabled
  useWebAudio: false,                   // Disabled
  cameraView: "head",
  enableEyeBlink: false,
  enableHeadMovement: false,
});
```

### Our Speech Implementation
```javascript
const speak = async (text: string) => {
  // Cancel any existing speech
  speechSynthesis.cancel();
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Create utterance with Hebrew voice
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'he-IL';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  
  // Find Hebrew voice (Carmit)
  const hebrewVoice = voices.find(voice => 
    voice.lang.includes('he') || 
    voice.name.toLowerCase().includes('carmit')
  );
  if (hebrewVoice) utterance.voice = hebrewVoice;
  
  speechSynthesis.speak(utterance);
};
```

### Dummy TTS Endpoint (/api/tts-dummy/route.ts)
Returns a minimal silent MP3 buffer to satisfy TalkingHead's TTS requirement without actually producing audio.

## Symptoms Observed

1. **speechSynthesis.speaking** returns `true` indicating speech is "running"
2. **No actual audio output** - user hears nothing
3. **onstart event sometimes fails** to fire (Chrome bug)
4. **Audio context appears unlocked** (user interaction completed)
5. **Hebrew voices detected** and selected correctly
6. **No console errors** in speech synthesis process
7. **TalkingHead avatar loads and displays** correctly
8. **Both systems claim to be working** but no sound

## Potential Audio Collision Points

### 1. Audio Context Competition
- TalkingHead may be creating/holding an AudioContext
- Browser speechSynthesis may be blocked by competing audio contexts
- Even with `useWebAudio: false`, TalkingHead might still claim audio resources

### 2. Audio Device Conflicts
- TalkingHead's audio device management conflicting with speechSynthesis
- Browser audio output routing being hijacked

### 3. THREE.js Audio Conflicts
- THREE.js (used by TalkingHead) has its own audio system
- Potential conflicts with browser's speech synthesis audio routing

### 4. TTS Endpoint Interference
- Even dummy TTS endpoint might be triggering TalkingHead's audio pipeline
- TalkingHead might be waiting for audio from ttsEndpoint and blocking other audio

## Technical Environment
- **Browser**: Chrome/Safari (macOS)
- **React**: 18.x with TypeScript
- **Next.js**: App Router
- **Language**: Hebrew (he-IL) with Carmit voice
- **Audio**: Browser speechSynthesis API
- **3D**: THREE.js via TalkingHead library

## Investigation Questions

1. **Is TalkingHead claiming audio resources** despite `audioEnabled: false`?
2. **Should we completely remove ttsEndpoint** from TalkingHead config?
3. **Are there hidden THREE.js audio listeners** that need cleanup?
4. **Could the dummy MP3 response** be triggering audio conflicts?
5. **Is there a proper way to initialize TalkingHead** without any audio systems?

## What We've Tried
- Multiple speechSynthesis reset attempts
- Audio unlock flows with user interaction
- Polling instead of event-based speech detection
- Removing/adding various TalkingHead audio options
- Different avatar loading strategies
- Voice detection and selection improvements

## Expected Outcome
The assistant should speak Hebrew text aloud using browser's speechSynthesis while the 3D avatar displays visually without any audio conflicts.

## Request
Please analyze this audio collision scenario and provide:
1. **Root cause analysis** of the audio conflict
2. **Specific code changes** to resolve the collision
3. **Alternative approaches** if current architecture is fundamentally flawed
4. **TalkingHead configuration** that truly disables all audio systems
5. **Speech synthesis implementation** that works alongside TalkingHead

Focus on the **audio resource management** and **potential conflicts** between the two audio systems. 