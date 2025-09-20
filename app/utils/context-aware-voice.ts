// Context-Aware Voice Intelligence Service
// Handles SQL pronunciation, technical terms, smart pausing, and content adaptation

export interface VoiceContext {
  contentType: 'sql' | 'explanation' | 'question' | 'feedback' | 'general';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  language: 'en' | 'he';
  technicalLevel: 'basic' | 'intermediate' | 'advanced';
  emphasisWords?: string[];
  pausePoints?: number[];
}

export interface PronunciationRule {
  pattern: RegExp;
  replacement: string;
  context?: string;
  priority: number;
}

export interface VoiceIntelligenceOptions {
  enableSQLPronunciation: boolean;
  enableTechnicalTerms: boolean;
  enableSmartPausing: boolean;
  enableEmphasisDetection: boolean;
  enableContextAdaptation: boolean;
  pauseDuration: number; // milliseconds
  emphasisIntensity: number; // 0-1
}

const DEFAULT_OPTIONS: VoiceIntelligenceOptions = {
  enableSQLPronunciation: true,
  enableTechnicalTerms: true,
  enableSmartPausing: true,
  enableEmphasisDetection: true,
  enableContextAdaptation: true,
  pauseDuration: 800,
  emphasisIntensity: 0.3
};

class ContextAwareVoiceService {
  private pronunciationRules: PronunciationRule[] = [];
  private technicalTerms: Map<string, string> = new Map();
  private emphasisPatterns: RegExp[] = [];
  private pausePatterns: RegExp[] = [];

  constructor() {
    this.initializePronunciationRules();
    this.initializeTechnicalTerms();
    this.initializeEmphasisPatterns();
    this.initializePausePatterns();
  }

  /**
   * Initialize SQL and technical pronunciation rules
   */
  private initializePronunciationRules(): void {
    this.pronunciationRules = [
      // SQL Keywords
      { pattern: /\bSELECT\b/gi, replacement: 'SEL-ect', context: 'sql', priority: 1 },
      { pattern: /\bFROM\b/gi, replacement: 'FROM', context: 'sql', priority: 1 },
      { pattern: /\bWHERE\b/gi, replacement: 'WHERE', context: 'sql', priority: 1 },
      { pattern: /\bJOIN\b/gi, replacement: 'JOIN', context: 'sql', priority: 1 },
      { pattern: /\bINNER JOIN\b/gi, replacement: 'INNER JOIN', context: 'sql', priority: 1 },
      { pattern: /\bLEFT JOIN\b/gi, replacement: 'LEFT JOIN', context: 'sql', priority: 1 },
      { pattern: /\bRIGHT JOIN\b/gi, replacement: 'RIGHT JOIN', context: 'sql', priority: 1 },
      { pattern: /\bOUTER JOIN\b/gi, replacement: 'OUTER JOIN', context: 'sql', priority: 1 },
      { pattern: /\bGROUP BY\b/gi, replacement: 'GROUP BY', context: 'sql', priority: 1 },
      { pattern: /\bORDER BY\b/gi, replacement: 'ORDER BY', context: 'sql', priority: 1 },
      { pattern: /\bHAVING\b/gi, replacement: 'HAVING', context: 'sql', priority: 1 },
      { pattern: /\bDISTINCT\b/gi, replacement: 'DIS-tinct', context: 'sql', priority: 1 },
      { pattern: /\bUNION\b/gi, replacement: 'UN-ion', context: 'sql', priority: 1 },
      { pattern: /\bEXISTS\b/gi, replacement: 'EX-ists', context: 'sql', priority: 1 },
      { pattern: /\bIN\b/gi, replacement: 'IN', context: 'sql', priority: 1 },
      { pattern: /\bNOT IN\b/gi, replacement: 'NOT IN', context: 'sql', priority: 1 },
      { pattern: /\bBETWEEN\b/gi, replacement: 'BE-tween', context: 'sql', priority: 1 },
      { pattern: /\bLIKE\b/gi, replacement: 'LIKE', context: 'sql', priority: 1 },
      { pattern: /\bIS NULL\b/gi, replacement: 'IS NULL', context: 'sql', priority: 1 },
      { pattern: /\bIS NOT NULL\b/gi, replacement: 'IS NOT NULL', context: 'sql', priority: 1 },

      // SQL Functions
      { pattern: /\bCOUNT\b/gi, replacement: 'COUNT', context: 'sql', priority: 1 },
      { pattern: /\bSUM\b/gi, replacement: 'SUM', context: 'sql', priority: 1 },
      { pattern: /\bAVG\b/gi, replacement: 'AV-erage', context: 'sql', priority: 1 },
      { pattern: /\bMAX\b/gi, replacement: 'MAX', context: 'sql', priority: 1 },
      { pattern: /\bMIN\b/gi, replacement: 'MIN', context: 'sql', priority: 1 },
      { pattern: /\bROUND\b/gi, replacement: 'ROUND', context: 'sql', priority: 1 },
      { pattern: /\bUPPER\b/gi, replacement: 'UP-per', context: 'sql', priority: 1 },
      { pattern: /\bLOWER\b/gi, replacement: 'LOW-er', context: 'sql', priority: 1 },
      { pattern: /\bSUBSTRING\b/gi, replacement: 'SUB-string', context: 'sql', priority: 1 },
      { pattern: /\bCONCAT\b/gi, replacement: 'CON-cat', context: 'sql', priority: 1 },
      { pattern: /\bCOALESCE\b/gi, replacement: 'CO-alesce', context: 'sql', priority: 1 },
      { pattern: /\bCASE\b/gi, replacement: 'CASE', context: 'sql', priority: 1 },
      { pattern: /\bWHEN\b/gi, replacement: 'WHEN', context: 'sql', priority: 1 },
      { pattern: /\bTHEN\b/gi, replacement: 'THEN', context: 'sql', priority: 1 },
      { pattern: /\bELSE\b/gi, replacement: 'ELSE', context: 'sql', priority: 1 },
      { pattern: /\bEND\b/gi, replacement: 'END', context: 'sql', priority: 1 },

      // Technical Terms
      { pattern: /\bAPI\b/gi, replacement: 'A-P-I', context: 'technical', priority: 2 },
      { pattern: /\bSQL\b/gi, replacement: 'S-Q-L', context: 'technical', priority: 2 },
      { pattern: /\bMySQL\b/gi, replacement: 'MY-S-Q-L', context: 'technical', priority: 2 },
      { pattern: /\bPostgreSQL\b/gi, replacement: 'POST-gres-S-Q-L', context: 'technical', priority: 2 },
      { pattern: /\bJavaScript\b/gi, replacement: 'JA-va-script', context: 'technical', priority: 2 },
      { pattern: /\bTypeScript\b/gi, replacement: 'TYPE-script', context: 'technical', priority: 2 },
      { pattern: /\bJSON\b/gi, replacement: 'JAY-son', context: 'technical', priority: 2 },
      { pattern: /\bXML\b/gi, replacement: 'X-M-L', context: 'technical', priority: 2 },
      { pattern: /\bHTML\b/gi, replacement: 'H-T-M-L', context: 'technical', priority: 2 },
      { pattern: /\bCSS\b/gi, replacement: 'C-S-S', context: 'technical', priority: 2 },
      { pattern: /\bHTTP\b/gi, replacement: 'H-T-T-P', context: 'technical', priority: 2 },
      { pattern: /\bHTTPS\b/gi, replacement: 'H-T-T-P-S', context: 'technical', priority: 2 },
      { pattern: /\bURL\b/gi, replacement: 'U-R-L', context: 'technical', priority: 2 },
      { pattern: /\bURI\b/gi, replacement: 'U-R-I', context: 'technical', priority: 2 },
      { pattern: /\bREST\b/gi, replacement: 'REST', context: 'technical', priority: 2 },
      { pattern: /\bGraphQL\b/gi, replacement: 'GRAPH-Q-L', context: 'technical', priority: 2 },
      { pattern: /\bWebSocket\b/gi, replacement: 'WEB-socket', context: 'technical', priority: 2 },
      { pattern: /\bAJAX\b/gi, replacement: 'A-JAX', context: 'technical', priority: 2 },
      { pattern: /\bDOM\b/gi, replacement: 'D-O-M', context: 'technical', priority: 2 },
      { pattern: /\bBOM\b/gi, replacement: 'B-O-M', context: 'technical', priority: 2 },

      // Database Terms
      { pattern: /\bDatabase\b/gi, replacement: 'DATA-base', context: 'database', priority: 2 },
      { pattern: /\bSchema\b/gi, replacement: 'SKE-ma', context: 'database', priority: 2 },
      { pattern: /\bIndex\b/gi, replacement: 'IN-dex', context: 'database', priority: 2 },
      { pattern: /\bConstraint\b/gi, replacement: 'CON-straint', context: 'database', priority: 2 },
      { pattern: /\bTrigger\b/gi, replacement: 'TRIG-ger', context: 'database', priority: 2 },
      { pattern: /\bStored Procedure\b/gi, replacement: 'STORED pro-CE-dure', context: 'database', priority: 2 },
      { pattern: /\bView\b/gi, replacement: 'VIEW', context: 'database', priority: 2 },
      { pattern: /\bTransaction\b/gi, replacement: 'TRANS-action', context: 'database', priority: 2 },
      { pattern: /\bACID\b/gi, replacement: 'A-C-I-D', context: 'database', priority: 2 },
      { pattern: /\bNormalization\b/gi, replacement: 'NOR-mal-i-ZA-tion', context: 'database', priority: 2 },

      // Hebrew Technical Terms
      { pattern: /\bשאילתה\b/g, replacement: 'שאילתה', context: 'hebrew', priority: 1 },
      { pattern: /\bטבלה\b/g, replacement: 'טבלה', context: 'hebrew', priority: 1 },
      { pattern: /\bעמודה\b/g, replacement: 'עמודה', context: 'hebrew', priority: 1 },
      { pattern: /\bשורה\b/g, replacement: 'שורה', context: 'hebrew', priority: 1 },
      { pattern: /\bמסד נתונים\b/g, replacement: 'מסד נתונים', context: 'hebrew', priority: 1 },
      { pattern: /\bקובץ\b/g, replacement: 'קובץ', context: 'hebrew', priority: 1 },
      { pattern: /\bתיקייה\b/g, replacement: 'תיקייה', context: 'hebrew', priority: 1 },
    ];

    // Sort by priority (higher priority first)
    this.pronunciationRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Initialize technical terms dictionary
   */
  private initializeTechnicalTerms(): void {
    this.technicalTerms.set('API', 'Application Programming Interface');
    this.technicalTerms.set('SQL', 'Structured Query Language');
    this.technicalTerms.set('MySQL', 'My Structured Query Language');
    this.technicalTerms.set('PostgreSQL', 'Postgres Structured Query Language');
    this.technicalTerms.set('JSON', 'JavaScript Object Notation');
    this.technicalTerms.set('XML', 'eXtensible Markup Language');
    this.technicalTerms.set('HTML', 'HyperText Markup Language');
    this.technicalTerms.set('CSS', 'Cascading Style Sheets');
    this.technicalTerms.set('HTTP', 'HyperText Transfer Protocol');
    this.technicalTerms.set('HTTPS', 'HyperText Transfer Protocol Secure');
    this.technicalTerms.set('URL', 'Uniform Resource Locator');
    this.technicalTerms.set('URI', 'Uniform Resource Identifier');
    this.technicalTerms.set('REST', 'Representational State Transfer');
    this.technicalTerms.set('GraphQL', 'Graph Query Language');
    this.technicalTerms.set('WebSocket', 'Web Socket Protocol');
    this.technicalTerms.set('AJAX', 'Asynchronous JavaScript and XML');
    this.technicalTerms.set('DOM', 'Document Object Model');
    this.technicalTerms.set('BOM', 'Browser Object Model');
    this.technicalTerms.set('ACID', 'Atomicity, Consistency, Isolation, Durability');
  }

  /**
   * Initialize emphasis detection patterns
   */
  private initializeEmphasisPatterns(): void {
    this.emphasisPatterns = [
      // Bold text
      /\*\*(.*?)\*\*/g,
      // Italic text
      /\*(.*?)\*/g,
      // Important keywords
      /\b(important|critical|key|essential|crucial|vital|significant|major|primary|main)\b/gi,
      // SQL keywords that should be emphasized
      /\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|DISTINCT|UNION|EXISTS|IN|NOT IN|BETWEEN|LIKE)\b/gi,
      // Technical terms
      /\b(API|SQL|MySQL|PostgreSQL|JavaScript|TypeScript|JSON|XML|HTML|CSS|HTTP|HTTPS|URL|URI|REST|GraphQL)\b/gi,
      // Error messages
      /\b(error|warning|alert|caution|danger|problem|issue|bug|exception|failure)\b/gi,
      // Success messages
      /\b(success|correct|right|perfect|excellent|great|good|working|valid)\b/gi,
      // Numbers and percentages
      /\b\d+%?\b/g,
      // Code blocks
      /```[\s\S]*?```/g,
      // Inline code
      /`([^`]+)`/g,
    ];
  }

  /**
   * Initialize smart pause patterns
   */
  private initializePausePatterns(): void {
    this.pausePatterns = [
      // Sentence endings
      /[.!?]+\s+/g,
      // Paragraph breaks
      /\n\s*\n/g,
      // List items
      /\n\s*[-*+]\s+/g,
      // Numbered lists
      /\n\s*\d+\.\s+/g,
      // SQL clauses
      /\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|UNION|EXCEPT|INTERSECT)\b/gi,
      // Code blocks
      /```[\s\S]*?```/g,
      // Important transitions
      /\b(however|therefore|moreover|furthermore|additionally|consequently|meanwhile|nevertheless)\b/gi,
      // Hebrew sentence endings
      /[.!?]+\s+/g,
    ];
  }

  /**
   * Analyze text context and determine voice parameters
   */
  analyzeContext(text: string): VoiceContext {
    const context: VoiceContext = {
      contentType: 'general',
      complexity: 'beginner',
      language: 'en',
      technicalLevel: 'basic',
      emphasisWords: [],
      pausePoints: []
    };

    // Detect language
    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    context.language = hasHebrew ? 'he' : 'en';

    // Detect content type
    if (this.containsSQL(text)) {
      context.contentType = 'sql';
      context.technicalLevel = this.analyzeSQLComplexity(text);
    } else if (this.containsQuestions(text)) {
      context.contentType = 'question';
    } else if (this.containsFeedback(text)) {
      context.contentType = 'feedback';
    } else if (this.containsExplanations(text)) {
      context.contentType = 'explanation';
    }

    // Detect complexity level
    context.complexity = this.analyzeComplexity(text);

    // Find emphasis words
    context.emphasisWords = this.findEmphasisWords(text);

    // Find pause points
    context.pausePoints = this.findPausePoints(text);

    return context;
  }

  /**
   * Process text for voice synthesis with context awareness
   */
  processTextForVoice(text: string, context: VoiceContext, options: VoiceIntelligenceOptions = DEFAULT_OPTIONS): {
    processedText: string;
    voiceParameters: {
      speed: number;
      pitch: number;
      emotion: string;
      pausePoints: number[];
      emphasisPoints: number[];
    };
  } {
    let processedText = text;

    // Apply pronunciation rules
    if (options.enableSQLPronunciation || options.enableTechnicalTerms) {
      processedText = this.applyPronunciationRules(processedText, context);
    }

    // Add smart pauses
    if (options.enableSmartPausing) {
      processedText = this.addSmartPauses(processedText, context, options.pauseDuration);
    }

    // Add emphasis markers
    if (options.enableEmphasisDetection) {
      processedText = this.addEmphasisMarkers(processedText, context, options.emphasisIntensity);
    }

    // Calculate voice parameters based on context
    const voiceParameters = this.calculateVoiceParameters(context, options);

    return {
      processedText,
      voiceParameters
    };
  }

  /**
   * Apply pronunciation rules to text
   */
  private applyPronunciationRules(text: string, context: VoiceContext): string {
    let processedText = text;

    for (const rule of this.pronunciationRules) {
      // Apply rule based on context
      if (!rule.context || rule.context === context.contentType || rule.context === context.language) {
        processedText = processedText.replace(rule.pattern, rule.replacement);
      }
    }

    return processedText;
  }

  /**
   * Add smart pauses to text
   */
  private addSmartPauses(text: string, context: VoiceContext, pauseDuration: number): string {
    let processedText = text;

    // Add pauses at sentence endings
    processedText = processedText.replace(/[.!?]+\s+/g, (match) => {
      return match + `<break time="${pauseDuration}ms"/>`;
    });

    // Add longer pauses for paragraph breaks
    processedText = processedText.replace(/\n\s*\n/g, `<break time="${pauseDuration * 2}ms"/>`);

    // Add pauses before SQL clauses
    if (context.contentType === 'sql') {
      processedText = processedText.replace(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|UNION)\b/gi, (match) => {
        return `<break time="${pauseDuration / 2}ms"/>${match}`;
      });
    }

    return processedText;
  }

  /**
   * Add emphasis markers to text
   */
  private addEmphasisMarkers(text: string, context: VoiceContext, intensity: number): string {
    let processedText = text;

    // Add emphasis to SQL keywords
    if (context.contentType === 'sql') {
      processedText = processedText.replace(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|DISTINCT|UNION|EXISTS|IN|NOT IN|BETWEEN|LIKE)\b/gi, (match) => {
        return `<emphasis level="moderate">${match}</emphasis>`;
      });
    }

    // Add emphasis to technical terms
    processedText = processedText.replace(/\b(API|SQL|MySQL|PostgreSQL|JavaScript|TypeScript|JSON|XML|HTML|CSS|HTTP|HTTPS|URL|URI|REST|GraphQL)\b/gi, (match) => {
      return `<emphasis level="moderate">${match}</emphasis>`;
    });

    // Add emphasis to important words
    processedText = processedText.replace(/\b(important|critical|key|essential|crucial|vital|significant|major|primary|main|error|warning|success|correct|perfect|excellent)\b/gi, (match) => {
      return `<emphasis level="strong">${match}</emphasis>`;
    });

    return processedText;
  }

  /**
   * Calculate voice parameters based on context
   */
  private calculateVoiceParameters(context: VoiceContext, options: VoiceIntelligenceOptions): {
    speed: number;
    pitch: number;
    emotion: string;
    pausePoints: number[];
    emphasisPoints: number[];
  } {
    let speed = 0.95; // Default speed
    let pitch = 1.0; // Default pitch
    let emotion = 'neutral';

    // Adjust speed based on content type
    switch (context.contentType) {
      case 'sql':
        speed = 0.85; // Slower for SQL to allow processing
        emotion = 'focused';
        break;
      case 'explanation':
        speed = 0.90; // Slightly slower for explanations
        emotion = 'calm';
        break;
      case 'question':
        speed = 1.0; // Normal speed for questions
        emotion = 'curious';
        break;
      case 'feedback':
        speed = 0.95; // Normal speed for feedback
        emotion = 'encouraging';
        break;
      default:
        speed = 0.95;
        emotion = 'neutral';
    }

    // Adjust speed based on complexity
    switch (context.complexity) {
      case 'beginner':
        speed = Math.min(speed, 0.90); // Slower for beginners
        break;
      case 'intermediate':
        speed = speed; // Normal speed
        break;
      case 'advanced':
        speed = Math.max(speed, 1.0); // Faster for advanced
        break;
    }

    // Adjust for Hebrew content
    if (context.language === 'he') {
      speed = Math.min(speed, 0.90); // Slower for Hebrew
      pitch = 1.05; // Slightly higher pitch
    }

    return {
      speed,
      pitch,
      emotion,
      pausePoints: context.pausePoints || [],
      emphasisPoints: []
    };
  }

  /**
   * Check if text contains SQL
   */
  private containsSQL(text: string): boolean {
    const sqlKeywords = /\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|INDEX|TABLE|DATABASE|SCHEMA)\b/i;
    return sqlKeywords.test(text);
  }

  /**
   * Check if text contains questions
   */
  private containsQuestions(text: string): boolean {
    return /[?]/.test(text) || /\b(what|how|why|when|where|which|who|can|could|would|should|is|are|do|does|did)\b/i.test(text);
  }

  /**
   * Check if text contains feedback
   */
  private containsFeedback(text: string): boolean {
    const feedbackWords = /\b(good|great|excellent|perfect|correct|wrong|incorrect|error|mistake|try|attempt|success|failure|well done|nice work)\b/i;
    return feedbackWords.test(text);
  }

  /**
   * Check if text contains explanations
   */
  private containsExplanations(text: string): boolean {
    const explanationWords = /\b(explain|because|since|therefore|thus|hence|in other words|for example|for instance|such as|like|unlike|different from|similar to)\b/i;
    return explanationWords.test(text);
  }

  /**
   * Analyze SQL complexity
   */
  private analyzeSQLComplexity(text: string): 'basic' | 'intermediate' | 'advanced' {
    const basicKeywords = /\b(SELECT|FROM|WHERE|ORDER BY|GROUP BY)\b/gi;
    const intermediateKeywords = /\b(JOIN|HAVING|DISTINCT|UNION|SUBQUERY|VIEW)\b/gi;
    const advancedKeywords = /\b(WINDOW|RECURSIVE|CTE|PIVOT|UNPIVOT|MERGE|TRIGGER|STORED PROCEDURE|FUNCTION)\b/gi;

    const basicCount = (text.match(basicKeywords) || []).length;
    const intermediateCount = (text.match(intermediateKeywords) || []).length;
    const advancedCount = (text.match(advancedKeywords) || []).length;

    if (advancedCount > 0 || intermediateCount > 3) {
      return 'advanced';
    } else if (intermediateCount > 0 || basicCount > 5) {
      return 'intermediate';
    } else {
      return 'basic';
    }
  }

  /**
   * Analyze overall text complexity
   */
  private analyzeComplexity(text: string): 'beginner' | 'intermediate' | 'advanced' {
    const words = text.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const longWords = words.filter(word => word.length > 8).length;
    const technicalTerms = words.filter(word => this.technicalTerms.has(word.toUpperCase())).length;

    if (avgWordLength > 6 || longWords > words.length * 0.2 || technicalTerms > words.length * 0.1) {
      return 'advanced';
    } else if (avgWordLength > 4 || longWords > words.length * 0.1 || technicalTerms > words.length * 0.05) {
      return 'intermediate';
    } else {
      return 'beginner';
    }
  }

  /**
   * Find emphasis words in text
   */
  private findEmphasisWords(text: string): string[] {
    const emphasisWords: string[] = [];

    for (const pattern of this.emphasisPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        emphasisWords.push(...matches.map(match => match.replace(/[*/`]/g, '')));
      }
    }

    return Array.from(new Set(emphasisWords)); // Remove duplicates
  }

  /**
   * Find pause points in text
   */
  private findPausePoints(text: string): number[] {
    const pausePoints: number[] = [];
    let index = 0;

    for (const pattern of this.pausePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        pausePoints.push(match.index);
      }
    }

    return pausePoints.sort((a, b) => a - b);
  }

  /**
   * Get pronunciation for a technical term
   */
  getTechnicalTermPronunciation(term: string): string {
    return this.technicalTerms.get(term.toUpperCase()) || term;
  }

  /**
   * Add custom pronunciation rule
   */
  addPronunciationRule(pattern: RegExp, replacement: string, context?: string, priority: number = 1): void {
    this.pronunciationRules.push({ pattern, replacement, context, priority });
    this.pronunciationRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Add custom technical term
   */
  addTechnicalTerm(term: string, pronunciation: string): void {
    this.technicalTerms.set(term.toUpperCase(), pronunciation);
  }
}

// Export singleton instance
export const contextAwareVoice = new ContextAwareVoiceService();

// Utility function for easy usage
export function processTextWithContextAwareness(
  text: string,
  options: VoiceIntelligenceOptions = DEFAULT_OPTIONS
): {
  processedText: string;
  voiceParameters: {
    speed: number;
    pitch: number;
    emotion: string;
    pausePoints: number[];
    emphasisPoints: number[];
  };
  context: VoiceContext;
} {
  const context = contextAwareVoice.analyzeContext(text);
  const result = contextAwareVoice.processTextForVoice(text, context, options);
  
  return {
    ...result,
    context
  };
}
