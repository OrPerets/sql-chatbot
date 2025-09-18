import { generateBrowserFingerprint, BrowserFingerprint } from './browserFingerprint';
import config from '../config';

const SERVER_BASE = config.serverUrl;

export interface ExamSecurityInfo {
  studentId: string;
  examId: string;
  startTime: string;
  browserFingerprint: BrowserFingerprint;
}

export interface ValidationResult {
  allowed: boolean;
  reason: string;
  message?: string;
  existingSession?: any;
}

export class ExamSecurity {
  private static readonly STORAGE_KEY = 'exam_security_info';

  static saveExamInfo(info: ExamSecurityInfo): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(info));
    } catch (error) {
      console.warn('Failed to save exam info to localStorage:', error);
    }
  }

  static getExamInfo(): ExamSecurityInfo | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to get exam info from localStorage:', error);
      return null;
    }
  }

  static clearExamInfo(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear exam info from localStorage:', error);
    }
  }

  static async validateExamAccess(studentId: string): Promise<ValidationResult> {
    const currentFingerprint = generateBrowserFingerprint();
    const storedInfo = this.getExamInfo();

    try {
      // Check with server for any existing sessions
      const response = await fetch(`${SERVER_BASE}/exam/validate-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          browserFingerprint: currentFingerprint
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          allowed: false,
          reason: result.reason || 'unknown_error',
          message: result.message || 'שגיאה בבדיקת הגישה'
        };
      }

      // If we have stored info, compare with current state
      if (storedInfo) {
        // Check if stored exam matches current student
        if (storedInfo.studentId !== studentId) {
          console.warn('Student ID mismatch in stored exam info');
          this.clearExamInfo();
        } else {
          // Update stored info with current session if valid reconnection
          if (result.allowed && result.existingSession) {
            this.saveExamInfo({
              studentId,
              examId: result.existingSession._id,
              startTime: result.existingSession.startTime,
              browserFingerprint: currentFingerprint
            });
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error validating exam access:', error);
      return {
        allowed: false,
        reason: 'network_error',
        message: 'שגיאת רשת. בדוק את החיבור לאינטרנט.'
      };
    }
  }

  static async checkForActiveSession(studentId: string): Promise<ValidationResult> {
    try {
      const response = await fetch(`${SERVER_BASE}/exam/check-session/${studentId}`);
      const result = await response.json();

      if (response.ok && result.hasActiveSession) {
        return {
          allowed: false,
          reason: 'active_session_detected',
          message: 'זוהתה בחינה פעילה. האם תרצה להמשיך את הבחינה הקיימת?',
          existingSession: result.session
        };
      }

      return {
        allowed: true,
        reason: 'no_active_session'
      };
    } catch (error) {
      console.error('Error checking for active session:', error);
      return {
        allowed: true,
        reason: 'check_failed'
      };
    }
  }

  static initializeExamSecurity(studentId: string, examId: string): void {
    const browserFingerprint = generateBrowserFingerprint();
    this.saveExamInfo({
      studentId,
      examId,
      startTime: new Date().toISOString(),
      browserFingerprint
    });
  }

  static isSecureEnvironment(): { secure: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    // Check if running in private/incognito mode
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        if (estimate.quota && estimate.quota < 120000000) { // Less than ~120MB suggests incognito
          warnings.push('הדפדפן פועל במצב פרטי. ייתכן שהבחינה לא תעבוד כראוי.');
        }
      });
    }

    // Check for developer tools (basic check)
    const threshold = 160;
    if (window.outerHeight - window.innerHeight > threshold || 
        window.outerWidth - window.innerWidth > threshold) {
      warnings.push('זוהו כלי פיתוח פתוחים. אנא סגור אותם לפני המשך הבחינה.');
    }

    return {
      secure: warnings.length === 0,
      warnings
    };
  }
} 