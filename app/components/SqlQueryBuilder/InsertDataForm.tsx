"use client";

import React, { useState, useCallback } from 'react';
import styles from './SqlQueryBuilder.module.css';
import { InsertData, CONFLICT_OPTIONS, FormValidation, ValidationError } from './types';
import DataGrid from './DataGrid';

interface InsertDataFormProps {
  onQueryGenerated: (query: string) => void;
  onBack: () => void;
}

const InsertDataForm: React.FC<InsertDataFormProps> = ({
  onQueryGenerated,
  onBack,
}) => {
  const [formData, setFormData] = useState<InsertData>({
    tableName: '',
    columns: [''],
    values: [['']],
    useTransaction: true,
    onConflict: 'NONE',
  });

  const [errors, setErrors] = useState<ValidationError[]>([]);

  const validateForm = useCallback((): FormValidation => {
    const newErrors: ValidationError[] = [];

    // Validate table name
    if (!formData.tableName.trim()) {
      newErrors.push({ field: 'tableName', message: 'שם הטבלה הוא שדה חובה' });
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formData.tableName.trim())) {
      newErrors.push({ field: 'tableName', message: 'שם הטבלה חייב להתחיל באות או קו תחתון ולהכיל רק אותיות, מספרים וקווים תחתונים' });
    }

    // Validate columns
    if (formData.columns.length === 0 || formData.columns.every(col => !col.trim())) {
      newErrors.push({ field: 'columns', message: 'חייב להיות לפחות עמודה אחת' });
    }

    const nonEmptyColumns = formData.columns.filter(col => col.trim());
    const uniqueColumns = new Set(nonEmptyColumns.map(col => col.toLowerCase()));
    if (nonEmptyColumns.length !== uniqueColumns.size) {
      newErrors.push({ field: 'columns', message: 'שמות העמודות חייבים להיות ייחודיים' });
    }

    // Validate column names
    formData.columns.forEach((column, index) => {
      if (column.trim() && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column.trim())) {
        newErrors.push({ field: `column-${index}`, message: `עמודה ${index + 1}: שם העמודה חייב להתחיל באות או קו תחתון` });
      }
    });

    // Validate values
    if (formData.values.length === 0 || formData.values.every(row => row.every(cell => !cell.trim()))) {
      newErrors.push({ field: 'values', message: 'חייב להיות לפחות שורת נתונים אחת' });
    }

    // Check that each row has the same number of values as columns
    const activeColumnCount = formData.columns.filter(col => col.trim()).length;
    formData.values.forEach((row, rowIndex) => {
      const nonEmptyValues = row.filter((_, colIndex) => formData.columns[colIndex]?.trim());
      if (nonEmptyValues.length > 0 && nonEmptyValues.length !== activeColumnCount) {
        newErrors.push({ field: `row-${rowIndex}`, message: `שורה ${rowIndex + 1}: מספר הערכים חייב להתאים למספר העמודות` });
      }
    });

    return {
      isValid: newErrors.length === 0,
      errors: newErrors,
    };
  }, [formData]);

  const generateSqlQuery = useCallback((): string => {
    const { tableName, columns, values, useTransaction, onConflict } = formData;
    
    const activeColumns = columns.filter(col => col.trim());
    const activeValues = values.filter(row => 
      row.some((cell, index) => columns[index]?.trim() && cell.trim())
    );

    let query = '';
    
    if (useTransaction && activeValues.length > 1) {
      query += 'BEGIN TRANSACTION;\n\n';
    }
    
    // Build INSERT statement
    let insertQuery = `INSERT INTO ${tableName}`;
    
    if (activeColumns.length > 0) {
      insertQuery += ` (${activeColumns.join(', ')})`;
    }
    
    insertQuery += ' VALUES\n';
    
    const valueRows = activeValues.map(row => {
      const rowValues = activeColumns.map((_, colIndex) => {
        const value = row[colIndex] || '';
        // Simple value formatting - wrap in quotes if not a number
        if (!value.trim()) return 'NULL';
        if (/^\d+(\.\d+)?$/.test(value.trim())) return value.trim();
        if (value.trim().toUpperCase() === 'NULL') return 'NULL';
        if (value.trim().toUpperCase() === 'TRUE' || value.trim().toUpperCase() === 'FALSE') {
          return value.trim().toUpperCase();
        }
        return `'${value.replace(/'/g, "''")}'`; // Escape single quotes
      });
      return `    (${rowValues.join(', ')})`;
    });
    
    insertQuery += valueRows.join(',\n');
    
    // Add conflict resolution
    if (onConflict === 'IGNORE') {
      insertQuery += '\nON DUPLICATE KEY UPDATE id = id'; // MySQL syntax
    } else if (onConflict === 'UPDATE') {
      insertQuery += '\nON DUPLICATE KEY UPDATE\n';
      const updateClauses = activeColumns
        .filter(col => col.toLowerCase() !== 'id')
        .map(col => `    ${col} = VALUES(${col})`)
        .join(',\n');
      insertQuery += updateClauses;
    }
    
    insertQuery += ';';
    
    query += insertQuery;
    
    if (useTransaction && activeValues.length > 1) {
      query += '\n\nCOMMIT;';
    }
    
    return query;
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateForm();
    setErrors(validation.errors);
    
    if (validation.isValid) {
      const query = generateSqlQuery();
      onQueryGenerated(query);
    }
  };

  const handleTableNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      tableName: e.target.value,
    }));
  };

  const handleColumnsChange = (columns: string[]) => {
    setFormData(prev => ({
      ...prev,
      columns,
      // Adjust values array to match column count
      values: prev.values.map(row => {
        const newRow = [...row];
        while (newRow.length < columns.length) {
          newRow.push('');
        }
        return newRow.slice(0, columns.length);
      }),
    }));
  };

  const handleValuesChange = (values: string[][]) => {
    setFormData(prev => ({
      ...prev,
      values,
    }));
  };

  const handleUseTransactionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      useTransaction: e.target.checked,
    }));
  };

  const handleOnConflictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      onConflict: e.target.value as InsertData['onConflict'],
    }));
  };

  const getFieldError = (fieldName: string) => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {errors.length > 0 && (
        <div className={styles.errorList}>
          <strong>יש לתקן את השגיאות הבאות:</strong>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.formGroup}>
        <label htmlFor="tableName" className={styles.label}>
          שם הטבלה *
        </label>
        <input
          id="tableName"
          type="text"
          className={`${styles.input} ${getFieldError('tableName') ? styles.error : ''}`}
          value={formData.tableName}
          onChange={handleTableNameChange}
          placeholder="לדוגמה: users, products, orders"
          dir="ltr"
        />
        {getFieldError('tableName') && (
          <div className={styles.errorMessage}>{getFieldError('tableName')}</div>
        )}
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>עמודות ונתונים *</label>
        <DataGrid
          columns={formData.columns}
          values={formData.values}
          onColumnsChange={handleColumnsChange}
          onValuesChange={handleValuesChange}
          errors={errors}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>אפשרויות מתקדמות</label>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          <label className={styles.checkboxGroup}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={formData.useTransaction}
              onChange={handleUseTransactionChange}
            />
            עטוף בטרנזקציה (Transaction)
          </label>

          <div className={styles.formGroup}>
            <label className={styles.label}>טיפול בהתנגשויות</label>
            <select
              className={styles.select}
              value={formData.onConflict}
              onChange={handleOnConflictChange}
            >
              {CONFLICT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={styles.buttonGroup}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={onBack}
        >
          חזור
        </button>
        <button
          type="submit"
          className={`${styles.button} ${styles.buttonPrimary}`}
        >
          צור שאילתה
        </button>
      </div>
    </form>
  );
};

export default InsertDataForm;
