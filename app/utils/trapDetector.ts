export interface TrapDetection {
  isAISuspicious: boolean;
  suspicionScore: number; // 0-100
  triggeredTraps: TrapTrigger[];
  summary: string;
}

export interface TrapTrigger {
  trapType: string;
  description: string;
  pattern: string;
  severity: 'low' | 'medium' | 'high';
  matches: string[];
}

interface TrapPattern {
  name: string;
  description: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high';
  points: number;
}

const TRAP_PATTERNS: TrapPattern[] = [
  // Non-existent fields in Missions table
  {
    name: 'missions_weapon_id',
    description: 'שימוש בשדה weapon_id בטבלת Missions (לא קיים)',
    pattern: /missions?\s*\.\s*weapon_id|weapon_id\s+from\s+missions?/gi,
    severity: 'high',
    points: 25
  },
  
  // Fake MissionAnalytics table
  {
    name: 'mission_analytics_table',
    description: 'התייחסות לטבלת MissionAnalytics (טבלה פיקטיבית)',
    pattern: /missionanalytics|mission_analytics|FROM\s+MissionAnalytics|JOIN\s+MissionAnalytics/gi,
    severity: 'high',
    points: 30
  },
  
  // Wrong relationship: Weapons.squadron_id
  {
    name: 'weapons_squadron_id',
    description: 'שימוש ב-squadron_id בטבלת Weapons (קשר שגוי)',
    pattern: /weapons?\s*\.\s*squadron_id|squadron_id\s+from\s+weapons?/gi,
    severity: 'high',
    points: 25
  },
  
  // weapon_effectiveness in wrong context
  {
    name: 'weapon_effectiveness_wrong_table',
    description: 'שימוש ב-weapon_effectiveness בטבלה שגויה',
    pattern: /missions?\s*\.\s*weapon_effectiveness|pilots?\s*\.\s*weapon_effectiveness/gi,
    severity: 'medium',
    points: 20
  },
  
  // Wrong table name: Weapon instead of Weapons
  {
    name: 'weapon_singular',
    description: 'שימוש בשם טבלה שגוי "Weapon" במקום "Weapons"',
    pattern: /FROM\s+Weapon(?!s)|JOIN\s+Weapon(?!s)|UPDATE\s+Weapon(?!s)|INSERT\s+INTO\s+Weapon(?!s)/gi,
    severity: 'medium',
    points: 15
  },
  
  // Generic AI patterns
  {
    name: 'ai_generic_joins',
    description: 'דפוסי JOIN טיפוסיים של AI עם שדות לא קיימים',
    pattern: /JOIN\s+\w+\s+ON\s+\w+\.weapon_id\s*=\s*\w+\.weapon_id/gi,
    severity: 'medium',
    points: 15
  },
  
  // Non-existent fields patterns
  {
    name: 'non_existent_fields',
    description: 'שדות לא קיימים במסד הנתונים',
    pattern: /mission_type_id|weapon_category|pilot_rank_id|squadron_base_id/gi,
    severity: 'medium',
    points: 18
  },
  
  // Common AI SQL mistakes
  {
    name: 'ai_sql_patterns',
    description: 'דפוסי SQL אופייניים לכתיבת AI',
    pattern: /SELECT\s+\*\s+FROM\s+\w+\s+WHERE\s+\w+\.weapon_id\s*=|ORDER\s+BY\s+weapon_effectiveness\s+DESC/gi,
    severity: 'low',
    points: 10
  },
  
  // Suspicious field combinations
  {
    name: 'suspicious_combinations',
    description: 'צירופי שדות חשודים',
    pattern: /weapon_id\s*,\s*mission_id\s*,\s*effectiveness|squadron_id\s*,\s*weapon_type/gi,
    severity: 'medium',
    points: 15
  }
];

/**
 * Analyzes text to detect potential AI-generated content based on trap triggers
 * @param text - The text to analyze (usually student's SQL answer)
 * @returns TrapDetection object with analysis results
 */
export function detectAITraps(text: string): TrapDetection {
  if (!text || text.trim().length === 0) {
    return {
      isAISuspicious: false,
      suspicionScore: 0,
      triggeredTraps: [],
      summary: 'אין תוכן לניתוח'
    };
  }

  const triggeredTraps: TrapTrigger[] = [];
  let totalScore = 0;

  // Test each pattern against the text
  TRAP_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern.pattern);
    if (matches && matches.length > 0) {
      // Remove duplicates
      const uniqueMatches = Array.from(new Set(matches));
      
      triggeredTraps.push({
        trapType: pattern.name,
        description: pattern.description,
        pattern: pattern.pattern.source,
        severity: pattern.severity,
        matches: uniqueMatches
      });

      // Add points based on number of matches and severity
      totalScore += pattern.points * Math.min(uniqueMatches.length, 3); // Cap at 3 matches per pattern
    }
  });

  // Calculate final suspicion score (0-100)
  const suspicionScore = Math.min(Math.round(totalScore), 100);
  const isAISuspicious = suspicionScore >= 20; // Threshold for marking as suspicious

  // Generate summary
  let summary = '';
  if (triggeredTraps.length === 0) {
    summary = 'לא נמצאו סימני AI';
  } else if (suspicionScore >= 70) {
    summary = `חשוד מאוד ב-AI (${triggeredTraps.length} מלכודות)`;
  } else if (suspicionScore >= 40) {
    summary = `חשוד ב-AI (${triggeredTraps.length} מלכודות)`;
  } else {
    summary = `חשד נמוך ב-AI (${triggeredTraps.length} מלכודות)`;
  }

  return {
    isAISuspicious,
    suspicionScore,
    triggeredTraps,
    summary
  };
}

/**
 * Analyzes all answers in an exam session for AI indicators
 * @param answers - Array of student answers
 * @returns Overall analysis with individual answer details
 */
export function analyzeExamForAI(answers: { questionIndex: number; studentAnswer: string }[]) {
  const answerAnalyses = answers.map(answer => ({
    questionIndex: answer.questionIndex,
    analysis: detectAITraps(answer.studentAnswer)
  }));

  const totalSuspiciousAnswers = answerAnalyses.filter(a => a.analysis.isAISuspicious).length;
  const averageSuspicionScore = answerAnalyses.reduce((sum, a) => sum + a.analysis.suspicionScore, 0) / answers.length;
  const maxSuspicionScore = Math.max(...answerAnalyses.map(a => a.analysis.suspicionScore));

  // Overall exam suspicion logic
  const isExamSuspicious = totalSuspiciousAnswers >= 2 || maxSuspicionScore >= 50 || averageSuspicionScore >= 30;

  return {
    isExamSuspicious,
    totalSuspiciousAnswers,
    averageSuspicionScore: Math.round(averageSuspicionScore),
    maxSuspicionScore,
    answerAnalyses,
    summary: isExamSuspicious 
      ? `${totalSuspiciousAnswers} תשובות חשודות מתוך ${answers.length}`
      : 'בחינה לא חשודה'
  };
}

/**
 * Get a color class based on suspicion score for UI styling
 */
export function getSuspicionColor(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Get an appropriate icon name based on suspicion level
 */
export function getSuspicionIcon(score: number): string {
  if (score >= 70) return 'AlertTriangle';
  if (score >= 40) return 'AlertCircle';
  if (score >= 20) return 'Info';
  return 'CheckCircle';
} 