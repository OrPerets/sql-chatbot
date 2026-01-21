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
              {node.data.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {node.data.rows.map((row, index) => (
              <tr key={`${node.id}-row-${index}`}>
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
};

export default TableView;
