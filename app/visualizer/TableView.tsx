'use client';

import React from 'react';
import styles from './visualizer.module.css';
import { VisualizationNode } from './types';

type TableViewProps = {
  node: VisualizationNode;
};

const TableView = ({ node }: TableViewProps) => {
  if (!node.data) {
    return (
      <div className={styles.tablePlaceholder}>
        <span className={styles.tableTitle}>{node.label}</span>
        <p className={styles.tableHint}>No rows loaded for this step.</p>
      </div>
    );
  }

  const { columns, rows, rowStates, highlightColumns } = node.data;
  const hasColumnHighlights = Boolean(highlightColumns?.length);

  const getColumnClassName = (column: string) => {
    if (!hasColumnHighlights) {
      return undefined;
    }

    return highlightColumns?.includes(column) ? styles.columnHighlighted : styles.columnMuted;
  };

  const getRowClassName = (index: number) => {
    const rowState = rowStates?.[index] ?? 'default';

    if (rowState === 'kept') {
      return styles.tableRowKept;
    }

    if (rowState === 'filtered') {
      return styles.tableRowFiltered;
    }

    if (rowState === 'matched') {
      return styles.tableRowMatched;
    }

    if (rowState === 'unmatched') {
      return styles.tableRowUnmatched;
    }

    if (rowState === 'inserted') {
      return styles.tableRowInserted;
    }

    if (rowState === 'updated') {
      return styles.tableRowUpdated;
    }

    if (rowState === 'deleted') {
      return styles.tableRowDeleted;
    }

    return undefined;
  };

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableHeader}>
        <span className={styles.tableTitle}>{node.label}</span>
        <span className={styles.tableKind}>{node.kind.toUpperCase()}</span>
      </div>
      <div className={styles.tableScroll} role="region" aria-label={`${node.label} rows`} tabIndex={0}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className={getColumnClassName(column)}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${node.id}-row-${index}`} className={getRowClassName(index)}>
                {columns.map((column) => (
                  <td key={`${node.id}-${column}-${index}`} className={getColumnClassName(column)}>
                    {row[column]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableView;
