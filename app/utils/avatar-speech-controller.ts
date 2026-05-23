export type AvatarMode = 'none' | 'avatar3d' | 'voiceCircle';

export type SpeechIntentKind =
  | 'general'
  | 'greeting'
  | 'summary'
  | 'explain'
  | 'question'
  | 'error'
  | 'confirmation'
  | 'uncertainty';

export type SpeechEmotion = 'neutral' | 'calm' | 'warm' | 'encouraging' | 'confident' | 'uncertain';
export type SpeechUrgency = 'low' | 'medium' | 'high';
export type SpeechSource = 'stream' | 'manual' | 'system' | 'user';

export interface SpeechIntent {
  intent: SpeechIntentKind;
  emotion?: SpeechEmotion;
  urgency?: SpeechUrgency;
  source?: SpeechSource;
  confidence?: number;
}

export interface AvatarRenderConfig {
  fps?: number;
  gestureIntensity?: number;
  motionProfile?: 'gentle' | 'balanced' | 'expressive';
}

export type AvatarGestureName =
  | 'none'
  | 'handup'
  | 'index'
  | 'ok'
  | 'thumbup'
  | 'thumbdown'
  | 'side'
  | 'shrug'
  | 'namaste';

export interface GesturePlan {
  primaryGesture: AvatarGestureName;
  timing: 'start' | 'mid' | 'end';
  intensity: number;
  motionProfile: 'gaze' | 'tilt' | 'nod' | 'settle';
  mouthSync: 'disabled' | 'soft' | 'stable';
  cues: string[];
}

export interface SpeechUtterance {
  id: string;
  text: string;
  intent: SpeechIntent;
  stage: 'streaming' | 'final';
  manual?: boolean;
  gesturePlan?: GesturePlan;
}

export type SpeechControllerStatus = 'idle' | 'queued' | 'preparing' | 'speaking' | 'interrupting' | 'error';
export type SpeechInterruptionReason = 'user_input' | 'manual_cancel' | 'mode_switch' | 'flush' | 'error';

export interface SpeechControllerState {
  avatarMode: AvatarMode;
  status: SpeechControllerStatus;
  currentUtterance: SpeechUtterance | null;
  queue: SpeechUtterance[];
  assistantStreaming: boolean;
  lastCompletedUtteranceId: string | null;
  interruptionReason: SpeechInterruptionReason | null;
  error: string | null;
}

export type SpeechControllerAction =
  | { type: 'SET_AVATAR_MODE'; mode: AvatarMode }
  | { type: 'SET_STREAMING'; streaming: boolean }
  | { type: 'ENQUEUE_UTTERANCE'; utterance: SpeechUtterance }
  | { type: 'SET_GESTURE_PLAN'; utteranceId: string; gesturePlan: GesturePlan }
  | { type: 'PREPARE_CURRENT'; utteranceId: string }
  | { type: 'START_CURRENT'; utteranceId: string }
  | { type: 'COMPLETE_CURRENT'; utteranceId: string }
  | { type: 'CANCEL_CURRENT'; reason: SpeechInterruptionReason }
  | { type: 'FLUSH_ALL'; reason?: SpeechInterruptionReason }
  | { type: 'FAIL_CURRENT'; utteranceId?: string; message: string };

export const DEFAULT_AVATAR_RENDER_CONFIG: AvatarRenderConfig = {
  fps: 24,
  gestureIntensity: 0.5,
  motionProfile: 'balanced',
};

export const initialSpeechControllerState: SpeechControllerState = {
  avatarMode: 'avatar3d',
  status: 'idle',
  currentUtterance: null,
  queue: [],
  assistantStreaming: false,
  lastCompletedUtteranceId: null,
  interruptionReason: null,
  error: null,
};

const updateMatchingUtterance = (
  utterances: SpeechUtterance[],
  utteranceId: string,
  gesturePlan: GesturePlan
) =>
  utterances.map((utterance) =>
    utterance.id === utteranceId ? { ...utterance, gesturePlan } : utterance
  );

const enqueueOrUpdateUtterance = (
  state: SpeechControllerState,
  utterance: SpeechUtterance
): SpeechControllerState => {
  if (state.currentUtterance?.id === utterance.id) {
    return {
      ...state,
      currentUtterance: {
        ...state.currentUtterance,
        ...utterance,
        gesturePlan: utterance.gesturePlan ?? state.currentUtterance.gesturePlan,
      },
      status: state.status === 'idle' ? 'queued' : state.status,
      interruptionReason: null,
      error: null,
    };
  }

  const existingIndex = state.queue.findIndex((item) => item.id === utterance.id);
  if (existingIndex >= 0) {
    const nextQueue = [...state.queue];
    nextQueue[existingIndex] = {
      ...nextQueue[existingIndex],
      ...utterance,
      gesturePlan: utterance.gesturePlan ?? nextQueue[existingIndex].gesturePlan,
    };
    return {
      ...state,
      queue: nextQueue,
      interruptionReason: null,
      error: null,
    };
  }

  if (!state.currentUtterance) {
    return {
      ...state,
      currentUtterance: utterance,
      status: 'queued',
      interruptionReason: null,
      error: null,
    };
  }

  return {
    ...state,
    queue: utterance.manual ? [utterance, ...state.queue] : [...state.queue, utterance],
    interruptionReason: null,
    error: null,
  };
};

const advanceQueue = (
  state: SpeechControllerState,
  completedUtteranceId: string | null,
  nextStatus: SpeechControllerStatus = 'idle'
): SpeechControllerState => {
  const [nextUtterance, ...remainingQueue] = state.queue;

  return {
    ...state,
    currentUtterance: nextUtterance ?? null,
    queue: remainingQueue,
    status: nextUtterance ? 'queued' : nextStatus,
    lastCompletedUtteranceId: completedUtteranceId,
    interruptionReason: null,
    error: nextStatus === 'error' ? state.error : null,
  };
};

export function speechControllerReducer(
  state: SpeechControllerState,
  action: SpeechControllerAction
): SpeechControllerState {
  switch (action.type) {
    case 'SET_AVATAR_MODE': {
      if (action.mode === 'none') {
        return {
          ...state,
          avatarMode: action.mode,
          currentUtterance: null,
          queue: [],
          status: 'idle',
          interruptionReason: 'mode_switch',
        };
      }

      return {
        ...state,
        avatarMode: action.mode,
        interruptionReason: null,
      };
    }

    case 'SET_STREAMING':
      return {
        ...state,
        assistantStreaming: action.streaming,
      };

    case 'ENQUEUE_UTTERANCE':
      return enqueueOrUpdateUtterance(state, action.utterance);

    case 'SET_GESTURE_PLAN':
      return {
        ...state,
        currentUtterance:
          state.currentUtterance?.id === action.utteranceId
            ? { ...state.currentUtterance, gesturePlan: action.gesturePlan }
            : state.currentUtterance,
        queue: updateMatchingUtterance(state.queue, action.utteranceId, action.gesturePlan),
      };

    case 'PREPARE_CURRENT':
      if (!state.currentUtterance || state.currentUtterance.id !== action.utteranceId) {
        return state;
      }
      return {
        ...state,
        status: 'preparing',
        interruptionReason: null,
        error: null,
      };

    case 'START_CURRENT':
      if (!state.currentUtterance || state.currentUtterance.id !== action.utteranceId) {
        return state;
      }
      return {
        ...state,
        status: 'speaking',
        interruptionReason: null,
        error: null,
      };

    case 'COMPLETE_CURRENT':
      if (!state.currentUtterance || state.currentUtterance.id !== action.utteranceId) {
        return state;
      }
      return advanceQueue(state, action.utteranceId);

    case 'CANCEL_CURRENT':
      return advanceQueue(
        {
          ...state,
          interruptionReason: action.reason,
        },
        state.currentUtterance?.id ?? null
      );

    case 'FLUSH_ALL':
      return {
        ...state,
        currentUtterance: null,
        queue: [],
        status: 'idle',
        interruptionReason: action.reason ?? 'flush',
        error: null,
      };

    case 'FAIL_CURRENT':
      return {
        ...state,
        status: 'error',
        error: action.message,
        interruptionReason: 'error',
        lastCompletedUtteranceId: action.utteranceId ?? state.currentUtterance?.id ?? null,
      };

    default:
      return state;
  }
}

const CONFIRMATION_KEYWORDS = ['great', 'correct', 'success', 'nice', 'done', 'בדיוק', 'נכון', 'מעולה'];
const ERROR_KEYWORDS = ['error', 'failed', 'incorrect', 'בעיה', 'שגיאה', 'לא נכון'];
const QUESTION_KEYWORDS = ['?', 'how', 'why', 'what', 'can you', 'איך', 'למה', 'מה'];
const SUMMARY_KEYWORDS = ['summary', 'in short', 'בקיצור', 'לסיכום'];
const GREETING_KEYWORDS = ['hello', 'hi', 'welcome', 'shalom', 'היי', 'שלום', 'ברוך'];
const UNCERTAINTY_KEYWORDS = ['maybe', 'might', 'perhaps', 'not sure', 'אולי', 'נראה', 'ייתכן'];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hasKeyword = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

export function inferSpeechIntent(text: string, baseIntent: Partial<SpeechIntent> = {}): SpeechIntent {
  const normalized = text.trim().toLowerCase();
  const fallbackIntent = baseIntent.intent ?? 'general';
  let intent: SpeechIntentKind = fallbackIntent;

  if (hasKeyword(normalized, ERROR_KEYWORDS)) {
    intent = 'error';
  } else if (hasKeyword(normalized, CONFIRMATION_KEYWORDS)) {
    intent = 'confirmation';
  } else if (hasKeyword(normalized, SUMMARY_KEYWORDS)) {
    intent = 'summary';
  } else if (hasKeyword(normalized, GREETING_KEYWORDS)) {
    intent = 'greeting';
  } else if (hasKeyword(normalized, UNCERTAINTY_KEYWORDS)) {
    intent = 'uncertainty';
  } else if (hasKeyword(normalized, QUESTION_KEYWORDS) || normalized.endsWith('?')) {
    intent = 'question';
  } else if (normalized.length > 180) {
    intent = 'explain';
  }

  return {
    intent,
    emotion:
      baseIntent.emotion ??
      (intent === 'error'
        ? 'calm'
        : intent === 'confirmation'
          ? 'encouraging'
          : intent === 'uncertainty'
            ? 'uncertain'
            : intent === 'greeting'
              ? 'warm'
              : 'neutral'),
    urgency: baseIntent.urgency ?? (intent === 'error' ? 'medium' : 'low'),
    source: baseIntent.source ?? 'stream',
    confidence: baseIntent.confidence ?? (intent === 'uncertainty' ? 0.42 : 0.88),
  };
}

export function hasReliableMouthSyncCue(text: string): boolean {
  if (!text || text.trim().length < 12) {
    return false;
  }

  if (/[\u0590-\u05FF]/.test(text)) {
    return false;
  }

  return /[a-z]/i.test(text);
}

export function buildGesturePlan(
  text: string,
  intent: SpeechIntent,
  stage: SpeechUtterance['stage'] = 'final'
): GesturePlan {
  const cues: string[] = [];
  let primaryGesture: AvatarGestureName = 'none';
  let motionProfile: GesturePlan['motionProfile'] = 'settle';
  let timing: GesturePlan['timing'] = 'start';

  switch (intent.intent) {
    case 'confirmation':
      primaryGesture = 'handup';
      motionProfile = 'nod';
      cues.push('confirmation');
      break;
    case 'error':
      primaryGesture = 'index';
      motionProfile = 'settle';
      cues.push('clarify');
      break;
    case 'uncertainty':
      primaryGesture = 'side';
      motionProfile = 'tilt';
      cues.push('uncertainty');
      break;
    case 'question':
      primaryGesture = 'index';
      motionProfile = 'gaze';
      cues.push('question');
      break;
    case 'greeting':
      primaryGesture = 'handup';
      motionProfile = 'nod';
      cues.push('greeting');
      break;
    case 'summary':
      primaryGesture = 'ok';
      motionProfile = 'settle';
      cues.push('summary');
      timing = 'end';
      break;
    case 'explain':
      primaryGesture = 'index';
      motionProfile = 'gaze';
      cues.push('explain');
      timing = stage === 'streaming' ? 'mid' : 'start';
      break;
    default:
      if (/(success|done|great|מעולה|נכון)/i.test(text)) {
        primaryGesture = 'thumbup';
        motionProfile = 'nod';
        cues.push('success');
      } else if (/(maybe|perhaps|אולי|ייתכן)/i.test(text)) {
        primaryGesture = 'side';
        motionProfile = 'tilt';
        cues.push('soften');
      } else {
        motionProfile = stage === 'streaming' ? 'gaze' : 'settle';
      }
      break;
  }

  const intensityBase =
    intent.urgency === 'high' ? 0.8 : intent.urgency === 'medium' ? 0.6 : 0.45;

  return {
    primaryGesture,
    timing,
    intensity: clamp(intensityBase + (intent.intent === 'greeting' ? 0.1 : 0), 0.25, 0.9),
    motionProfile,
    mouthSync:
      hasReliableMouthSyncCue(text) && stage === 'final'
        ? 'stable'
        : hasReliableMouthSyncCue(text)
          ? 'soft'
          : 'disabled',
    cues,
  };
}
