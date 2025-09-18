"use client";

import React from 'react';
import styles from './SecurityAlert.module.css';

export interface SecurityAlertProps {
  type: 'ip_mismatch' | 'fingerprint_mismatch' | 'active_session' | 'network_error' | 'general_error';
  message?: string;
  details?: {
    originalIp?: string;
    currentIp?: string;
    startTime?: string;
    examId?: string;
  };
  onClose?: () => void;
  onContactAdmin?: () => void;
}

export const SecurityAlert: React.FC<SecurityAlertProps> = ({ 
  type, 
  message, 
  details, 
  onClose, 
  onContactAdmin 
}) => {
  const getAlertContent = () => {
    switch (type) {
      case 'ip_mismatch':
        return {
          title: '🚫 זוהה שינוי מיקום',
          description: 'התחברת מכתובת IP שונה מזו שבה התחלת את הבחינה.',
          explanation: `
            כתובת IP מקורית: ${details?.originalIp || 'לא זמינה'}
            כתובת IP נוכחית: ${details?.currentIp || 'לא זמינה'}
            
            זהו מנגנון אבטחה למניעת התחזות. אם הגישה חוקית (למשל בשל בעיית רשת), 
            פנה למנהל הבחינה מיד.
          `,
          severity: 'high'
        };

      case 'fingerprint_mismatch':
        return {
          title: '🔍 זוהה שינוי בדפדפן',
          description: 'מזהה הדפדפן שונה מזה שבו התחלת את הבחינה.',
          explanation: `
            יתכן שהסיבה היא:
            • שינוי בדפדפן או במכשיר
            • ניקוי עוגיות או היסטוריה
            • שימוש במכשיר אחר
            
            אם לא ביצעת שינויים במכשיר, פנה למנהל הבחינה.
          `,
          severity: 'medium'
        };

      case 'active_session':
        return {
          title: '⚠️ זוהתה בחינה פעילה',
          description: 'יש לך כבר בחינה פעילה במערכת.',
          explanation: `
            תאריך התחלה: ${details?.startTime ? new Date(details.startTime).toLocaleString('he-IL') : 'לא זמין'}
            מזהה בחינה: ${details?.examId || 'לא זמין'}
            
            אם זוהי בחינה שאתה אמור להמשיך, בחר "המשך בחינה".
            אם זו בחינה ישנה או שגויה, פנה למנהל הבחינה.
          `,
          severity: 'medium'
        };

      case 'network_error':
        return {
          title: '🌐 בעיית תקשורת',
          description: 'לא ניתן להתחבר לשרת הבחינות.',
          explanation: `
            • בדוק את החיבור לאינטרנט
            • נסה לרענן את הדף
            • אם הבעיה נמשכת, פנה למנהל הבחינה
          `,
          severity: 'low'
        };

      default:
        return {
          title: '❌ שגיאת אבטחה',
          description: message || 'אירעה שגיאה לא צפויה במערכת האבטחה.',
          explanation: 'פנה למנהל הבחינה לקבלת סיוע.',
          severity: 'medium'
        };
    }
  };

  const alertContent = getAlertContent();

  return (
    <div className={`${styles.alertOverlay} ${styles[alertContent.severity]}`}>
      <div className={styles.alertDialog}>
        <div className={styles.alertHeader}>
          <h2 className={styles.alertTitle}>{alertContent.title}</h2>
          {onClose && (
            <button className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        
        <div className={styles.alertBody}>
          <p className={styles.alertDescription}>
            {alertContent.description}
          </p>
          
          <div className={styles.alertExplanation}>
            {alertContent.explanation.split('\n').map((line, index) => (
              <p key={index} className={styles.explanationLine}>
                {line.trim()}
              </p>
            ))}
          </div>
        </div>
        
        <div className={styles.alertActions}>
          {type === 'active_session' && (
            <button className={styles.primaryButton}>
              המשך בחינה קיימת
            </button>
          )}
          
          {type === 'network_error' && (
            <button 
              className={styles.primaryButton}
              onClick={() => window.location.reload()}
            >
              רענן דף
            </button>
          )}
          
          <button 
            className={styles.secondaryButton}
            onClick={onContactAdmin}
          >
            פנה למנהל הבחינה
          </button>
          
          {onClose && (
            <button 
              className={styles.tertiaryButton}
              onClick={onClose}
            >
              סגור
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 