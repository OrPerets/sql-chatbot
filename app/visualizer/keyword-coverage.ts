export type KeywordCoverageStatus = 'supported' | 'placeholder';

export type KeywordCoverageEntry = {
  keyword: string;
  status: KeywordCoverageStatus;
  visualization: string;
  notes?: string;
};

type KeywordDetector = KeywordCoverageEntry & {
  regex: RegExp;
};

const KEYWORD_DETECTORS: KeywordDetector[] = [
  {
    keyword: 'SELECT',
    status: 'supported',
    visualization: 'Projection step with highlighted output columns.',
    regex: /\bselect\b/i
  },
  {
    keyword: 'DISTINCT',
    status: 'placeholder',
    visualization: 'Placeholder callout (results are not yet de-duplicated).',
    regex: /\bdistinct\b/i
  },
  {
    keyword: 'FROM',
    status: 'supported',
    visualization: 'Source table loading step.',
    regex: /\bfrom\b/i
  },
  {
    keyword: 'INNER JOIN',
    status: 'supported',
    visualization: 'Join pairing animation for matching rows.',
    regex: /\binner\s+join\b/i
  },
  {
    keyword: 'LEFT JOIN',
    status: 'supported',
    visualization: 'Join pairing animation with unmatched left rows.',
    regex: /\bleft\s+(outer\s+)?join\b/i
  },
  {
    keyword: 'RIGHT JOIN',
    status: 'supported',
    visualization: 'Join pairing animation with unmatched right rows.',
    regex: /\bright\s+(outer\s+)?join\b/i
  },
  {
    keyword: 'FULL JOIN',
    status: 'supported',
    visualization: 'Join pairing animation with unmatched rows on both sides.',
    regex: /\bfull\s+(outer\s+)?join\b/i
  },
  {
    keyword: 'CROSS JOIN',
    status: 'supported',
    visualization: 'Cartesian pairing visualization.',
    regex: /\bcross\s+join\b/i
  },
  {
    keyword: 'ON',
    status: 'supported',
    visualization: 'Join condition summary in the pairing step.',
    regex: /\bon\b/i
  },
  {
    keyword: 'WHERE',
    status: 'supported',
    visualization: 'Row filter step with kept/filtered states.',
    regex: /\bwhere\b/i
  },
  {
    keyword: 'GROUP BY',
    status: 'supported',
    visualization: 'Grouped row clusters and aggregate output.',
    regex: /\bgroup\s+by\b/i
  },
  {
    keyword: 'HAVING',
    status: 'supported',
    visualization: 'Post-aggregation filter step.',
    regex: /\bhaving\b/i
  },
  {
    keyword: 'ORDER BY',
    status: 'supported',
    visualization: 'Sorted output table.',
    regex: /\border\s+by\b/i
  },
  {
    keyword: 'LIMIT',
    status: 'supported',
    visualization: 'Trimmed output rows.',
    regex: /\blimit\b/i
  },
  {
    keyword: 'OFFSET',
    status: 'placeholder',
    visualization: 'Placeholder callout (offset pagination not visualized).',
    regex: /\boffset\b/i
  },
  {
    keyword: 'FETCH',
    status: 'placeholder',
    visualization: 'Placeholder callout (fetch-first pagination not visualized).',
    regex: /\bfetch\b/i
  },
  {
    keyword: 'UNION',
    status: 'supported',
    visualization: 'Set operation comparison with merged rows.',
    regex: /\bunion\b/i
  },
  {
    keyword: 'INTERSECT',
    status: 'supported',
    visualization: 'Set operation comparison with shared rows.',
    regex: /\bintersect\b/i
  },
  {
    keyword: 'EXCEPT',
    status: 'supported',
    visualization: 'Set operation comparison with left-only rows.',
    regex: /\bexcept\b/i
  },
  {
    keyword: 'WITH',
    status: 'supported',
    visualization: 'CTE build step before the main query.',
    regex: /\bwith\b/i
  },
  {
    keyword: 'SUBQUERY',
    status: 'supported',
    visualization: 'Nested SELECT resolved into a subquery node.',
    regex: /\bselect\b[\s\S]*\bselect\b/i
  },
  {
    keyword: 'INSERT',
    status: 'supported',
    visualization: 'Mutation preview with inserted rows highlighted.',
    regex: /\binsert\b/i
  },
  {
    keyword: 'UPDATE',
    status: 'supported',
    visualization: 'Mutation preview with updated rows highlighted.',
    regex: /\bupdate\b/i
  },
  {
    keyword: 'DELETE',
    status: 'supported',
    visualization: 'Mutation preview with deleted rows highlighted.',
    regex: /\bdelete\b/i
  },
  {
    keyword: 'VALUES',
    status: 'placeholder',
    visualization: 'Placeholder callout (explicit VALUES list not visualized).',
    regex: /\bvalues\b/i
  },
  {
    keyword: 'CASE',
    status: 'placeholder',
    visualization: 'Placeholder callout (conditional expressions not visualized).',
    regex: /\bcase\b/i
  },
  {
    keyword: 'CAST',
    status: 'placeholder',
    visualization: 'Placeholder callout (data type casting not visualized).',
    regex: /\bcast\b/i
  },
  {
    keyword: 'COALESCE',
    status: 'placeholder',
    visualization: 'Placeholder callout (null-coalescing not visualized).',
    regex: /\bcoalesce\b/i
  },
  {
    keyword: 'LIKE',
    status: 'placeholder',
    visualization: 'Placeholder callout (pattern matching not visualized).',
    regex: /\blike\b/i
  },
  {
    keyword: 'IN',
    status: 'placeholder',
    visualization: 'Placeholder callout (set membership not visualized).',
    regex: /\bin\b/i
  },
  {
    keyword: 'EXISTS',
    status: 'placeholder',
    visualization: 'Placeholder callout (existence checks not visualized).',
    regex: /\bexists\b/i
  },
  {
    keyword: 'BETWEEN',
    status: 'placeholder',
    visualization: 'Placeholder callout (range filtering not visualized).',
    regex: /\bbetween\b/i
  },
  {
    keyword: 'WINDOW',
    status: 'placeholder',
    visualization: 'Placeholder callout (window functions not visualized).',
    regex: /\bover\b|\bwindow\b/i
  },
  {
    keyword: 'CREATE',
    status: 'placeholder',
    visualization: 'Placeholder callout (DDL statements not visualized).',
    regex: /\bcreate\b/i
  },
  {
    keyword: 'ALTER',
    status: 'placeholder',
    visualization: 'Placeholder callout (DDL statements not visualized).',
    regex: /\balter\b/i
  },
  {
    keyword: 'DROP',
    status: 'placeholder',
    visualization: 'Placeholder callout (DDL statements not visualized).',
    regex: /\bdrop\b/i
  }
];

export const KEYWORD_COVERAGE: KeywordCoverageEntry[] = KEYWORD_DETECTORS.map(
  ({ regex: _regex, ...entry }) => entry
);

export const findCoverageGaps = (sql: string): KeywordCoverageEntry[] => {
  const matched = KEYWORD_DETECTORS.filter((detector) => detector.regex.test(sql));
  const gaps = matched.filter((entry) => entry.status === 'placeholder');
  const seen = new Set<string>();

  return gaps.filter((entry) => {
    if (seen.has(entry.keyword)) {
      return false;
    }
    seen.add(entry.keyword);
    return true;
  });
};
