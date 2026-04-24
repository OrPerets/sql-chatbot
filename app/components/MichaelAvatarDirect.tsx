'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { audioManager } from '../utils/audioContextManager';
import {
  DEFAULT_AVATAR_RENDER_CONFIG,
  type AvatarGestureName,
  type AvatarRenderConfig,
  type GesturePlan,
  type SpeechControllerStatus,
} from '../utils/avatar-speech-controller';

interface MichaelAvatarDirectProps {
  state?: 'idle' | 'speaking' | 'listening' | 'thinking' | 'userWriting';
  size?: 'small' | 'medium' | 'large';
  text?: string;
  onReady?: () => void;
  onError?: (error: string) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onAvatarLoaded?: () => void;
  progressiveMode?: boolean;
  isStreaming?: boolean;
  enableGestureQueue?: boolean;
  maxQueueSize?: number;
  onGestureStarted?: (gesture: string) => void;
  onGestureCompleted?: (gesture: string) => void;
  speechStatus?: SpeechControllerStatus;
  gesturePlan?: GesturePlan | null;
  renderConfig?: AvatarRenderConfig;
  utteranceId?: string | null;
}

export interface MichaelAvatarDirectRef {
  setMood: (mood: string) => void;
  playGesture: (gesture: string, duration?: number, mirror?: boolean, transitionMs?: number) => void;
  queueGesture: (gesture: string, duration?: number, mirror?: boolean, transitionMs?: number, priority?: 'low' | 'normal' | 'high') => void;
  clearGestureQueue: () => void;
  getGestureQueue: () => QueuedGesture[];
  lookAt: (x: number | null, y: number | null, duration?: number) => void;
  lookAtCamera: (duration?: number) => void;
  setState: (state: 'idle' | 'speaking' | 'listening' | 'thinking' | 'userWriting') => void;
}

interface QueuedGesture {
  id: string;
  gesture: Exclude<AvatarGestureName, 'none'>;
  duration: number;
  mirror: boolean;
  transitionMs: number;
  priority: 'low' | 'normal' | 'high';
  timestamp: number;
}

const VALID_GESTURES: Array<Exclude<AvatarGestureName, 'none'>> = [
  'handup',
  'index',
  'ok',
  'thumbup',
  'thumbdown',
  'side',
  'shrug',
  'namaste',
];

const isValidGesture = (gesture: string): gesture is Exclude<AvatarGestureName, 'none'> =>
  VALID_GESTURES.includes(gesture as Exclude<AvatarGestureName, 'none'>);

const isDev = process.env.NODE_ENV === 'development';
const log = (...args: unknown[]) => {
  if (isDev) {
    console.log(...args);
  }
};

const forceFaceVisibleLoop = (head: any, startTime: number) => {
  if (head.scene && typeof head.scene.traverse === 'function') {
    head.scene.traverse((obj: any) => {
      if (obj && obj.isMesh && obj.name === 'Wolf3D_Head') {
        obj.visible = true;
        if (obj.material) {
          obj.material.transparent = false;
          obj.material.opacity = 1;
          obj.material.needsUpdate = true;
        }
      }
    });
  }

  if (Date.now() - startTime < 5000) {
    requestAnimationFrame(() => forceFaceVisibleLoop(head, startTime));
  }
};

const MichaelAvatarDirect = forwardRef<MichaelAvatarDirectRef, MichaelAvatarDirectProps>(
  (
    {
      state = 'idle',
      size = 'large',
      text = '',
      onReady,
      onError,
      onSpeakingStart,
      onSpeakingEnd,
      onAvatarLoaded,
      enableGestureQueue = true,
      maxQueueSize = 5,
      onGestureStarted,
      onGestureCompleted,
      speechStatus = 'idle',
      gesturePlan = null,
      renderConfig = DEFAULT_AVATAR_RENDER_CONFIG,
      utteranceId = null,
    },
    ref
  ) => {
    const isAvatarEnabled =
      typeof window !== 'undefined' && process.env.NEXT_PUBLIC_AVATAR_ENABLED === '1';
    const avatarRef = useRef<HTMLDivElement>(null);
    const headRef = useRef<any>(null);
    const isMountedRef = useRef(false);
    const isInitializingRef = useRef(false);
    const appliedStateRef = useRef<string | null>(null);
    const appliedGestureKeyRef = useRef<string | null>(null);
    const gestureQueueRef = useRef<QueuedGesture[]>([]);
    const gestureTimeoutRef = useRef<number | null>(null);
    const visibilityObserverRef = useRef<IntersectionObserver | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const [isPlayingGesture, setIsPlayingGesture] = useState(false);

    const mergedRenderConfig = useMemo(
      () => ({
        ...DEFAULT_AVATAR_RENDER_CONFIG,
        ...renderConfig,
      }),
      [renderConfig]
    );

    const getSizeStyle = () => {
      const sizes = {
        small: { width: '200px', height: '200px' },
        medium: { width: '300px', height: '300px' },
        large: { width: '400px', height: '400px' },
      };
      return sizes[size];
    };

    const mapMoodForState = useCallback((nextState: MichaelAvatarDirectProps['state']) => {
      if (nextState === 'speaking') return 'happy';
      if (nextState === 'thinking') return 'neutral';
      if (nextState === 'listening') return 'neutral';
      return 'neutral';
    }, []);

    const stopVisualSpeech = useCallback(() => {
      const head = headRef.current;
      if (!head) {
        return;
      }

      try {
        head.stopSpeaking?.();
      } catch (visualError) {
        log('Failed to stop visual speech', visualError);
      }
    }, []);

    const playGesture = useCallback(
      (gesture: Exclude<AvatarGestureName, 'none'>, duration = 1.4, mirror = false, transitionMs = 450) => {
        const head = headRef.current;
        if (!head || !isInitialized || !isVisible) {
          return;
        }

        try {
          head.playGesture?.(gesture, duration, mirror, transitionMs);
          onGestureStarted?.(gesture);
          window.clearTimeout(gestureTimeoutRef.current ?? undefined);
          gestureTimeoutRef.current = window.setTimeout(() => {
            onGestureCompleted?.(gesture);
          }, duration * 1000);
        } catch (gestureError) {
          log(`Failed to play gesture ${gesture}`, gestureError);
        }
      },
      [isInitialized, isVisible, onGestureCompleted, onGestureStarted]
    );

    const runMotionProfile = useCallback(
      (plan: GesturePlan) => {
        const head = headRef.current;
        if (!head || !isInitialized || !isVisible) {
          return;
        }

        const travel = Math.max(250, Math.round(700 * (mergedRenderConfig.gestureIntensity || 0.5) * plan.intensity));

        try {
          switch (plan.motionProfile) {
            case 'gaze':
              head.lookAt?.(0.15, -0.05, travel);
              window.setTimeout(() => head.lookAtCamera?.(travel), travel);
              break;
            case 'tilt':
              head.lookAt?.(-0.18, 0.08, travel);
              window.setTimeout(() => head.lookAtCamera?.(travel), travel + 80);
              break;
            case 'nod':
              head.lookAt?.(0, 0.18, Math.round(travel * 0.65));
              window.setTimeout(() => head.lookAtCamera?.(Math.round(travel * 0.75)), Math.round(travel * 0.55));
              break;
            default:
              head.lookAtCamera?.(travel);
              break;
          }
        } catch (motionError) {
          log('Failed to run motion profile', motionError);
        }
      },
      [isInitialized, isVisible, mergedRenderConfig.gestureIntensity]
    );

    const runMouthSyncWindow = useCallback(
      (nextText: string, plan: GesturePlan) => {
        const head = headRef.current;
        if (!head || !isInitialized || !isVisible || plan.mouthSync === 'disabled') {
          return;
        }

        try {
          stopVisualSpeech();
          head.speakText?.(nextText, {
            avatarMute: true,
            avatarMood: mapMoodForState(state),
            lipsyncLang: 'en',
          });

          const mouthWindow = plan.mouthSync === 'stable' ? 1800 : 900;
          window.setTimeout(() => {
            head.stopSpeaking?.();
          }, mouthWindow);
        } catch (lipsyncError) {
          log('Failed to run mouth sync window', lipsyncError);
        }
      },
      [isInitialized, isVisible, mapMoodForState, state, stopVisualSpeech]
    );

    const runGesturePlan = useCallback(
      (plan: GesturePlan, nextText: string) => {
        if (plan.primaryGesture !== 'none') {
          playGesture(plan.primaryGesture, 1 + plan.intensity, false, 400);
        }
        runMotionProfile(plan);
        runMouthSyncWindow(nextText, plan);
      },
      [playGesture, runMotionProfile, runMouthSyncWindow]
    );

    const processGestureQueue = useCallback(() => {
      if (!enableGestureQueue || isPlayingGesture || !isInitialized || !isVisible) {
        return;
      }

      const queue = [...gestureQueueRef.current].sort((left, right) => {
        const priorities = { high: 3, normal: 2, low: 1 };
        if (priorities[left.priority] !== priorities[right.priority]) {
          return priorities[right.priority] - priorities[left.priority];
        }
        return left.timestamp - right.timestamp;
      });

      const nextGesture = queue[0];
      if (!nextGesture) {
        return;
      }

      gestureQueueRef.current = gestureQueueRef.current.filter((item) => item.id !== nextGesture.id);
      setIsPlayingGesture(true);
      playGesture(nextGesture.gesture, nextGesture.duration, nextGesture.mirror, nextGesture.transitionMs);
      window.setTimeout(() => {
        setIsPlayingGesture(false);
      }, nextGesture.duration * 1000);
    }, [enableGestureQueue, isInitialized, isPlayingGesture, isVisible, playGesture]);

    const queueGesture = useCallback(
      (
        gesture: Exclude<AvatarGestureName, 'none'>,
        duration = 1.4,
        mirror = false,
        transitionMs = 450,
        priority: 'low' | 'normal' | 'high' = 'normal'
      ) => {
        if (!enableGestureQueue) {
          return false;
        }

        if (!VALID_GESTURES.includes(gesture)) {
          return false;
        }

        if (gestureQueueRef.current.length >= maxQueueSize) {
          const lowPriorityIndex = gestureQueueRef.current.findIndex((item) => item.priority === 'low');
          if (lowPriorityIndex >= 0) {
            gestureQueueRef.current.splice(lowPriorityIndex, 1);
          } else {
            return false;
          }
        }

        gestureQueueRef.current = [
          ...gestureQueueRef.current,
          {
            id: `${gesture}-${Date.now()}`,
            gesture,
            duration,
            mirror,
            transitionMs,
            priority,
            timestamp: Date.now(),
          },
        ];

        window.setTimeout(() => processGestureQueue(), 40);
        return true;
      },
      [enableGestureQueue, maxQueueSize, processGestureQueue]
    );

    const clearGestureQueue = useCallback(() => {
      gestureQueueRef.current = [];
      if (gestureTimeoutRef.current) {
        window.clearTimeout(gestureTimeoutRef.current);
        gestureTimeoutRef.current = null;
      }
      setIsPlayingGesture(false);
    }, []);

    const applyAvatarState = useCallback(
      (nextState: MichaelAvatarDirectProps['state']) => {
        const head = headRef.current;
        if (!head || !isInitialized || !isVisible || appliedStateRef.current === nextState) {
          return;
        }

        appliedStateRef.current = nextState;

        try {
          head.setMood?.(mapMoodForState(nextState));
        } catch (moodError) {
          log('Failed to set avatar mood', moodError);
        }

        if (nextState === 'thinking') {
          runMotionProfile({
            primaryGesture: 'none',
            timing: 'mid',
            intensity: 0.45,
            motionProfile: 'gaze',
            mouthSync: 'disabled',
            cues: ['thinking'],
          });
        } else if (nextState === 'userWriting') {
          runMotionProfile({
            primaryGesture: 'none',
            timing: 'mid',
            intensity: 0.35,
            motionProfile: 'tilt',
            mouthSync: 'disabled',
            cues: ['typing'],
          });
        } else if (nextState === 'idle') {
          head.lookAtCamera?.(400);
          stopVisualSpeech();
        }
      },
      [isInitialized, isVisible, mapMoodForState, runMotionProfile, stopVisualSpeech]
    );

    const loadAvatarWithFallbacks = useCallback(async (head: any) => {
      const strategies = [
        () =>
          head.showAvatar({
            url: '/michael.glb',
            body: 'M',
            avatarMood: 'neutral',
          }),
        () =>
          head.showAvatar({
            url: '/avatars/michael.glb',
            body: 'M',
            avatarMood: 'neutral',
          }),
        () =>
          head.showAvatar({
            url: 'https://models.readyplayer.me/64f1a714ce16e342a8cddd5d.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=png',
            body: 'M',
            avatarMood: 'neutral',
          }),
      ];

      let lastFailure: unknown = null;

      for (const strategy of strategies) {
        try {
          await strategy();
          return;
        } catch (avatarError) {
          lastFailure = avatarError;
        }
      }

      throw lastFailure instanceof Error ? lastFailure : new Error('Failed to load avatar');
    }, []);

    const initializeAvatar = useCallback(async () => {
      if (!isAvatarEnabled || !avatarRef.current || headRef.current || isInitializingRef.current) {
        return;
      }

      try {
        isInitializingRef.current = true;
        setIsLoading(true);
        setError(null);
        avatarRef.current.innerHTML = '';

        const { TalkingHead } = await import('../lib/talkinghead/talkinghead.mjs');
        if (!isMountedRef.current || !avatarRef.current) {
          return;
        }

        const head = new (TalkingHead as any)(avatarRef.current, {
          ttsEndpoint: '/api/tts-dummy',
          ttsApikey: 'dummy-key',
          ttsVoice: 'en-US-Standard-A',
          lipsyncModules: ['en'],
          dracoEnabled: true,
          cameraView: 'upper',
          enableEyeBlink: true,
          enableHeadMovement: true,
          enableGestures: true,
          modelFPS: mergedRenderConfig.fps || 24,
          pixelRatio: 1,
          antialias: false,
          body: 'M',
          modelRoot: 'Armature',
          audioFilePlayer: false,
          speechSynthesis: false,
          microphoneEnabled: false,
        });

        audioManager.setTalkingHeadActive(true);
        headRef.current = head;

        await loadAvatarWithFallbacks(head);
        if (!isMountedRef.current) {
          head.stop?.();
          return;
        }

        head.onResize?.();
        head.setView?.('upper');
        head.lookAtCamera?.(0);
        forceFaceVisibleLoop(head, Date.now());

        setIsInitialized(true);
        setIsLoading(false);
        onReady?.();
        onAvatarLoaded?.();
      } catch (avatarError) {
        const nextError = avatarError instanceof Error ? avatarError.message : 'Avatar failed to initialize';
        setError(nextError);
        setIsLoading(false);
        onError?.(nextError);
      } finally {
        isInitializingRef.current = false;
      }
    }, [isAvatarEnabled, loadAvatarWithFallbacks, mergedRenderConfig.fps, onAvatarLoaded, onError, onReady]);

    useEffect(() => {
      isMountedRef.current = true;
      const avatarElement = avatarRef.current;
      initializeAvatar();

      return () => {
        isMountedRef.current = false;
        audioManager.setTalkingHeadActive(false);
        stopVisualSpeech();
        clearGestureQueue();

        if (headRef.current) {
          try {
            headRef.current.stop?.();
          } catch (stopError) {
            log('Failed to stop avatar', stopError);
          }
        }

        if (avatarElement) {
          avatarElement.innerHTML = '';
        }
      };
    }, [clearGestureQueue, initializeAvatar, stopVisualSpeech]);

    useEffect(() => {
      if (!avatarRef.current || typeof IntersectionObserver === 'undefined') {
        return;
      }

      visibilityObserverRef.current = new IntersectionObserver(
        ([entry]) => {
          setIsVisible(entry.isIntersecting);
        },
        { threshold: 0.15 }
      );

      visibilityObserverRef.current.observe(avatarRef.current);

      return () => {
        visibilityObserverRef.current?.disconnect();
      };
    }, []);

    useEffect(() => {
      applyAvatarState(state);
    }, [applyAvatarState, state]);

    useEffect(() => {
      if (!gesturePlan || !utteranceId || !text || !isInitialized) {
        return;
      }

      if (speechStatus !== 'preparing' && speechStatus !== 'speaking') {
        if (speechStatus === 'idle') {
          stopVisualSpeech();
          onSpeakingEnd?.();
        }
        return;
      }

      const gestureKey = `${utteranceId}:${speechStatus}:${gesturePlan.primaryGesture}:${gesturePlan.mouthSync}`;
      if (appliedGestureKeyRef.current === gestureKey) {
        return;
      }

      appliedGestureKeyRef.current = gestureKey;
      onSpeakingStart?.();
      runGesturePlan(gesturePlan, text);
    }, [
      gesturePlan,
      isInitialized,
      onSpeakingEnd,
      onSpeakingStart,
      runGesturePlan,
      speechStatus,
      stopVisualSpeech,
      text,
      utteranceId,
    ]);

    useEffect(() => {
      if (!isInitialized || speechStatus === 'speaking' || speechStatus === 'preparing') {
        return;
      }

      stopVisualSpeech();
    }, [isInitialized, speechStatus, stopVisualSpeech]);

    useEffect(() => {
      if (gestureQueueRef.current.length > 0 && !isPlayingGesture) {
        processGestureQueue();
      }
    }, [isPlayingGesture, processGestureQueue]);

    useImperativeHandle(
      ref,
      () => ({
        setMood: (mood: string) => {
          headRef.current?.setMood?.(mood);
        },
        playGesture: (gesture, duration = 1.4, mirror = false, transitionMs = 450) => {
          if (gesture !== 'none' && isValidGesture(gesture)) {
            playGesture(gesture, duration, mirror, transitionMs);
          }
        },
        queueGesture: (gesture, duration = 1.4, mirror = false, transitionMs = 450, priority = 'normal') => {
          if (gesture !== 'none' && isValidGesture(gesture)) {
            queueGesture(gesture, duration, mirror, transitionMs, priority);
          }
        },
        clearGestureQueue,
        getGestureQueue: () => [...gestureQueueRef.current],
        lookAt: (x, y, duration = 400) => {
          headRef.current?.lookAt?.(x, y, duration);
        },
        lookAtCamera: (duration = 400) => {
          headRef.current?.lookAtCamera?.(duration);
        },
        setState: (nextState) => {
          applyAvatarState(nextState);
        },
      }),
      [applyAvatarState, clearGestureQueue, playGesture, queueGesture]
    );

    if (!isAvatarEnabled) {
      return null;
    }

    const speakingIndicator = speechStatus === 'speaking' || speechStatus === 'preparing';

    return (
      <div
        style={{
          ...getSizeStyle(),
          position: 'relative',
          maxWidth: 'calc(100% - 24px)',
          maxHeight: 'calc(100% - 24px)',
          borderRadius: '20%',
          overflow: 'hidden',
          background: 'radial-gradient(circle at 50% 28%, #f8fbff 0%, #eef4fb 56%, #dde7f2 100%)',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: getSizeStyle().height,
          flexShrink: 0,
        }}
      >
        <div
          ref={avatarRef}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />

        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              textAlign: 'center',
              color: '#7f1d1d',
              background: 'rgba(255,255,255,0.92)',
              zIndex: 3,
            }}
          >
            {error}
          </div>
        )}

        {isLoading && !error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              background: 'rgba(255,255,255,0.72)',
              zIndex: 2,
            }}
          >
            טוען אווטאר...
          </div>
        )}

        {speakingIndicator && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.92)',
              boxShadow: '0 0 0 8px rgba(34, 197, 94, 0.14)',
              zIndex: 4,
            }}
          />
        )}

        {state === 'thinking' && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '6px 10px',
              borderRadius: '999px',
              background: 'rgba(15, 23, 42, 0.72)',
              color: '#fff',
              fontSize: '12px',
              zIndex: 4,
            }}
          >
            חושב...
          </div>
        )}
      </div>
    );
  }
);

MichaelAvatarDirect.displayName = 'MichaelAvatarDirect';

export default MichaelAvatarDirect;
