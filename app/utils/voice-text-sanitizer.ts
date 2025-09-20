/**
 * Voice Text Sanitizer
 * Cleans and sanitizes text for TTS by removing technical formatting and unwanted content
 */

export interface SanitizationConfig {
  removeSSMLTags: boolean;
  removeHTMLTags: boolean;
  removeMarkdownFormatting: boolean;
  removeTechnicalFormatting: boolean;
  removeTimestamps: boolean;
  removeDebugInfo: boolean;
  removeCodeBlocks: boolean;
  removeUrls: boolean;
  removeEmails: boolean;
  removeSpecialCharacters: boolean;
  normalizeWhitespace: boolean;
  preserveNumbers: boolean;
  preservePunctuation: boolean;
  maxLength: number;
}

export interface SanitizationResult {
  sanitizedText: string;
  removedElements: Array<{
    type: string;
    content: string;
    position: number;
  }>;
  statistics: {
    originalLength: number;
    sanitizedLength: number;
    reductionPercentage: number;
    removedCount: number;
  };
}

const DEFAULT_CONFIG: SanitizationConfig = {
  removeSSMLTags: true,
  removeHTMLTags: true,
  removeMarkdownFormatting: true,
  removeTechnicalFormatting: true,
  removeTimestamps: true,
  removeDebugInfo: true,
  removeCodeBlocks: true,
  removeUrls: true,
  removeEmails: true,
  removeSpecialCharacters: false,
  normalizeWhitespace: true,
  preserveNumbers: true,
  preservePunctuation: true,
  maxLength: 5000
};

export class VoiceTextSanitizer {
  private config: SanitizationConfig;
  private removedElements: Array<{ type: string; content: string; position: number }> = [];

  constructor(config: Partial<SanitizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Sanitize text for voice synthesis
   */
  sanitizeText(text: string): SanitizationResult {
    this.removedElements = [];
    let sanitizedText = text;

    // Remove SSML tags (Speech Synthesis Markup Language)
    if (this.config.removeSSMLTags) {
      sanitizedText = this.removeSSMLTags(sanitizedText);
    }

    // Remove HTML tags
    if (this.config.removeHTMLTags) {
      sanitizedText = this.removeHTMLTags(sanitizedText);
    }

    // Remove markdown formatting
    if (this.config.removeMarkdownFormatting) {
      sanitizedText = this.removeMarkdownFormatting(sanitizedText);
    }

    // Remove technical formatting
    if (this.config.removeTechnicalFormatting) {
      sanitizedText = this.removeTechnicalFormatting(sanitizedText);
    }

    // Remove timestamps
    if (this.config.removeTimestamps) {
      sanitizedText = this.removeTimestamps(sanitizedText);
    }

    // Remove debug information
    if (this.config.removeDebugInfo) {
      sanitizedText = this.removeDebugInfo(sanitizedText);
    }

    // Remove code blocks
    if (this.config.removeCodeBlocks) {
      sanitizedText = this.removeCodeBlocks(sanitizedText);
    }

    // Remove URLs
    if (this.config.removeUrls) {
      sanitizedText = this.removeUrls(sanitizedText);
    }

    // Remove email addresses
    if (this.config.removeEmails) {
      sanitizedText = this.removeEmails(sanitizedText);
    }

    // Remove special characters
    if (this.config.removeSpecialCharacters) {
      sanitizedText = this.removeSpecialCharacters(sanitizedText);
    }

    // Normalize whitespace
    if (this.config.normalizeWhitespace) {
      sanitizedText = this.normalizeWhitespace(sanitizedText);
    }

    // Truncate if too long
    if (sanitizedText.length > this.config.maxLength) {
      sanitizedText = this.truncateText(sanitizedText);
    }

    const statistics = {
      originalLength: text.length,
      sanitizedLength: sanitizedText.length,
      reductionPercentage: ((text.length - sanitizedText.length) / text.length) * 100,
      removedCount: this.removedElements.length
    };

    return {
      sanitizedText,
      removedElements: [...this.removedElements],
      statistics
    };
  }

  /**
   * Remove SSML tags
   */
  private removeSSMLTags(text: string): string {
    const ssmlPatterns = [
      // Break tags
      /<break\s+time="\d+ms"\/?>/gi,
      /<break\s+strength="\w+"\/?>/gi,
      /<break\/?>/gi,
      
      // Emphasis tags
      /<emphasis\s+level="\w+"\/?>(.*?)<\/emphasis>/gi,
      /<emphasis\/?>(.*?)<\/emphasis>/gi,
      
      // Prosody tags
      /<prosody\s+rate="[\d.]+"\/?>(.*?)<\/prosody>/gi,
      /<prosody\s+pitch="[\d.]+"\/?>(.*?)<\/prosody>/gi,
      /<prosody\s+volume="[\d.]+"\/?>(.*?)<\/prosody>/gi,
      
      // Say-as tags
      /<say-as\s+interpret-as="\w+"\/?>(.*?)<\/say-as>/gi,
      
      // Audio tags
      /<audio\s+src="[^"]*"\/?>/gi,
      
      // Mark tags
      /<mark\s+name="[^"]*"\/?>/gi,
      
      // P tags
      /<p\/?>(.*?)<\/p>/gi,
      
      // S tags
      /<s\/?>(.*?)<\/s>/gi,
      
      // Voice tags
      /<voice\s+name="[^"]*"\/?>(.*?)<\/voice>/gi,
      
      // Lang tags
      /<lang\s+xml:lang="[^"]*"\/?>(.*?)<\/lang>/gi,
      
      // Sub tags
      /<sub\s+alias="[^"]*"\/?>(.*?)<\/sub>/gi,
      
      // All other SSML tags
      /<\/?[^>]+>/g
    ];

    return this.removePatterns(text, ssmlPatterns, 'SSML tag');
  }

  /**
   * Remove HTML tags
   */
  private removeHTMLTags(text: string): string {
    const htmlPatterns = [
      // Common HTML tags
      /<\/?[^>]+>/g,
      
      // HTML entities
      /&[a-zA-Z][a-zA-Z0-9]*;/g,
      /&#\d+;/g,
      /&#x[0-9a-fA-F]+;/g
    ];

    return this.removePatterns(text, htmlPatterns, 'HTML tag');
  }

  /**
   * Remove markdown formatting
   */
  private removeMarkdownFormatting(text: string): string {
    const markdownPatterns = [
      // Bold and italic
      /\*\*(.*?)\*\*/g,
      /\*(.*?)\*/g,
      /__(.*?)__/g,
      /_(.*?)_/g,
      
      // Code blocks
      /```[\s\S]*?```/g,
      /`([^`]+)`/g,
      
      // Headers
      /^#{1,6}\s+/gm,
      
      // Links
      /\[([^\]]+)\]\([^)]+\)/g,
      /\[([^\]]+)\]\[[^\]]*\]/g,
      
      // Images
      /!\[([^\]]*)\]\([^)]+\)/g,
      
      // Lists
      /^[\s]*[-*+]\s+/gm,
      /^[\s]*\d+\.\s+/gm,
      
      // Blockquotes
      /^>\s*/gm,
      
      // Horizontal rules
      /^[\s]*[-*_]{3,}[\s]*$/gm,
      
      // Strikethrough
      /~~(.*?)~~/g,
      
      // Tables (basic)
      /\|.*\|/g,
      
      // Line breaks
      /  $/gm
    ];

    return this.removePatterns(text, markdownPatterns, 'Markdown formatting');
  }

  /**
   * Remove technical formatting
   */
  private removeTechnicalFormatting(text: string): string {
    const technicalPatterns = [
      // Break time references
      /\bbreak time\b/gi,
      /\bms\b/gi,
      /\bspace\b/gi,
      
      // Technical annotations
      /\b\([^)]*\)/g, // Parenthetical technical notes
      /\[[^\]]*\]/g, // Square bracket annotations
      
      // File paths
      /\b[A-Za-z]:\\[^\s]*/g,
      /\b\/[^\s]*/g,
      
      // Version numbers
      /\bv?\d+\.\d+\.\d+[^\s]*/g,
      
      // Technical IDs
      /\b[A-Z]{2,}_[A-Z0-9_]+/g,
      /\b[A-Z]{2,}-[A-Z0-9-]+/g,
      
      // Debug output
      /\bDEBUG:\s*/gi,
      /\bINFO:\s*/gi,
      /\bWARN:\s*/gi,
      /\bERROR:\s*/gi,
      
      // Console output
      /\bconsole\.(log|error|warn|info)\b/gi,
      
      // Function calls in text
      /\b\w+\([^)]*\)/g,
      
      // Variable references
      /\$\w+/g,
      /\bthis\.\w+/g,
      
      // Technical units
      /\b\d+\s*(px|em|rem|pt|pc|in|cm|mm|ex|ch|vw|vh|vmin|vmax|%)/gi,
      
      // Technical keywords that shouldn't be spoken
      /\b(break time|ms|space|tab|newline|carriage return|line feed)\b/gi,
      
      // Performance metrics
      /\b\d+\.\d+\s*(ms|s|seconds?|milliseconds?|nanoseconds?|microseconds?)/gi,
      
      // Memory references
      /\b\d+\s*(KB|MB|GB|TB|bytes?|kilobytes?|megabytes?|gigabytes?|terabytes?)/gi,
      
      // Technical status messages
      /\b(status|state|mode|level|type|kind|version|build|release)\s*:\s*[^\s,]+/gi
    ];

    return this.removePatterns(text, technicalPatterns, 'Technical formatting');
  }

  /**
   * Remove timestamps
   */
  private removeTimestamps(text: string): string {
    const timestampPatterns = [
      // Various timestamp formats
      /\b\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/gi,
      /\b\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/g,
      /\b\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/g,
      /\b\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}/g,
      
      // Relative time
      /\b\d+\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b/gi,
      /\bin\s+\d+\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/gi,
      
      // Duration
      /\b\d+:\d{2}:\d{2}\b/g,
      /\b\d+\.\d+\s*(s|seconds?|sec)\b/gi,
      
      // Unix timestamps
      /\b\d{10,13}\b/g
    ];

    return this.removePatterns(text, timestampPatterns, 'Timestamp');
  }

  /**
   * Remove debug information
   */
  private removeDebugInfo(text: string): string {
    const debugPatterns = [
      // Debug prefixes
      /\b(DEBUG|INFO|WARN|ERROR|FATAL|TRACE)\s*:\s*/gi,
      
      // Log levels
      /\b(log|debug|info|warn|error|fatal|trace)\s*level\s*:\s*\w+/gi,
      
      // Stack traces
      /\bat\s+[^\s]+\s+\([^)]+\)/g,
      /\bStack trace:\s*/gi,
      /\bCaused by:\s*/gi,
      
      // Process information
      /\bPID\s*:\s*\d+/gi,
      /\bThread\s*:\s*[^\s]+/gi,
      /\bProcess\s*:\s*[^\s]+/gi,
      
      // Memory information
      /\bHeap\s*:\s*[^\s]+/gi,
      /\bMemory\s*:\s*[^\s]+/gi,
      
      // Performance metrics
      /\bElapsed\s*time\s*:\s*[^\s]+/gi,
      /\bExecution\s*time\s*:\s*[^\s]+/gi,
      /\bResponse\s*time\s*:\s*[^\s]+/gi,
      
      // Technical identifiers
      /\bRequest\s*ID\s*:\s*[^\s]+/gi,
      /\bSession\s*ID\s*:\s*[^\s]+/gi,
      /\bUser\s*ID\s*:\s*[^\s]+/gi,
      /\bCorrelation\s*ID\s*:\s*[^\s]+/gi,
      
      // Environment information
      /\bEnvironment\s*:\s*[^\s]+/gi,
      /\bHost\s*:\s*[^\s]+/gi,
      /\bPort\s*:\s*\d+/gi,
      
      // Technical flags
      /\b(flag|option|setting|config|parameter)\s*:\s*[^\s,]+/gi
    ];

    return this.removePatterns(text, debugPatterns, 'Debug information');
  }

  /**
   * Remove code blocks
   */
  private removeCodeBlocks(text: string): string {
    const codePatterns = [
      // Fenced code blocks
      /```[\s\S]*?```/g,
      /~~~[\s\S]*?~~~/g,
      
      // Inline code
      /`([^`]+)`/g,
      
      // Code-like patterns
      /\b[A-Z_][A-Z0-9_]*(\([^)]*\))?/g, // CONSTANTS and functions
      /\b[a-z][a-zA-Z0-9]*\([^)]*\)/g, // function calls
      
      // JSON-like structures
      /\{[^}]*\}/g,
      /\[[^\]]*\]/g,
      
      // SQL-like patterns (but preserve the actual SQL content)
      /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+[^;]+;/gi,
      
      // File extensions
      /\.[a-zA-Z0-9]+/g,
      
      // Technical syntax
      /[{}[\]();]/g,
      /[=<>!&|]+/g,
      /\b(and|or|not|xor)\b/gi
    ];

    return this.removePatterns(text, codePatterns, 'Code block');
  }

  /**
   * Remove URLs
   */
  private removeUrls(text: string): string {
    const urlPatterns = [
      // HTTP/HTTPS URLs
      /https?:\/\/[^\s]+/gi,
      
      // FTP URLs
      /ftp:\/\/[^\s]+/gi,
      
      // File URLs
      /file:\/\/[^\s]+/gi,
      
      // Protocol-relative URLs
      /\/\/[^\s]+/gi,
      
      // Domain names
      /\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi,
      
      // IP addresses
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?(?:\/[^\s]*)?/gi
    ];

    return this.removePatterns(text, urlPatterns, 'URL');
  }

  /**
   * Remove email addresses
   */
  private removeEmails(text: string): string {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    return this.removePatterns(text, [emailPattern], 'Email address');
  }

  /**
   * Remove special characters
   */
  private removeSpecialCharacters(text: string): string {
    // Keep basic punctuation and numbers if configured
    let pattern = /[^\w\s]/g;
    
    if (this.config.preservePunctuation) {
      pattern = /[^\w\s.,!?;:'"()-]/g;
    }
    
    if (this.config.preserveNumbers) {
      pattern = /[^\w\s\d.,!?;:'"()-]/g;
    }

    return text.replace(pattern, ' ');
  }

  /**
   * Normalize whitespace
   */
  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
      .trim(); // Remove leading/trailing whitespace
  }

  /**
   * Truncate text if too long
   */
  private truncateText(text: string): string {
    if (text.length <= this.config.maxLength) {
      return text;
    }

    // Try to truncate at a sentence boundary
    const truncated = text.substring(0, this.config.maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > this.config.maxLength * 0.8) {
      return truncated.substring(0, lastSentence + 1);
    }
    
    // If no good sentence boundary, truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > this.config.maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Remove patterns and track removed elements
   */
  private removePatterns(text: string, patterns: RegExp[], elementType: string): string {
    let result = text;
    
    patterns.forEach(pattern => {
      const matches = result.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const position = result.indexOf(match);
          this.removedElements.push({
            type: elementType,
            content: match,
            position
          });
        });
      }
      result = result.replace(pattern, ' ');
    });
    
    return result;
  }

  /**
   * Get sanitization statistics
   */
  getStatistics(): {
    totalElementsRemoved: number;
    elementsByType: Record<string, number>;
    commonRemovedElements: Array<{ content: string; count: number }>;
  } {
    const elementsByType: Record<string, number> = {};
    const elementCounts: Record<string, number> = {};

    this.removedElements.forEach(element => {
      elementsByType[element.type] = (elementsByType[element.type] || 0) + 1;
      elementCounts[element.content] = (elementCounts[element.content] || 0) + 1;
    });

    const commonRemovedElements = Object.entries(elementCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([content, count]) => ({ content, count }));

    return {
      totalElementsRemoved: this.removedElements.length,
      elementsByType,
      commonRemovedElements
    };
  }

  /**
   * Create a sanitizer with custom configuration
   */
  static create(config: Partial<SanitizationConfig> = {}): VoiceTextSanitizer {
    return new VoiceTextSanitizer(config);
  }

  /**
   * Quick sanitize function for simple use cases
   */
  static quickSanitize(text: string): string {
    const sanitizer = new VoiceTextSanitizer();
    return sanitizer.sanitizeText(text).sanitizedText;
  }
}

// Export singleton instance
export const voiceTextSanitizer = new VoiceTextSanitizer();

// Utility function for easy usage
export function sanitizeTextForVoice(text: string, config?: Partial<SanitizationConfig>): string {
  const sanitizer = config ? new VoiceTextSanitizer(config) : voiceTextSanitizer;
  return sanitizer.sanitizeText(text).sanitizedText;
}

export default VoiceTextSanitizer;
