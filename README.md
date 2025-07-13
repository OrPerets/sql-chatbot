# SQL ChatBot with 3D Michael Avatar

A comprehensive SQL learning platform with an intelligent 3D teaching assistant named Michael.

## 🎭 Avatar Features

### Smart Michael Avatar System
Our advanced avatar system provides a seamless experience with intelligent fallback mechanisms:

- **3D Michael Avatar**: Realistic 3D character using TalkingHead library
- **Smart Fallback**: Graceful degradation to Lottie animations if 3D fails
- **State Synchronization**: Speaking, listening, and thinking states work across both avatar types
- **Progressive Enhancement**: Zero breaking changes to existing functionality

### Avatar Modes

1. **3D Mode** (Primary)
   - Realistic 3D character with facial expressions
   - Advanced lip-sync and gesture capabilities
   - Professional teaching pose and movements
   - Hebrew and English TTS integration

2. **2D Mode** (Fallback)
   - Smooth Lottie animations
   - Proven reliability and performance
   - Enhanced voice synthesis
   - Rich visual feedback

### Configuration Options

```typescript
<SmartMichaelAvatar
  text="שלום! אני מיכל"
  autoPlay={true}
  size="medium"
  isListening={false}
  isThinking={false}
  preferMichael={true}      // Try 3D first
  fallbackToLottie={true}   // Graceful fallback
  loadTimeout={5000}        // 5 second timeout
/>
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Modern browser with WebGL support (for 3D avatar)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Visit the avatar test page
http://localhost:3000/test-michael-integration
```

## 🛠 Implementation Architecture

### Smart Loading Strategy

1. **Loading Phase**: Attempts to load 3D Michael avatar
2. **Timeout Protection**: Configurable timeout prevents hanging
3. **Graceful Fallback**: Seamless switch to Lottie if 3D fails
4. **Error Recovery**: Retry mechanisms and user feedback

### Zero Breaking Changes

The implementation uses a **progressive enhancement** approach:

- Existing `MichaelChatAvatar` continues working
- New `SmartMichaelAvatar` provides enhanced capabilities
- Backward compatibility maintained
- Gradual migration path available

### File Structure

```
app/
├── components/
│   ├── SmartMichaelAvatar.tsx     # Smart hybrid component
│   ├── SimpleMichaelAvatar.tsx    # 3D avatar component
│   ├── michael-chat-avatar.tsx    # Original Lottie avatar
│   └── chat.tsx                   # Main chat interface
├── lib/
│   └── talkinghead/              # TalkingHead library
│       ├── talkinghead.mjs
│       └── lipsync-*.mjs
└── test-michael-integration/     # Demo page
```

## 🎯 Key Benefits

✅ **Zero Breaking Changes**: Current system continues working  
✅ **Progressive Enhancement**: 3D avatar is an upgrade, not replacement  
✅ **Bulletproof Fallbacks**: Always shows working avatar  
✅ **Future Proof**: Easy to add more avatar options  
✅ **Performance Conscious**: Loads 3D only when beneficial  

## 🧪 Testing

Visit `/test-michael-integration` to:

- Test 3D avatar loading
- Verify fallback mechanisms  
- Adjust timeout settings
- Test different avatar states
- Simulate loading failures

## 🔧 Configuration

### Avatar Preferences

Users can configure avatar behavior through the smart component props:

- `preferMichael`: Enable/disable 3D avatar attempt
- `fallbackToLottie`: Allow fallback to 2D animations
- `loadTimeout`: Maximum time to wait for 3D loading

### Performance Optimization

- Dynamic imports prevent SSR issues
- Lazy loading of 3D components
- Timeout-based resource management
- Memory cleanup on component unmount

## 📝 Development Notes

### TypeScript Considerations

The TalkingHead library is JavaScript-based, so we use type assertions for compatibility:

```typescript
const head: any = new (TalkingHead as any)(element, options);
```

### Browser Compatibility

- **3D Avatar**: Modern browsers with WebGL support
- **2D Fallback**: All browsers with basic Canvas support
- **Progressive Enhancement**: Graceful degradation on older browsers

## 🎨 Customization

### Adding New Avatar Models

1. Place GLB file in `public/avatars/`
2. Update `SimpleMichaelAvatar.tsx` with new URL
3. Test loading and fallback behavior

### Extending State Management

The avatar system supports these states:
- `idle`: Default state
- `speaking`: Active speech
- `listening`: Microphone active  
- `thinking`: Processing user input

Add new states by updating the state type and switch statements.

## 📚 Exam Mode Features

### Enhanced Exam Interface

The platform includes a comprehensive exam system with advanced features:

#### 1. Five-Minute Scenario Timer
- **Automatic countdown**: 5-minute timer starts when scenario page loads
- **Visual progress**: Circular progress indicator with mm:ss format
- **Auto-navigation**: Automatically proceeds to Question 1 when timer expires
- **Manual override**: Students can start early by clicking "Start Exam"

#### 2. Full Scenario Modal
- **Quick access**: "תרחיש" button above schema panel in questions
- **Complete context**: Full scenario page content in modal popup
- **Non-intrusive**: Doesn't affect question timer or exam flow
- **Responsive design**: Works on desktop and mobile devices

#### 3. Extra Time Accommodations
- **Admin upload**: Excel/CSV file upload for bulk extra time assignments
- **Flexible format**: Supports .xlsx and .csv files with ID and PERCENTAGE columns
- **Validation**: Automatic validation of file format and data integrity
- **Personalized timing**: Individual time adjustments applied to all question timers

### Admin Features

#### Extra Time Management
Access the admin panel at `/admin` to manage extra time accommodations:

1. **File Upload**: Upload Excel/CSV files with student accommodations
2. **Format Requirements**:
   - Column headers: `ID` (student ID) and `PERCENTAGE` (0-100)
   - Example: `304993082,25` (25% extra time for student 304993082)
3. **Validation**: Automatic validation of file format and data ranges
4. **Results**: Detailed upload summary with success/error counts

#### File Format Example
```csv
ID,PERCENTAGE
304993082,25
035678622,15
123456789,30
987654321,0
```

### Exam Security Features
- **Browser fingerprinting**: Prevents session sharing
- **Copy/paste blocking**: Disabled in SQL editor during exams
- **Session validation**: Automatic session checks and recovery
- **Auto-save**: Automatic answer saving every 5 seconds

## 🔍 Troubleshooting

### 3D Avatar Not Loading

1. Check browser WebGL support
2. Verify GLB file accessibility
3. Check console for loading errors
4. Confirm timeout settings

### Fallback Not Working  

1. Verify `fallbackToLottie={true}`
2. Check Lottie animation files
3. Test timeout configuration
4. Review error handling logs

---

Built with ❤️ for effective SQL learning
