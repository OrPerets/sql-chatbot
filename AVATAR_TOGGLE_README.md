# Avatar Toggle Feature

## Overview
This feature adds a toggle button between the Michael avatar and a ChatGPT-style voice mode circle, providing users with two different visual interfaces for the AI assistant.

## Features

### 1. Toggle Button
- **Location**: Positioned between the avatar and user info in the right column
- **Design**: Circular button (36px diameter) with elegant styling
- **Icons**: 
  - Avatar mode: Person/character icon
  - Voice mode: Microphone/sound wave icon
- **States**: 
  - Avatar Active: Blue gradient with person icon
  - Voice Active: Green gradient with microphone icon

### 2. Voice Mode Circle
- **Size**: Same as current avatar (300px for medium size)
- **Design**: ChatGPT-style circular interface with gradient backgrounds
- **Animations**:
  - **Idle**: Gentle pulsing with soft blue gradient
  - **Listening**: Animated sound waves radiating from center
  - **Speaking**: Ripple effects with stronger blue tones
  - **Thinking**: Subtle rotation with purple accents
  - **User Writing**: Orange pulsing animation

### 3. State Management
- **Persistence**: Avatar mode preference is saved to localStorage
- **State Sharing**: Both modes respond to the same `avatarState` prop
- **Smooth Transitions**: 0.3s ease transitions between modes

## Components

### VoiceModeCircle.tsx
- Main component for the voice interface
- Props: `state`, `size`, `text`, `onSpeakingStart`, `onSpeakingEnd`
- Responsive design with mobile optimizations

### AvatarToggleIcons.tsx
- Icon components for the toggle button
- `AvatarIcon`: Person/character icon
- `MicIcon`: Microphone icon

## Usage

### Toggle Between Modes
```tsx
// Click the toggle button to switch between avatar and voice modes
<button 
  className={`${styles.toggleButton} ${avatarMode === 'avatar' ? styles.avatarActive : styles.voiceActive}`}
  onClick={() => setAvatarMode(avatarMode === 'avatar' ? 'voice' : 'avatar')}
>
  {avatarMode === 'avatar' ? <MicIcon /> : <AvatarIcon />}
</button>
```

### State Management
```tsx
// Avatar mode state with localStorage persistence
const [avatarMode, setAvatarMode] = useState<'avatar' | 'voice'>(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('avatarMode');
    return (saved === 'voice' || saved === 'avatar') ? saved : 'avatar';
  }
  return 'avatar';
});
```

## Accessibility Features

### Keyboard Navigation
- Tab navigation support
- Enter/Space key activation
- Proper ARIA attributes

### Screen Reader Support
- `aria-label` for mode descriptions
- `aria-pressed` and `aria-checked` for toggle state
- `role="switch"` for semantic meaning

## CSS Classes

### Toggle Button
- `.avatarToggle`: Container for the toggle button
- `.toggleButton`: Base button styles
- `.avatarActive`: Avatar mode active state
- `.voiceActive`: Voice mode active state

### Voice Circle
- `.voiceCircle`: Main container
- `.circleBackground`: Background with gradients
- `.speaking`, `.listening`, `.thinking`, `.userWriting`: State-specific styles

## Responsive Design

### Mobile Optimizations
- Smaller button size on mobile (28px vs 36px)
- Reduced icon sizes
- Touch-friendly interactions
- Proper scaling for voice circle

### Breakpoints
- Desktop: 36px button, 48px icons
- Tablet: 32px button, 36px icons  
- Mobile: 28px button, 32px icons

## Animation States

### Voice Circle Animations
1. **Idle**: Gentle pulsing (3s cycle)
2. **Listening**: Sound wave expansion (2s cycle)
3. **Speaking**: Ripple effects (1.5s cycle)
4. **Thinking**: Rotation with bouncing dots (4s cycle)
5. **User Writing**: Orange pulsing (2s cycle)

### Toggle Button Animations
- Fade-in animation on mount
- Hover scale and shadow effects
- Smooth icon transitions
- Color transitions between states

## Integration

The feature integrates seamlessly with the existing chat interface:
- Uses the same `avatarState` prop as Michael avatar
- Maintains all existing speech functionality
- Preserves user preferences across sessions
- No breaking changes to existing code

## Future Enhancements

Potential improvements for future versions:
- Custom voice circle themes
- Additional animation states
- Voice circle size customization
- Animation speed controls
- More icon options for different states
