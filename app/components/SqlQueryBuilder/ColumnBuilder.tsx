"use client";

import React from 'react';
import styles from './SqlQueryBuilder.module.css';
import { Column, COLUMN_TYPES, ValidationError } from './types';

interface ColumnBuilderProps {
  columns: Column[];
  onChange: (columns: Column[]) => void;
  errors: ValidationError[];
}

const ColumnBuilder: React.FC<ColumnBuilderProps> = ({
  columns,
  onChange,
  errors,
}) => {
  const addColumn = () => {
    const newColumn: Column = {
      id: Date.now().toString(),
      name: '',
      type: 'VARCHAR',
      length: 255,
      nullable: true,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
    };
    onChange([...columns, newColumn]);
  };

  const removeColumn = (columnId: string) => {
    if (columns.length > 1) {
      onChange(columns.filter(col => col.id !== columnId));
    }
  };

  const updateColumn = (columnId: string, updates: Partial<Column>) => {
    onChange(columns.map(col => 
      col.id === columnId ? { ...col, ...updates } : col
    ));
  };

  const getColumnError = (fieldName: string) => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  const getColumnTypeConfig = (type: string) => {
    return COLUMN_TYPES.find(t => t.value === type) || COLUMN_TYPES[0];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {columns.map((column, index) => {
        const typeConfig = getColumnTypeConfig(column.type);
        
        return (
          <div
            key={column.id}
            style={{
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              padding: '16px',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#374151', fontSize: '16px' }}>
                עמודה {index + 1}
              </h4>
              {columns.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeColumn(column.id)}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  הסר
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {/* Column Name */}
              <div className={styles.formGroup}>
                <label className={styles.label}>שם העמודה *</label>
                <input
                  type="text"
                  className={`${styles.input} ${getColumnError(`column-${index}-name`) ? styles.error : ''}`}
                  value={column.name}
                  onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                  placeholder="לדוגמה: user_id, name, email"
                  dir="ltr"
                />
                {getColumnError(`column-${index}-name`) && (
                  <div className={styles.errorMessage}>
                    {getColumnError(`column-${index}-name`)}
                  </div>
                )}
              </div>

              {/* Column Type */}
              <div className={styles.formGroup}>
                <label className={styles.label}>סוג נתונים *</label>
                <select
                  className={styles.select}
                  value={column.type}
                  onChange={(e) => updateColumn(column.id, { 
                    type: e.target.value as Column['type'],
                    // Reset length/precision when changing type
                    length: e.target.value === 'VARCHAR' ? 255 : undefined,
                    precision: e.target.value === 'DECIMAL' ? 10 : undefined,
                    scale: e.target.value === 'DECIMAL' ? 2 : undefined,
                  })}
                >
                  {COLUMN_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Type-specific fields */}
            {typeConfig.hasLength && (
              <div style={{ marginBottom: '16px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>אורך מקסימלי</label>
                  <input
                    type="number"
                    className={`${styles.input} ${getColumnError(`column-${index}-length`) ? styles.error : ''}`}
                    value={column.length || ''}
                    onChange={(e) => updateColumn(column.id, { length: parseInt(e.target.value) || undefined })}
                    min="1"
                    max="65535"
                    placeholder="255"
                  />
                  {getColumnError(`column-${index}-length`) && (
                    <div className={styles.errorMessage}>
                      {getColumnError(`column-${index}-length`)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {typeConfig.hasPrecision && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>דיוק (Precision)</label>
                  <input
                    type="number"
                    className={`${styles.input} ${getColumnError(`column-${index}-precision`) ? styles.error : ''}`}
                    value={column.precision || ''}
                    onChange={(e) => updateColumn(column.id, { precision: parseInt(e.target.value) || undefined })}
                    min="1"
                    max="65"
                    placeholder="10"
                  />
                  {getColumnError(`column-${index}-precision`) && (
                    <div className={styles.errorMessage}>
                      {getColumnError(`column-${index}-precision`)}
                    </div>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>קנה מידה (Scale)</label>
                  <input
                    type="number"
                    className={`${styles.input} ${getColumnError(`column-${index}-scale`) ? styles.error : ''}`}
                    value={column.scale !== undefined ? column.scale : ''}
                    onChange={(e) => updateColumn(column.id, { scale: e.target.value ? parseInt(e.target.value) : undefined })}
                    min="0"
                    max="30"
                    placeholder="2"
                  />
                  {getColumnError(`column-${index}-scale`) && (
                    <div className={styles.errorMessage}>
                      {getColumnError(`column-${index}-scale`)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Default Value */}
            <div style={{ marginBottom: '16px' }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>ערך ברירת מחדל</label>
                <input
                  type="text"
                  className={styles.input}
                  value={column.defaultValue || ''}
                  onChange={(e) => updateColumn(column.id, { defaultValue: e.target.value || undefined })}
                  placeholder={
                    ['VARCHAR', 'TEXT'].includes(column.type) ? 'לדוגמה: &quot;ברירת מחדל&quot;' :
                    ['INT', 'DECIMAL'].includes(column.type) ? 'לדוגמה: 0' :
                    column.type === 'BOOLEAN' ? 'TRUE או FALSE' :
                    ['DATE', 'DATETIME', 'TIMESTAMP'].includes(column.type) ? 'CURRENT_DATE או CURRENT_TIMESTAMP' : ''
                  }
                  dir="ltr"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <label className={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={column.primaryKey}
                  onChange={(e) => updateColumn(column.id, { 
                    primaryKey: e.target.checked,
                    nullable: e.target.checked ? false : column.nullable,
                    unique: e.target.checked ? false : column.unique,
                  })}
                />
                מפתח ראשי (Primary Key)
              </label>

              <label className={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={column.autoIncrement}
                  onChange={(e) => updateColumn(column.id, { autoIncrement: e.target.checked })}
                  disabled={!['INT', 'DECIMAL'].includes(column.type)}
                />
                עלייה אוטומטית (Auto Increment)
              </label>

              <label className={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={column.unique}
                  onChange={(e) => updateColumn(column.id, { unique: e.target.checked })}
                  disabled={column.primaryKey}
                />
                ייחודי (Unique)
              </label>

              <label className={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={!column.nullable}
                  onChange={(e) => updateColumn(column.id, { nullable: !e.target.checked })}
                  disabled={column.primaryKey}
                />
                שדה חובה (Not Null)
              </label>
            </div>

            {/* Validation errors for checkboxes */}
            {getColumnError(`column-${index}-primaryKey`) && (
              <div className={styles.errorMessage}>
                {getColumnError(`column-${index}-primaryKey`)}
              </div>
            )}
            {getColumnError(`column-${index}-autoIncrement`) && (
              <div className={styles.errorMessage}>
                {getColumnError(`column-${index}-autoIncrement`)}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addColumn}
        className={`${styles.button} ${styles.buttonSecondary}`}
        style={{ alignSelf: 'flex-start' }}
      >
        + הוסף עמודה
      </button>
    </div>
  );
};

export default ColumnBuilder;
