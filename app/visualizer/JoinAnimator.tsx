'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './visualizer.module.css';
import { VisualizationNode, JoinSourceTable } from './types';

type JoinAnimatorProps = {
  node: VisualizationNode;
};

const JoinAnimator = ({ node }: JoinAnimatorProps) => {
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const leftTableRef = useRef<HTMLDivElement>(null);
  const rightTableRef = useRef<HTMLDivElement>(null);

  // Extract source tables from node or create default ones
  const leftSource = node.leftSource || extractLeftSource(node);
  const rightSource = node.rightSource || extractRightSource(node);
  
  const pairs = node.pairs?.length
    ? node.pairs
    : generateDefaultPairs(leftSource, rightSource, node.joinCondition);

  const matchedPairs = pairs.filter(p => p.matched);
  const hasSourceTables = leftSource && rightSource;
  const joinType = node.joinType || 'INNER';

  useEffect(() => {
    if (matchedPairs.length > 0 && isAnimating) {
      const timer = setTimeout(() => {
        setCurrentMatchIndex((prev) => (prev + 1) % matchedPairs.length);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentMatchIndex, isAnimating, matchedPairs.length]);

  const currentPair = matchedPairs[currentMatchIndex];

  // Fallback to simple view if no source tables
  if (!hasSourceTables) {
    return (
      <div className={styles.joinCard} role="region" aria-label="אנימציית חיבור">
        <div className={styles.joinHeader}>
          <span className={styles.tableTitle}>{node.label}</span>
          <span className={styles.tableKind} data-kind="join">חיבור {joinType}</span>
        </div>
        {node.detail && <p className={styles.joinDetail}>{node.detail}</p>}
        {node.joinCondition && (
          <div className={styles.joinConditionBanner}>
            <span className={styles.joinConditionLabel}>תנאי חיבור:</span>
            <code className={styles.joinConditionCode}>{node.joinCondition}</code>
          </div>
        )}
        <div className={styles.joinPairs}>
          {pairs.map((pair) => (
            <div
              key={pair.id}
              className={pair.matched ? styles.joinPair : styles.joinPairMuted}
            >
              <span>{pair.left}</span>
              <span className={styles.joinArrow}>{pair.matched ? '➜' : '✕'}</span>
              <span>{pair.right}</span>
            </div>
          ))}
        </div>
        {node.data && renderResultTable(node)}
      </div>
    );
  }

  return (
    <div className={styles.joinAnimatorContainer} role="region" aria-label="מדמה חיבור טבלאות">
      <div className={styles.joinAnimatorHeader}>
        <div className={styles.joinHeaderTop}>
          <h3 className={styles.tableTitle}>{node.label}</h3>
          <span className={styles.tableKind} data-kind="join">חיבור {joinType}</span>
        </div>
        {node.detail && <p className={styles.joinDetail}>{node.detail}</p>}
        {node.joinCondition && (
          <div className={styles.joinConditionBanner}>
            <span className={styles.joinConditionLabel}>ON</span>
            <code className={styles.joinConditionCode}>{node.joinCondition}</code>
          </div>
        )}
      </div>

      {/* Animation Controls */}
      {matchedPairs.length > 1 && (
        <div className={styles.joinControls}>
          <button
            className={styles.joinControlBtn}
            onClick={() => setCurrentMatchIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentMatchIndex === 0}
            title="התאמה קודמת"
          >
            ←
          </button>
          <button
            className={styles.joinControlBtn}
            onClick={() => setIsAnimating(!isAnimating)}
            title={isAnimating ? 'עצור' : 'הפעל אנימציה'}
          >
            {isAnimating ? '⏸' : '▶'}
          </button>
          <button
            className={styles.joinControlBtn}
            onClick={() => setCurrentMatchIndex((prev) => Math.min(matchedPairs.length - 1, prev + 1))}
            disabled={currentMatchIndex === matchedPairs.length - 1}
            title="התאמה הבאה"
          >
            →
          </button>
          <span className={styles.joinMatchCounter}>
            התאמה {currentMatchIndex + 1} מתוך {matchedPairs.length}
          </span>
        </div>
      )}

      {/* Current Match Explanation */}
      {currentPair && (
        <div className={styles.matchExplanation}>
          <span className={styles.matchExplanationIcon}>🔗</span>
          <p className={styles.matchExplanationText}>
            {currentPair.explanation || `מתאים: ${currentPair.left} עם ${currentPair.right}`}
          </p>
        </div>
      )}

      {/* Three-Panel Layout: Source Tables + Connectors */}
      <div className={styles.joinMainView}>
        {/* Left Source Table */}
        <div className={styles.joinTablePanel} ref={leftTableRef}>
          <div className={styles.joinTablePanelHeader}>
            <span className={styles.joinTablePanelTitle}>{leftSource.tableName}</span>
            {leftSource.joinColumn && (
              <span className={styles.joinTablePanelKey}>🔑 {leftSource.joinColumn}</span>
            )}
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {leftSource.columns.map((col) => (
                    <th
                      key={col}
                      className={col === leftSource.joinColumn ? styles.joinKeyColumn : undefined}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leftSource.rows.map((row, idx) => {
                  const isMatched = currentPair?.leftRowIndex === idx;
                  const isInResult = leftSource.matchedRowIndices?.includes(idx);
                  return (
                    <tr
                      key={idx}
                      className={
                        isMatched
                          ? styles.joinRowActive
                          : isInResult
                            ? styles.joinRowMatched
                            : styles.joinRowUnmatched
                      }
                    >
                      {leftSource.columns.map((col) => (
                        <td
                          key={col}
                          className={col === leftSource.joinColumn ? styles.joinKeyColumn : undefined}
                        >
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visual Connector */}
        <div className={styles.joinConnectorPanel}>
          <div className={styles.joinConnectorIcon}>⟷</div>
          {currentPair && (
            <div className={styles.joinConnectorLabel}>
              {currentPair.matched ? '✓ התאמה' : '✕ אין התאמה'}
            </div>
          )}
        </div>

        {/* Right Source Table */}
        <div className={styles.joinTablePanel} ref={rightTableRef}>
          <div className={styles.joinTablePanelHeader}>
            <span className={styles.joinTablePanelTitle}>{rightSource.tableName}</span>
            {rightSource.joinColumn && (
              <span className={styles.joinTablePanelKey}>🔑 {rightSource.joinColumn}</span>
            )}
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {rightSource.columns.map((col) => (
                    <th
                      key={col}
                      className={col === rightSource.joinColumn ? styles.joinKeyColumn : undefined}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rightSource.rows.map((row, idx) => {
                  const isMatched = currentPair?.rightRowIndex === idx;
                  const isInResult = rightSource.matchedRowIndices?.includes(idx);
                  return (
                    <tr
                      key={idx}
                      className={
                        isMatched
                          ? styles.joinRowActive
                          : isInResult
                            ? styles.joinRowMatched
                            : styles.joinRowUnmatched
                      }
                    >
                      {rightSource.columns.map((col) => (
                        <td
                          key={col}
                          className={col === rightSource.joinColumn ? styles.joinKeyColumn : undefined}
                        >
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Match Statistics */}
      <div className={styles.joinStats}>
        <div className={styles.joinStat}>
          <span className={styles.joinStatValue}>{matchedPairs.length}</span>
          <span className={styles.joinStatLabel}>התאמות</span>
        </div>
        <div className={styles.joinStat}>
          <span className={styles.joinStatValue}>{pairs.filter(p => !p.matched).length}</span>
          <span className={styles.joinStatLabel}>ללא התאמה</span>
        </div>
        <div className={styles.joinStat}>
          <span className={styles.joinStatValue}>{node.data?.rows.length || 0}</span>
          <span className={styles.joinStatLabel}>שורות בתוצאה</span>
        </div>
      </div>

      {/* Result Table */}
      {node.data && renderResultTable(node)}
    </div>
  );
};

// Helper function to render result table
function renderResultTable(node: VisualizationNode) {
  if (!node.data) return null;

  return (
    <div className={styles.joinResult}>
      <div className={styles.joinResultHeader}>
        <span className={styles.tableTitle}>תוצאת החיבור</span>
        <span className={styles.joinResultBadge}>
          {node.data.rows.length} {node.data.rows.length === 1 ? 'שורה' : 'שורות'}
        </span>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {node.data.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {node.data.rows.map((row, index) => (
              <tr key={`${node.id}-result-${index}`} className={styles.tableRowMatched}>
                {node.data?.columns.map((column) => (
                  <td key={`${node.id}-${column}-${index}`}>{row[column]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Helper functions to extract or generate source table data
function extractLeftSource(node: VisualizationNode): JoinSourceTable | null {
  if (!node.data) return null;
  
  // Try to infer left table from column names
  const leftColumns = node.data.columns.filter(col => col.includes('.') && !col.includes('Enrollments'));
  if (leftColumns.length === 0) return null;

  const tableName = leftColumns[0].split('.')[0];
  const columns = Array.from(new Set(leftColumns.map(col => col.split('.')[1] || col)));
  
  return {
    tableName,
    columns,
    rows: node.data.rows.map(row => {
      const extracted: Record<string, string | number> = {};
      columns.forEach(col => {
        const key = `${tableName}.${col}`;
        if (key in row) extracted[col] = row[key];
      });
      return extracted;
    }),
    matchedRowIndices: [],
    joinColumn: columns[0]
  };
}

function extractRightSource(node: VisualizationNode): JoinSourceTable | null {
  if (!node.data) return null;
  
  // Try to infer right table from column names
  const rightColumns = node.data.columns.filter(col => col.includes('Enrollments'));
  if (rightColumns.length === 0) return null;

  const tableName = rightColumns[0].split('.')[0];
  const columns = Array.from(new Set(rightColumns.map(col => col.split('.')[1] || col)));
  
  return {
    tableName,
    columns,
    rows: node.data.rows.map(row => {
      const extracted: Record<string, string | number> = {};
      columns.forEach(col => {
        const key = `${tableName}.${col}`;
        if (key in row) extracted[col] = row[key];
      });
      return extracted;
    }),
    matchedRowIndices: [],
    joinColumn: columns[0]
  };
}

function generateDefaultPairs(leftSource: any, rightSource: any, joinCondition?: string) {
  if (!leftSource || !rightSource) {
    return [
      { id: 'pair-1', left: 'Row 1', right: 'Row 1', matched: true },
      { id: 'pair-2', left: 'Row 2', right: 'Row 2', matched: true }
    ];
  }

  const pairs = [];
  leftSource.rows.forEach((leftRow: any, leftIdx: number) => {
    rightSource.rows.forEach((rightRow: any, rightIdx: number) => {
      pairs.push({
        id: `pair-${leftIdx}-${rightIdx}`,
        left: `${leftSource.tableName}[${leftIdx}]`,
        right: `${rightSource.tableName}[${rightIdx}]`,
        matched: true,
        leftRowIndex: leftIdx,
        rightRowIndex: rightIdx
      });
    });
  });

  return pairs.slice(0, 5); // Limit default pairs
}

export default React.memo(JoinAnimator);
