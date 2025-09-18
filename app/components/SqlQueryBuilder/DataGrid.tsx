"use client";

import React from 'react';
import styles from './SqlQueryBuilder.module.css';
import { ValidationError } from './types';

interface DataGridProps {
  columns: string[];
  values: string[][];
  onColumnsChange: (columns: string[]) => void;
  onValuesChange: (values: string[][]) => void;
  errors: ValidationError[];
}

const DataGrid: React.FC<DataGridProps> = ({
  columns,
  values,
  onColumnsChange,
  onValuesChange,
  errors,
}) => {
  const addColumn = () => {
    const newColumns = [...columns, ''];
    const newValues = values.map(row => [...row, '']);
    onColumnsChange(newColumns);
    onValuesChange(newValues);
  };

  const removeColumn = (columnIndex: number) => {
    if (columns.length > 1) {
      const newColumns = columns.filter((_, index) => index !== columnIndex);
      const newValues = values.map(row => row.filter((_, index) => index !== columnIndex));
      onColumnsChange(newColumns);
      onValuesChange(newValues);
    }
  };

  const updateColumn = (columnIndex: number, value: string) => {
    const newColumns = [...columns];
    newColumns[columnIndex] = value;
    onColumnsChange(newColumns);
  };

  const addRow = () => {
    const newRow = new Array(columns.length).fill('');
    onValuesChange([...values, newRow]);
  };

  const removeRow = (rowIndex: number) => {
    if (values.length > 1) {
      const newValues = values.filter((_, index) => index !== rowIndex);
      onValuesChange(newValues);
    }
  };

  const updateValue = (rowIndex: number, columnIndex: number, value: string) => {
    const newValues = [...values];
    newValues[rowIndex] = [...newValues[rowIndex]];
    newValues[rowIndex][columnIndex] = value;
    onValuesChange(newValues);
  };

  const getColumnError = (fieldName: string) => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  const parseCsvData = (csvText: string) => {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return;

    const firstLine = lines[0].split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    
    // Ask user if first row is headers
    const useFirstRowAsHeaders = window.confirm('האם השורה הראשונה מכילה כותרות עמודות?');
    
    let newColumns: string[];
    let newValues: string[][];
    
    if (useFirstRowAsHeaders) {
      newColumns = firstLine;
      newValues = lines.slice(1).map(line => 
        line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
      );
    } else {
      // Generate column names
      newColumns = firstLine.map((_, index) => `column_${index + 1}`);
      newValues = lines.map(line => 
        line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
      );
    }
    
    // Ensure all rows have the same number of columns
    const maxColumns = Math.max(newColumns.length, ...newValues.map(row => row.length));
    
    while (newColumns.length < maxColumns) {
      newColumns.push(`column_${newColumns.length + 1}`);
    }
    
    newValues = newValues.map(row => {
      while (row.length < maxColumns) {
        row.push('');
      }
      return row.slice(0, maxColumns);
    });
    
    onColumnsChange(newColumns);
    onValuesChange(newValues);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    if (pastedText.includes('\n') || pastedText.includes(',')) {
      parseCsvData(pastedText);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* CSV Import Helper */}
      <div
        style={{
          background: '#f0f9ff',
          border: '2px dashed #0ea5e9',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'center',
        }}
        onPaste={handlePaste}
      >
        <p style={{ margin: '0 0 8px 0', color: '#0369a1', fontSize: '14px' }}>
          💡 טיפ: העתק נתונים מ-Excel או CSV והדבק כאן
        </p>
        <p style={{ margin: 0, color: '#0369a1', fontSize: '12px' }}>
          לחץ Ctrl+V או Cmd+V כדי להדביק נתונים מהלוח
        </p>
      </div>

      {/* Data Grid */}
      <div style={{ overflowX: 'auto', border: '2px solid #e5e7eb', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
          {/* Column Headers */}
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '12px 8px', minWidth: '40px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                #
              </th>
              {columns.map((column, columnIndex) => (
                <th key={columnIndex} style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', minWidth: '150px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <input
                      type="text"
                      value={column}
                      onChange={(e) => updateColumn(columnIndex, e.target.value)}
                      placeholder={`עמודה ${columnIndex + 1}`}
                      className={`${styles.input} ${getColumnError(`column-${columnIndex}`) ? styles.error : ''}`}
                      style={{ 
                        fontSize: '12px', 
                        padding: '6px 8px',
                        margin: 0,
                        direction: 'ltr',
                      }}
                    />
                    {columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColumn(columnIndex)}
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          cursor: 'pointer',
                        }}
                      >
                        הסר
                      </button>
                    )}
                    {getColumnError(`column-${columnIndex}`) && (
                      <div style={{ fontSize: '10px', color: '#ef4444' }}>
                        {getColumnError(`column-${columnIndex}`)}
                      </div>
                    )}
                  </div>
                </th>
              ))}
              <th style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', width: '60px' }}>
                <button
                  type="button"
                  onClick={addColumn}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  + עמודה
                </button>
              </th>
            </tr>
          </thead>
          
          {/* Data Rows */}
          <tbody>
            {values.map((row, rowIndex) => (
              <tr key={rowIndex} style={{ background: rowIndex % 2 === 0 ? 'white' : '#f8fafc' }}>
                <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>
                  {rowIndex + 1}
                </td>
                {row.map((value, columnIndex) => (
                  <td key={columnIndex} style={{ padding: '4px', borderBottom: '1px solid #e5e7eb' }}>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateValue(rowIndex, columnIndex, e.target.value)}
                      placeholder={`ערך ${rowIndex + 1}.${columnIndex + 1}`}
                      className={styles.input}
                      style={{ 
                        fontSize: '14px',
                        padding: '6px 8px',
                        margin: 0,
                        border: '1px solid #d1d5db',
                        direction: 'ltr',
                      }}
                    />
                  </td>
                ))}
                <td style={{ padding: '4px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                  {values.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '4px 8px',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      הסר
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Row Button */}
      <button
        type="button"
        onClick={addRow}
        className={`${styles.button} ${styles.buttonSecondary}`}
        style={{ alignSelf: 'flex-start' }}
      >
        + הוסף שורה
      </button>

      {/* Row Errors */}
      {errors.filter(error => error.field.startsWith('row-')).map((error, index) => (
        <div key={index} className={styles.errorMessage}>
          {error.message}
        </div>
      ))}
    </div>
  );
};

export default DataGrid;
