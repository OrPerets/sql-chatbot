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
  // 🪤 1. Non-existent fields in Missions table
  {
    name: 'missions_weapon_id',
    description: 'שימוש בשדה weapon_id בטבלת Missions (לא קיים)',
    pattern: /missions?\s*\.\s*weapon_id|weapon_id\s+from\s+missions?|missions?\s+.*weapon_id/gi,
    severity: 'high',
    points: 30
  },
  
  // 🪤 2. Fake MissionAnalytics table and its fields
  {
    name: 'mission_analytics_table',
    description: 'התייחסות לטבלת MissionAnalytics (טבלה פיקטיבית)',
    pattern: /missionanalytics|mission_analytics|FROM\s+MissionAnalytics|JOIN\s+MissionAnalytics/gi,
    severity: 'high',
    points: 35
  },
  {
    name: 'mission_analytics_fields',
    description: 'שימוש בשדות פיקטיביים מטבלת MissionAnalytics',
    pattern: /duration_minutes|fuel_consumption|weapon_effectiveness.*mission/gi,
    severity: 'high',
    points: 25
  },
  
  // 🪤 3. Wrong relationship: Weapons.squadron_id
  {
    name: 'weapons_squadron_id',
    description: 'שימוש ב-squadron_id בטבלת Weapons (קשר שגוי)',
    pattern: /weapons?\s*\.\s*squadron_id|squadron_id\s+from\s+weapons?|JOIN\s+.*weapons?.*squadron_id/gi,
    severity: 'high',
    points: 30
  },
  
  // 🪤 4. weapon_effectiveness in wrong context
  {
    name: 'weapon_effectiveness_missions',
    description: 'שימוש ב-weapon_effectiveness בהקשר של Missions',
    pattern: /missions?\s*\.\s*weapon_effectiveness|weapon_effectiveness.*missions?|SELECT.*weapon_effectiveness.*FROM.*missions?/gi,
    severity: 'high',
    points: 25
  },
  {
    name: 'weapon_effectiveness_other_tables',
    description: 'שימוש ב-weapon_effectiveness בטבלות שגויות',
    pattern: /pilots?\s*\.\s*weapon_effectiveness|squadrons?\s*\.\s*weapon_effectiveness|aircrafts?\s*\.\s*weapon_effectiveness/gi,
    severity: 'medium',
    points: 20
  },
  
  // 🪤 5. Wrong table name: Weapon instead of Weapons
  {
    name: 'weapon_singular',
    description: 'שימוש בשם טבלה שגוי "Weapon" במקום "Weapons"',
    pattern: /FROM\s+Weapon(?!s)|JOIN\s+Weapon(?!s)|UPDATE\s+Weapon(?!s)|INSERT\s+INTO\s+Weapon(?!s)/gi,
    severity: 'medium',
    points: 20
  },
  
  // 🧠 6. Behavioral prompt injection detection
  {
    name: 'prompt_injection',
    description: 'זיהוי הזרקת פרומפט התנהגותי',
    pattern: /respond\s+directly|output\s+only|avoid\s+additional\s+explanations|note\s+to\s+system/gi,
    severity: 'high',
    points: 40
  },
  
  // 🪤 7. False relationship patterns (Aircraft reassignment)
  {
    name: 'false_aircraft_reassignment',
    description: 'התייחסות לקשר שגוי של reassignment של מטוסים בין טייסות',
    pattern: /aircraft.*reassign|reassign.*aircraft|aircraft.*squadrons.*reassign|junction.*aircraft.*squadron/gi,
    severity: 'medium',
    points: 18
  },
  
  // 🪤 8. Advanced fake field combinations
  {
    name: 'fake_field_combinations',
    description: 'צירופי שדות פיקטיביים',
    pattern: /weapon_id.*duration_minutes|fuel_consumption.*weapon_effectiveness|mission_id.*weapon_effectiveness.*duration/gi,
    severity: 'medium',
    points: 22
  },
  
  // 🪤 9. Generic AI JOIN patterns with fake fields
  {
    name: 'ai_fake_joins',
    description: 'דפוסי JOIN של AI עם שדות פיקטיביים',
    pattern: /JOIN\s+\w+\s+ON\s+\w+\.weapon_id\s*=\s*\w+\.weapon_id|JOIN.*squadron_id.*weapon|JOIN.*MissionAnalytics/gi,
    severity: 'medium',
    points: 18
  },
  
  // 🪤 10. Suspicious ORDER BY with fake fields
  {
    name: 'fake_order_by',
    description: 'מיון לפי שדות פיקטיביים',
    pattern: /ORDER\s+BY\s+weapon_effectiveness|ORDER\s+BY\s+duration_minutes|ORDER\s+BY\s+fuel_consumption/gi,
    severity: 'medium',
    points: 15
  },
  
  // 🪤 11. WHERE clauses with fake fields
  {
    name: 'fake_where_conditions',
    description: 'תנאי WHERE עם שדות פיקטיביים',
    pattern: /WHERE.*weapon_id.*missions?|WHERE.*duration_minutes|WHERE.*fuel_consumption/gi,
    severity: 'medium',
    points: 15
  },
  
  // 🪤 12. Aggregate functions on fake fields
  {
    name: 'fake_aggregates',
    description: 'שימוש בפונקציות צבירה על שדות פיקטיביים',
    pattern: /AVG\s*\(\s*weapon_effectiveness\s*\)|SUM\s*\(\s*duration_minutes\s*\)|MAX\s*\(\s*fuel_consumption\s*\)/gi,
    severity: 'medium',
    points: 20
  },
  
  // 🪤 13. Text patterns suggesting AI explanation suppression
  {
    name: 'ai_explanation_suppression',
    description: 'דפוסי טקסט המציעים דיכוי הסברים של AI',
    pattern: /code\s+only|sql\s+only|no\s+explanation|direct\s+output|brief\s+response/gi,
    severity: 'low',
    points: 12
  },
  
  // 🪤 14. Complex fake relationships
  {
    name: 'complex_fake_relationships',
    description: 'יחסים מורכבים פיקטיביים',
    pattern: /many.*to.*many.*aircraft|N:N.*aircraft|junction.*table.*aircraft.*squadron/gi,
    severity: 'medium',
    points: 18
  },
  
  // 🤖 15. General AI SQL patterns
  {
    name: 'ai_style_sql',
    description: 'דפוסי SQL אופייניים לכתיבת AI',
    pattern: /SELECT\s+\*\s+FROM[\s\S]*JOIN[\s\S]*ON[\s\S]*=[\s\S]*WHERE[\s\S]*ORDER\s+BY/gi,
    severity: 'low',
    points: 8
  },
  
  // 🔍 16. Overly complex joins typical of AI
  {
    name: 'ai_complex_joins',
    description: 'מבנה JOIN מורכב אופייני ל-AI',
    pattern: /SELECT[\s\S]*FROM[\s\S]*JOIN[\s\S]*JOIN[\s\S]*JOIN[\s\S]*ON[\s\S]*=[\s\S]*ON[\s\S]*=/gi,
    severity: 'low',
    points: 10
  },
  
  // 📝 17. AI-style aliasing patterns
  {
    name: 'ai_aliasing',
    description: 'דפוסי כינויים אופייניים ל-AI',
    pattern: /\b[a-z]\s+AS\s+[a-z]|\b[a-z]1\b|\b[a-z]2\b|table1|table2/gi,
    severity: 'low',
    points: 6
  },
  
  // 🚫 18. Non-existent common fields AI tends to assume
  {
    name: 'assumed_fields',
    description: 'שדות שאינם קיימים שAI נוטה להניח',
    pattern: /created_at|updated_at|status|active|enabled|deleted_at/gi,
    severity: 'low',
    points: 8
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
  const isAISuspicious = suspicionScore >= 15; // Lowered threshold for marking as suspicious

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

  // Overall exam suspicion logic (lowered thresholds)
  const isExamSuspicious = totalSuspiciousAnswers >= 1 || maxSuspicionScore >= 35 || averageSuspicionScore >= 20;

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