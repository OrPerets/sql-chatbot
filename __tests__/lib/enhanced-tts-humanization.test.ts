import { mapSpeechIntentToProsody, normalizeSpeechText } from '@/app/utils/enhanced-tts';

describe('enhanced-tts humanization helpers', () => {
  it('normalizes SQL syntax into more speakable language', () => {
    const normalized = normalizeSpeechText(
      'SELECT COUNT(*) FROM users WHERE score >= 10 AND status != "archived"',
      {
        intent: 'explain',
        source: 'stream',
      }
    );

    expect(normalized).toContain('select');
    expect(normalized).toContain('count all rows');
    expect(normalized).toContain('greater than or equal to');
    expect(normalized).toContain('not equal to');
  });

  it('adds a hesitation prefix when confidence is low', () => {
    const normalized = normalizeSpeechText('Maybe we should check the join order.', {
      intent: 'uncertainty',
      source: 'stream',
      confidence: 0.32,
    });

    expect(normalized.startsWith('Let me think for a second.')).toBe(true);
  });

  it('maps greetings to a warmer, faster prosody profile', () => {
    const prosody = mapSpeechIntentToProsody({
      intent: 'greeting',
      emotion: 'warm',
      urgency: 'low',
      source: 'manual',
    });

    expect(prosody.speed).toBeGreaterThan(1);
    expect(prosody.pitch).toBeGreaterThan(1);
    expect(prosody.emotion).toBe('happy');
    expect(prosody.contentType).toBe('general');
  });
});
