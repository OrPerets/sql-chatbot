/**
 * SQL Curriculum Mapping
 * 
 * Maps SQL concepts to the week they're introduced in the course curriculum.
 * Used by the AI assistant to restrict SQL examples to concepts that have been taught.
 */

export const SQL_CURRICULUM_MAP: Record<number, {
  week: number;
  concepts: string[];
  forbiddenConcepts: string[];
}> = {
  1: {
    week: 1,
    concepts: ['CREATE TABLE', 'DDL', 'CREATE', 'TABLE'],
    forbiddenConcepts: ['SELECT', 'JOIN', 'WHERE', 'GROUP BY', 'subquery', 'sub-query', 'FROM', 'BETWEEN', 'LIKE', 'COUNT', 'DISTINCT', 'INSERT', 'UPDATE', 'DELETE', 'NULL']
  },
  2: {
    week: 2,
    concepts: ['SELECT', 'constraints', 'CONSTRAINT'],
    forbiddenConcepts: ['JOIN', 'GROUP BY', 'subquery', 'sub-query', 'WHERE', 'BETWEEN', 'LIKE', 'COUNT', 'DISTINCT', 'FROM', 'INSERT', 'UPDATE', 'DELETE', 'NULL']
  },
  3: {
    week: 3,
    concepts: ['FROM', 'WHERE', 'BETWEEN', 'LIKE'],
    forbiddenConcepts: ['JOIN', 'GROUP BY', 'COUNT', 'DISTINCT', 'subquery', 'sub-query', 'INSERT', 'UPDATE', 'DELETE', 'NULL']
  },
  4: {
    week: 4,
    concepts: ['GROUP BY', 'aggregation'],
    forbiddenConcepts: ['JOIN', 'COUNT', 'DISTINCT', 'subquery', 'sub-query', 'INSERT', 'UPDATE', 'DELETE', 'NULL']
  },
  5: {
    week: 5,
    concepts: ['functions', 'variables', 'SQL functions'],
    forbiddenConcepts: ['JOIN', 'subquery', 'sub-query', 'INSERT', 'UPDATE', 'DELETE', 'NULL']
  },
  6: {
    week: 6,
    concepts: ['COUNT', 'DISTINCT', 'GROUP BY advanced'],
    forbiddenConcepts: ['JOIN', 'subquery', 'sub-query', 'INSERT', 'UPDATE', 'DELETE', 'NULL']
  },
  7: {
    week: 7,
    concepts: ['JOIN', 'ON', 'USING', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN'],
    forbiddenConcepts: ['subquery', 'sub-query']
  },
  8: {
    week: 8,
    concepts: ['NULL', 'INSERT', 'UPDATE', 'DELETE', 'DML'],
    forbiddenConcepts: ['subquery', 'sub-query']
  },
  9: {
    week: 9,
    concepts: ['subquery', 'sub-query', 'nested query'],
    forbiddenConcepts: []
  },
  10: {
    week: 10,
    concepts: ['primary key', 'foreign key', 'PRIMARY KEY', 'FOREIGN KEY', 'key constraints'],
    forbiddenConcepts: []
  },
  11: {
    week: 11,
    concepts: ['ALTER', 'ALTER TABLE', 'indexes', 'INDEX', 'CREATE INDEX'],
    forbiddenConcepts: []
  },
  12: {
    week: 12,
    concepts: ['DROP', 'DROP TABLE', 'VIEWS', 'VIEW', 'CREATE VIEW', 'temporary tables', 'temporary table'],
    forbiddenConcepts: []
  },
  13: {
    week: 13,
    concepts: ['triggers', 'TRIGGER', 'CREATE TRIGGER', 'virtual tables', 'virtual table'],
    forbiddenConcepts: []
  },
};

/**
 * Get all SQL concepts allowed up to and including the specified week
 * 
 * The curriculum is cumulative: if week is 6, this returns concepts from weeks 1-6.
 * 
 * @param week The week number (1-13)
 * @returns Array of allowed SQL concepts for that week and all previous weeks
 */
export function getAllowedConceptsForWeek(week: number): string[] {
  const allowed: string[] = [];
  for (let w = 1; w <= week; w++) {
    if (SQL_CURRICULUM_MAP[w]) {
      allowed.push(...SQL_CURRICULUM_MAP[w].concepts);
    }
  }
  // Remove duplicates
  return Array.from(new Set(allowed));
}

/**
 * Get all SQL concepts that are forbidden for the specified week
 * This includes ALL concepts that haven't been taught yet (from future weeks)
 * 
 * The curriculum is cumulative: if current week is 6, forbidden concepts include
 * all concepts from weeks 7-13.
 */
export function getForbiddenConceptsForWeek(week: number): string[] {
  // Get all concepts taught in ALL weeks (1-13)
  const allConceptsInCurriculum: string[] = [];
  for (let w = 1; w <= 13; w++) {
    if (SQL_CURRICULUM_MAP[w]) {
      allConceptsInCurriculum.push(...SQL_CURRICULUM_MAP[w].concepts);
    }
  }
  const allConcepts = Array.from(new Set(allConceptsInCurriculum));
  
  // Get all concepts allowed up to the current week (weeks 1 to current week)
  const allowed = getAllowedConceptsForWeek(week);
  
  // Forbidden concepts = all concepts that are NOT in the allowed list
  // This ensures continuity: if week 6, forbidden includes weeks 7-13
  const forbidden = allConcepts.filter(c => !allowed.includes(c));
  
  return forbidden;
}

/**
 * Check if a SQL concept is allowed for the given week
 */
export function isConceptAllowed(concept: string, week: number): boolean {
  const allowed = getAllowedConceptsForWeek(week);
  const lowerConcept = concept.toLowerCase();
  return allowed.some(c => c.toLowerCase() === lowerConcept || lowerConcept.includes(c.toLowerCase()));
}

/**
 * Check if a SQL concept is forbidden for the given week
 */
export function isConceptForbidden(concept: string, week: number): boolean {
  const forbidden = getForbiddenConceptsForWeek(week);
  const lowerConcept = concept.toLowerCase();
  return forbidden.some(c => c.toLowerCase() === lowerConcept || lowerConcept.includes(c.toLowerCase()));
}
