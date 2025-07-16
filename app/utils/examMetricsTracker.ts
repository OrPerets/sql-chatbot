export interface KeystrokeEvent {
  timestamp: number;
  type: 'keydown' | 'keyup' | 'input';
  key: string;
  code: string;
  isDeleting: boolean;
  textLength: number;
  cursorPosition: number;
  dwellTime?: number; // Time key was held down
  flightTime?: number; // Time between consecutive keystrokes
}

export interface MouseEvent {
  timestamp: number;
  type: 'click' | 'move' | 'scroll' | 'hover';
  x: number;
  y: number;
  element?: string;
  scrollPosition?: number;
}

export interface FocusEvent {
  timestamp: number;
  type: 'focus' | 'blur' | 'visibility_change';
  target: string;
  duration?: number;
  tabSwitch?: boolean;
}

export interface TypingPattern {
  wordsPerMinute: number;
  charactersPerSecond: number;
  averageKeyInterval: number;
  burstTyping: boolean; // Rapid typing followed by pause
  rhythmConsistency: number; // 0-1 score
  pauseCount: number;
  longPauseCount: number; // Pauses > 3 seconds
  averagePauseLength: number;
}

export interface EditingBehavior {
  totalBackspaces: number;
  totalDeletes: number;
  copyPasteEvents: number;
  totalRevisions: number;
  textLengthProgression: number[];
  finalToInitialRatio: number;
  editingEfficiency: number; // (final length) / (total characters typed)
}

export interface CognitiveMetrics {
  timeToFirstKeystroke: number; // Reading/thinking time
  thinkingPauses: number[]; // Array of pause lengths
  hesitationIndicators: number;
  questionReReads: number;
  confidenceScore: number; // Based on typing pattern consistency
  stressIndicators: number; // Based on typing irregularities
}

export interface InterfaceUsage {
  sidebarToggleCount: number;
  schemaViewTime: number; // Total time viewing database schema
  modalOpenCount: number;
  scrollEvents: number;
  rightClickCount: number;
  devToolsOpened: boolean;
  windowResizeEvents: number;
  zoomLevelChanges: number;
}

export interface TechnicalMetrics {
  deviceInfo: {
    screenResolution: string;
    viewportSize: string;
    devicePixelRatio: number;
    userAgent: string;
    platform: string;
    connectionType?: string;
  };
  performanceMetrics: {
    pageLoadTime: number;
    networkLatency: number[];
    memoryUsage?: number;
    cpuUsage?: number;
  };
  stabilityMetrics: {
    connectionDrops: number;
    errorEvents: string[];
    warningEvents: string[];
  };
}

export interface AcademicIntegrityMetrics {
  suspiciousPatterns: {
    unusualTypingSpeed: boolean;
    pasteFromExternal: boolean;
    uniformTiming: boolean;
    styleshiftDetection: boolean;
  };
  externalToolUsage: {
    devToolsEvents: number;
    rightClickEvents: number;
    contextMenuUsage: number;
  };
  attentionMetrics: {
    tabSwitches: number;
    windowBlurEvents: number;
    totalBlurTime: number;
    focusScore: number; // 0-1, time spent focused
  };
}

export interface ComprehensiveMetrics {
  questionId: string;
  studentId: string;
  sessionId: string;
  startTime: Date;
  endTime: Date;
  
  // Core existing metrics
  basicMetrics: {
    timeSpent: number;
    isCorrect: boolean;
    studentAnswer: string;
    difficulty: string;
  };
  
  // Enhanced typing analysis
  keystrokeEvents: KeystrokeEvent[];
  typingPatterns: TypingPattern;
  editingBehavior: EditingBehavior;
  
  // Cognitive and engagement
  cognitiveMetrics: CognitiveMetrics;
  
  // Interface interaction
  mouseEvents: MouseEvent[];
  focusEvents: FocusEvent[];
  interfaceUsage: InterfaceUsage;
  
  // Technical environment
  technicalMetrics: TechnicalMetrics;
  
  // Academic integrity
  academicIntegrityMetrics: AcademicIntegrityMetrics;
  
  // Text progression analysis
  textProgressions: {
    timestamp: number;
    content: string;
    length: number;
    changeType: 'addition' | 'deletion' | 'modification';
  }[];
}

export class ExamMetricsTracker {
  private metrics: Partial<ComprehensiveMetrics>;
  private startTime: Date;
  private lastKeystroke: number = 0;
  private keystrokeBuffer: KeystrokeEvent[] = [];
  private mouseEventBuffer: MouseEvent[] = [];
  private focusEventBuffer: FocusEvent[] = [];
  private textProgressionBuffer: any[] = [];
  private lastTextContent: string = '';
  private questionStartTime: Date;
  private focusStartTime: number = Date.now();
  private blurTotalTime: number = 0;
  private isCurrentlyFocused: boolean = true;
  
  constructor(questionId: string, studentId: string, sessionId: string) {
    this.questionStartTime = new Date();
    this.startTime = new Date();
    this.metrics = {
      questionId,
      studentId,
      sessionId,
      startTime: this.startTime,
      keystrokeEvents: [],
      mouseEvents: [],
      focusEvents: [],
      textProgressions: [],
      interfaceUsage: {
        sidebarToggleCount: 0,
        schemaViewTime: 0,
        modalOpenCount: 0,
        scrollEvents: 0,
        rightClickCount: 0,
        devToolsOpened: false,
        windowResizeEvents: 0,
        zoomLevelChanges: 0,
      },
      academicIntegrityMetrics: {
        suspiciousPatterns: {
          unusualTypingSpeed: false,
          pasteFromExternal: false,
          uniformTiming: false,
          styleshiftDetection: false,
        },
        externalToolUsage: {
          devToolsEvents: 0,
          rightClickEvents: 0,
          contextMenuUsage: 0,
        },
        attentionMetrics: {
          tabSwitches: 0,
          windowBlurEvents: 0,
          totalBlurTime: 0,
          focusScore: 1.0,
        },
      },
    };
    
    this.initializeTracking();
    this.collectTechnicalMetrics();
  }

  private initializeTracking() {
    // Keystroke tracking
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    document.addEventListener('input', this.handleInput.bind(this));
    
    // Mouse tracking
    document.addEventListener('click', this.handleMouseClick.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('scroll', this.handleScroll.bind(this));
    document.addEventListener('contextmenu', this.handleRightClick.bind(this));
    
    // Focus tracking
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Developer tools detection
    this.detectDevTools();
    
    // Window events
    window.addEventListener('resize', this.handleWindowResize.bind(this));
    
    // Clipboard events
    document.addEventListener('paste', this.handlePaste.bind(this));
    document.addEventListener('copy', this.handleCopy.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent) {
    const now = Date.now();
    const flightTime = this.lastKeystroke > 0 ? now - this.lastKeystroke : 0;
    
    const keystrokeEvent: KeystrokeEvent = {
      timestamp: now,
      type: 'keydown',
      key: event.key,
      code: event.code,
      isDeleting: event.key === 'Backspace' || event.key === 'Delete',
      textLength: this.getCurrentTextLength(),
      cursorPosition: this.getCursorPosition(),
      flightTime: flightTime,
    };
    
    this.keystrokeBuffer.push(keystrokeEvent);
    this.lastKeystroke = now;
  }

  private handleKeyUp(event: KeyboardEvent) {
    const now = Date.now();
    // Find corresponding keydown event to calculate dwell time
    const keyDownEvent = this.keystrokeBuffer
      .reverse()
      .find(e => e.type === 'keydown' && e.key === event.key && !e.dwellTime);
    
    if (keyDownEvent) {
      keyDownEvent.dwellTime = now - keyDownEvent.timestamp;
    }
    
    this.keystrokeBuffer.reverse(); // Restore order
  }

  private handleInput(event: Event) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target) return;
    
    const currentContent = target.value;
    const now = Date.now();
    
    // Track text progression
    if (currentContent !== this.lastTextContent) {
      const changeType = currentContent.length > this.lastTextContent.length ? 'addition' :
                        currentContent.length < this.lastTextContent.length ? 'deletion' : 'modification';
      
      this.textProgressionBuffer.push({
        timestamp: now,
        content: currentContent,
        length: currentContent.length,
        changeType,
      });
      
      this.lastTextContent = currentContent;
    }
  }

  private handleMouseClick(event: MouseEvent) {
    this.mouseEventBuffer.push({
      timestamp: Date.now(),
      type: 'click',
      x: event.clientX,
      y: event.clientY,
      element: (event.target as Element)?.tagName || 'unknown',
    });
  }

  private handleMouseMove(event: MouseEvent) {
    // Sample mouse movements (don't track every single movement to avoid performance issues)
    if (Math.random() < 0.01) { // Sample 1% of movements
      this.mouseEventBuffer.push({
        timestamp: Date.now(),
        type: 'move',
        x: event.clientX,
        y: event.clientY,
      });
    }
  }

  private handleScroll(event: Event) {
    if (this.metrics.interfaceUsage) {
      this.metrics.interfaceUsage.scrollEvents++;
    }
    
    this.mouseEventBuffer.push({
      timestamp: Date.now(),
      type: 'scroll',
      x: 0,
      y: 0,
      scrollPosition: window.scrollY,
    });
  }

  private handleRightClick(event: MouseEvent) {
    if (this.metrics.interfaceUsage) {
      this.metrics.interfaceUsage.rightClickCount++;
    }
    if (this.metrics.academicIntegrityMetrics) {
      this.metrics.academicIntegrityMetrics.externalToolUsage.rightClickEvents++;
    }
  }

  private handleWindowFocus() {
    const now = Date.now();
    if (!this.isCurrentlyFocused) {
      this.blurTotalTime += now - this.focusStartTime;
      this.isCurrentlyFocused = true;
    }
    this.focusStartTime = now;
    
    this.focusEventBuffer.push({
      timestamp: now,
      type: 'focus',
      target: 'window',
    });
  }

  private handleWindowBlur() {
    const now = Date.now();
    this.isCurrentlyFocused = false;
    this.focusStartTime = now;
    
    if (this.metrics.academicIntegrityMetrics) {
      this.metrics.academicIntegrityMetrics.attentionMetrics.windowBlurEvents++;
      this.metrics.academicIntegrityMetrics.attentionMetrics.tabSwitches++;
    }
    
    this.focusEventBuffer.push({
      timestamp: now,
      type: 'blur',
      target: 'window',
    });
  }

  private handleVisibilityChange() {
    const now = Date.now();
    const isVisible = !document.hidden;
    
    this.focusEventBuffer.push({
      timestamp: now,
      type: 'visibility_change',
      target: 'document',
      tabSwitch: !isVisible,
    });
    
    if (!isVisible && this.metrics.academicIntegrityMetrics) {
      this.metrics.academicIntegrityMetrics.attentionMetrics.tabSwitches++;
    }
  }

  private handleWindowResize() {
    if (this.metrics.interfaceUsage) {
      this.metrics.interfaceUsage.windowResizeEvents++;
    }
  }

  private handlePaste(event: ClipboardEvent) {
    if (this.metrics.academicIntegrityMetrics) {
      this.metrics.academicIntegrityMetrics.suspiciousPatterns.pasteFromExternal = true;
    }
  }

  private handleCopy(event: ClipboardEvent) {
    // Track copy events for analysis
  }

  private detectDevTools() {
    // Simple dev tools detection
    const threshold = 160;
    const isOpen = () => {
      return window.outerHeight - window.innerHeight > threshold ||
             window.outerWidth - window.innerWidth > threshold;
    };
    
    if (isOpen()) {
      if (this.metrics.interfaceUsage) {
        this.metrics.interfaceUsage.devToolsOpened = true;
      }
      if (this.metrics.academicIntegrityMetrics) {
        this.metrics.academicIntegrityMetrics.externalToolUsage.devToolsEvents++;
      }
    }
    
    // Check periodically
    setInterval(() => {
      if (isOpen() && this.metrics.academicIntegrityMetrics) {
        this.metrics.academicIntegrityMetrics.externalToolUsage.devToolsEvents++;
      }
    }, 5000);
  }

  private collectTechnicalMetrics() {
    this.metrics.technicalMetrics = {
      deviceInfo: {
        screenResolution: `${screen.width}x${screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        devicePixelRatio: window.devicePixelRatio,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        connectionType: (navigator as any).connection?.effectiveType,
      },
      performanceMetrics: {
        pageLoadTime: performance.now(),
        networkLatency: [],
      },
      stabilityMetrics: {
        connectionDrops: 0,
        errorEvents: [],
        warningEvents: [],
      },
    };
  }

  private getCurrentTextLength(): number {
    const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
    return activeElement?.value?.length || 0;
  }

  private getCursorPosition(): number {
    const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
    return activeElement?.selectionStart || 0;
  }

  private calculateTypingPatterns(): TypingPattern {
    const events = this.keystrokeBuffer.filter(e => e.type === 'keydown' && !e.isDeleting);
    if (events.length < 2) {
      return {
        wordsPerMinute: 0,
        charactersPerSecond: 0,
        averageKeyInterval: 0,
        burstTyping: false,
        rhythmConsistency: 0,
        pauseCount: 0,
        longPauseCount: 0,
        averagePauseLength: 0,
      };
    }

    const intervals = events.slice(1).map((event, i) => event.timestamp - events[i].timestamp);
    const totalTime = (events[events.length - 1].timestamp - events[0].timestamp) / 1000;
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    const pauses = intervals.filter(interval => interval > 1000);
    const longPauses = intervals.filter(interval => interval > 3000);
    
    // Calculate rhythm consistency (standard deviation of intervals)
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const rhythmConsistency = Math.max(0, 1 - (Math.sqrt(variance) / avgInterval));
    
    return {
      wordsPerMinute: (events.length / 5) / (totalTime / 60), // Assume 5 chars per word
      charactersPerSecond: events.length / totalTime,
      averageKeyInterval: avgInterval,
      burstTyping: intervals.some(interval => interval < 50) && intervals.some(interval => interval > 2000),
      rhythmConsistency,
      pauseCount: pauses.length,
      longPauseCount: longPauses.length,
      averagePauseLength: pauses.length > 0 ? pauses.reduce((sum, pause) => sum + pause, 0) / pauses.length : 0,
    };
  }

  private calculateEditingBehavior(): EditingBehavior {
    const backspaces = this.keystrokeBuffer.filter(e => e.key === 'Backspace').length;
    const deletes = this.keystrokeBuffer.filter(e => e.key === 'Delete').length;
    const copyPasteEvents = this.keystrokeBuffer.filter(e => 
      (e.key === 'v' || e.key === 'c') && (e as any).ctrlKey
    ).length;
    
    const textLengths = this.textProgressionBuffer.map(p => p.length);
    const totalTyped = this.keystrokeBuffer.filter(e => !e.isDeleting).length;
    const finalLength = textLengths[textLengths.length - 1] || 0;
    
    return {
      totalBackspaces: backspaces,
      totalDeletes: deletes,
      copyPasteEvents,
      totalRevisions: this.textProgressionBuffer.filter(p => p.changeType === 'modification').length,
      textLengthProgression: textLengths,
      finalToInitialRatio: textLengths.length > 1 ? finalLength / textLengths[0] : 1,
      editingEfficiency: totalTyped > 0 ? finalLength / totalTyped : 0,
    };
  }

  private calculateCognitiveMetrics(): CognitiveMetrics {
    const firstKeystroke = this.keystrokeBuffer.find(e => e.type === 'keydown');
    const timeToFirstKeystroke = firstKeystroke ? 
      firstKeystroke.timestamp - this.questionStartTime.getTime() : 0;
    
    const intervals = this.keystrokeBuffer.slice(1).map((event, i) => 
      event.timestamp - this.keystrokeBuffer[i].timestamp
    );
    
    const thinkingPauses = intervals.filter(interval => interval > 3000);
    const hesitations = intervals.filter(interval => interval > 1000 && interval < 3000);
    
    // Calculate confidence based on typing consistency
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const confidenceScore = Math.max(0, 1 - (Math.sqrt(variance) / avgInterval / 2));
    
    return {
      timeToFirstKeystroke,
      thinkingPauses,
      hesitationIndicators: hesitations.length,
      questionReReads: 0, // This would need to be tracked separately
      confidenceScore,
      stressIndicators: intervals.filter(interval => interval < 50 || interval > 5000).length,
    };
  }

  // Public methods for interface interactions
  public trackSidebarToggle() {
    if (this.metrics.interfaceUsage) {
      this.metrics.interfaceUsage.sidebarToggleCount++;
    }
  }

  public trackModalOpen() {
    if (this.metrics.interfaceUsage) {
      this.metrics.interfaceUsage.modalOpenCount++;
    }
  }

  public trackSchemaViewTime(duration: number) {
    if (this.metrics.interfaceUsage) {
      this.metrics.interfaceUsage.schemaViewTime += duration;
    }
  }

  public finalizeMetrics(isCorrect: boolean, studentAnswer: string, difficulty: string): ComprehensiveMetrics {
    const endTime = new Date();
    const totalTime = endTime.getTime() - this.startTime.getTime();
    
    // Calculate attention score
    const focusScore = Math.max(0, 1 - (this.blurTotalTime / totalTime));
    
    if (this.metrics.academicIntegrityMetrics) {
      this.metrics.academicIntegrityMetrics.attentionMetrics.totalBlurTime = this.blurTotalTime;
      this.metrics.academicIntegrityMetrics.attentionMetrics.focusScore = focusScore;
    }
    
    const finalMetrics: ComprehensiveMetrics = {
      ...this.metrics,
      endTime,
      basicMetrics: {
        timeSpent: Math.floor(totalTime / 1000),
        isCorrect,
        studentAnswer,
        difficulty,
      },
      keystrokeEvents: this.keystrokeBuffer,
      mouseEvents: this.mouseEventBuffer,
      focusEvents: this.focusEventBuffer,
      textProgressions: this.textProgressionBuffer,
      typingPatterns: this.calculateTypingPatterns(),
      editingBehavior: this.calculateEditingBehavior(),
      cognitiveMetrics: this.calculateCognitiveMetrics(),
    } as ComprehensiveMetrics;
    
    // Detect suspicious patterns
    if (finalMetrics.academicIntegrityMetrics) {
      finalMetrics.academicIntegrityMetrics.suspiciousPatterns.unusualTypingSpeed = 
        finalMetrics.typingPatterns.wordsPerMinute > 120 || finalMetrics.typingPatterns.wordsPerMinute < 5;
      
      finalMetrics.academicIntegrityMetrics.suspiciousPatterns.uniformTiming = 
        finalMetrics.typingPatterns.rhythmConsistency > 0.95;
    }
    
    return finalMetrics;
  }

  public cleanup() {
    // Remove all event listeners
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));
    document.removeEventListener('input', this.handleInput.bind(this));
    document.removeEventListener('click', this.handleMouseClick.bind(this));
    document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    document.removeEventListener('scroll', this.handleScroll.bind(this));
    document.removeEventListener('contextmenu', this.handleRightClick.bind(this));
    window.removeEventListener('focus', this.handleWindowFocus.bind(this));
    window.removeEventListener('blur', this.handleWindowBlur.bind(this));
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.removeEventListener('resize', this.handleWindowResize.bind(this));
    document.removeEventListener('paste', this.handlePaste.bind(this));
    document.removeEventListener('copy', this.handleCopy.bind(this));
  }
} 