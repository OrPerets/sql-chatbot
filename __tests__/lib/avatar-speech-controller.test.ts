import {
  buildGesturePlan,
  initialSpeechControllerState,
  speechControllerReducer,
  type SpeechUtterance,
} from '@/app/utils/avatar-speech-controller';

describe('avatar speech controller reducer', () => {
  const createUtterance = (
    id: string,
    text: string,
    stage: SpeechUtterance['stage'] = 'streaming'
  ): SpeechUtterance => ({
    id,
    text,
    stage,
    intent: {
      intent: 'explain',
      source: 'stream',
    },
    gesturePlan: buildGesturePlan(text, { intent: 'explain', source: 'stream' }, stage),
  });

  it('enqueues the first utterance as the current one', () => {
    const state = speechControllerReducer(initialSpeechControllerState, {
      type: 'ENQUEUE_UTTERANCE',
      utterance: createUtterance('assistant-1', 'First partial answer'),
    });

    expect(state.currentUtterance?.id).toBe('assistant-1');
    expect(state.status).toBe('queued');
    expect(state.queue).toHaveLength(0);
  });

  it('updates the current utterance when the same message streams more text', () => {
    const initial = speechControllerReducer(initialSpeechControllerState, {
      type: 'ENQUEUE_UTTERANCE',
      utterance: createUtterance('assistant-1', 'First partial answer'),
    });

    const updated = speechControllerReducer(initial, {
      type: 'ENQUEUE_UTTERANCE',
      utterance: createUtterance('assistant-1', 'First partial answer with more detail'),
    });

    expect(updated.currentUtterance?.text).toContain('more detail');
    expect(updated.queue).toHaveLength(0);
  });

  it('advances to the next queued utterance after completion', () => {
    const withCurrent = speechControllerReducer(initialSpeechControllerState, {
      type: 'ENQUEUE_UTTERANCE',
      utterance: createUtterance('assistant-1', 'First answer', 'final'),
    });

    const withQueued = speechControllerReducer(withCurrent, {
      type: 'ENQUEUE_UTTERANCE',
      utterance: createUtterance('assistant-2', 'Second answer', 'final'),
    });

    const completed = speechControllerReducer(withQueued, {
      type: 'COMPLETE_CURRENT',
      utteranceId: 'assistant-1',
    });

    expect(completed.lastCompletedUtteranceId).toBe('assistant-1');
    expect(completed.currentUtterance?.id).toBe('assistant-2');
    expect(completed.status).toBe('queued');
  });

  it('flushes all pending work when requested', () => {
    const state = speechControllerReducer(
      speechControllerReducer(initialSpeechControllerState, {
        type: 'ENQUEUE_UTTERANCE',
        utterance: createUtterance('assistant-1', 'First answer'),
      }),
      {
        type: 'FLUSH_ALL',
        reason: 'user_input',
      }
    );

    expect(state.currentUtterance).toBeNull();
    expect(state.queue).toHaveLength(0);
    expect(state.status).toBe('idle');
    expect(state.interruptionReason).toBe('user_input');
  });
});
