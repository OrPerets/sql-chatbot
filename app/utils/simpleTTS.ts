// Simple Text-to-Speech utility - completely independent from avatar
import { audioManager } from './audioContextManager';

let isSpeaking = false;
let currentUtterance: SpeechSynthesisUtterance | null = null;

export const simpleTTS = {
  speak: async (text: string) => {
    console.log('🎤 SimpleTTS: Starting speech request...');
    
    if (!text || text.trim().length === 0) {
      console.log('❌ SimpleTTS: No text provided');
      return;
    }

    // Request audio access through manager
    const audioAccessGranted = await audioManager.requestSpeechAccess();
    if (!audioAccessGranted) {
      console.error('❌ SimpleTTS: Failed to obtain audio access');
      return;
    }

    // Stop any existing speech
    simpleTTS.stop();

    if (!('speechSynthesis' in window)) {
      console.error('❌ SimpleTTS: Speech synthesis not supported');
      audioManager.releaseSpeechAccess();
      return;
    }

    // Clean the text for speech synthesis
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/```[\s\S]*?```/g, ' code block ') // Replace code blocks
      .replace(/😊|😀|😃|😄|😁|😆|😅|🤣|😂|🙂|🙃|😉|😇|🥰|😍|🤩|😘|😗|😚|😙|😋|😛|😜|🤪|😝|🤑|🤗|🤭|🤫|🤔|🤐|🤨|😐|😑|😶|😏|😒|🙄|😬|🤥|😌|😔|😪|🤤|😴|😷|🤒|🤕|🤢|🤮|🤧|🥵|🥶|🥴|😵|🤯|🤠|🥳|😎|🤓|🧐|🚀|⚡|💡|🎯|🎓|✨|👍|👎|👏|🔧|🛠️|📝|📊|💻|⭐|🎉|🔥|💪|🏆|📈|🎪/g, '') // Remove emojis
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    console.log('🗣️ SimpleTTS: Clean text:', cleanText.substring(0, 50) + '...');

    // Create the utterance with enhanced human-like settings
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'he-IL';
    utterance.rate = 0.85;  // Slightly slower for more natural, friendly pace
    utterance.pitch = 1.1;  // Slightly higher pitch for more engaging tone
    utterance.volume = 0.9; // Slightly lower volume for more natural feel

    // Find a Hebrew voice with preference for more natural ones
    const voices = speechSynthesis.getVoices();
    console.log('🎤 SimpleTTS: Available voices:', voices.length);

    if (voices.length > 0) {
      // Look for better Hebrew voices in order of preference
      const hebrewVoice = voices.find(voice => 
        voice.name.toLowerCase().includes('carmit')
      ) || voices.find(voice => 
        voice.lang.includes('he') || voice.lang.includes('iw')
      ) || voices.find(voice => 
        voice.name.toLowerCase().includes('hebrew')
      );

      if (hebrewVoice) {
        utterance.voice = hebrewVoice;
        console.log('🗣️ SimpleTTS: Using enhanced Hebrew voice:', hebrewVoice.name, hebrewVoice.lang);
      } else {
        // Fallback to best available voice
        const betterVoice = voices.find(voice => 
          voice.name.toLowerCase().includes('alex') ||
          voice.name.toLowerCase().includes('daniel') ||
          voice.name.toLowerCase().includes('natural')
        );
        if (betterVoice) {
          utterance.voice = betterVoice;
          utterance.lang = 'en-US'; // Switch to English for better voice
          console.log('🗣️ SimpleTTS: Using fallback enhanced voice:', betterVoice.name);
        } else {
          console.log('⚠️ SimpleTTS: No enhanced voice found, using default');
        }
      }
    }

    // Set up event handlers
    utterance.onstart = () => {
      console.log('🎙️ SimpleTTS: Speech started successfully!');
      isSpeaking = true;
    };

    utterance.onend = () => {
      console.log('🤐 SimpleTTS: Speech ended successfully');
      isSpeaking = false;
      currentUtterance = null;
      audioManager.releaseSpeechAccess();
    };

    utterance.onerror = (event) => {
      console.error('❌ SimpleTTS: Speech error:', event.error);
      isSpeaking = false;
      currentUtterance = null;
      audioManager.releaseSpeechAccess();
    };

    // Start speaking
    currentUtterance = utterance;
    console.log('🎤 SimpleTTS: Starting speech synthesis...');
    speechSynthesis.speak(utterance);
  },

  stop: () => {
    if (isSpeaking || currentUtterance) {
      console.log('🛑 SimpleTTS: Stopping speech...');
      speechSynthesis.cancel();
      isSpeaking = false;
      currentUtterance = null;
      audioManager.releaseSpeechAccess();
    }
  },

  isCurrentlySpeaking: () => {
    return isSpeaking;
  }
};

// Initialize voices when available
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  speechSynthesis.addEventListener('voiceschanged', () => {
    const voices = speechSynthesis.getVoices();
    console.log('🎤 SimpleTTS: Voices loaded:', voices.length);
  });
  
  // Trigger initial voice loading
  speechSynthesis.getVoices();
} 