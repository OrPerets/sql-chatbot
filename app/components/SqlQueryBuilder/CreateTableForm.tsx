"use client";

import React, { useState, useCallback } from 'react';
import styles from './SqlQueryBuilder.module.css';
import { Column, CreateTableData, COLUMN_TYPES, FormValidation, ValidationError } from './types';
import ColumnBuilder from './ColumnBuilder';

interface CreateTableFormProps {
  onQueryGenerated: (query: string) => void;
  onBack: () => void;
}

const CreateTableForm: React.FC<CreateTableFormProps> = ({
  onQueryGenerated,
  onBack,
}) => {
  const [formData, setFormData] = useState<CreateTableData>({
    tableName: '',
    columns: [
      {
        id: '1',
        name: '',
        type: 'VARCHAR',
        length: 255,
        nullable: true,
        primaryKey: false,
        autoIncrement: false,
        unique: false,
      },
    ],
    constraints: [],
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
    if (formData.columns.length === 0) {
      newErrors.push({ field: 'columns', message: 'חייב להיות לפחות עמודה אחת' });
    }

    const columnNames = new Set<string>();
    let hasPrimaryKey = false;

    formData.columns.forEach((column, index) => {
      // Validate column name
      if (!column.name.trim()) {
        newErrors.push({ field: `column-${index}-name`, message: `שם עמודה ${index + 1} הוא שדה חובה` });
      } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column.name.trim())) {
        newErrors.push({ field: `column-${index}-name`, message: `שם עמודה ${index + 1} חייב להתחיל באות או קו תחתון` });
      } else if (columnNames.has(column.name.toLowerCase())) {
        newErrors.push({ field: `column-${index}-name`, message: `שם עמודה "${column.name}" כבר קיים` });
      } else {
        columnNames.add(column.name.toLowerCase());
      }

      // Validate length for VARCHAR
      if (column.type === 'VARCHAR' && (!column.length || column.length <= 0)) {
        newErrors.push({ field: `column-${index}-length`, message: `עמודה ${index + 1}: אורך VARCHAR חייב להיות גדול מ-0` });
      }

      // Validate precision and scale for DECIMAL
      if (column.type === 'DECIMAL') {
        if (!column.precision || column.precision <= 0) {
          newErrors.push({ field: `column-${index}-precision`, message: `עמודה ${index + 1}: דיוק DECIMAL חייב להיות גדול מ-0` });
        }
        if (column.scale !== undefined && column.scale < 0) {
          newErrors.push({ field: `column-${index}-scale`, message: `עמודה ${index + 1}: קנה מידה DECIMAL לא יכולה להיות שלילית` });
        }
        if (column.precision && column.scale && column.scale > column.precision) {
          newErrors.push({ field: `column-${index}-scale`, message: `עמודה ${index + 1}: קנה המידה לא יכולה להיות גדולה מהדיוק` });
        }
      }

      // Check for multiple primary keys
      if (column.primaryKey) {
        if (hasPrimaryKey) {
          newErrors.push({ field: `column-${index}-primaryKey`, message: 'יכול להיות רק מפתח ראשי אחד' });
        } else {
          hasPrimaryKey = true;
        }
      }

      // Auto increment validation
      if (column.autoIncrement && !['INT', 'DECIMAL'].includes(column.type)) {
        newErrors.push({ field: `column-${index}-autoIncrement`, message: `עמודה ${index + 1}: AUTO_INCREMENT זמין רק עבור INT ו-DECIMAL` });
      }

      if (column.autoIncrement && !column.primaryKey) {
        newErrors.push({ field: `column-${index}-autoIncrement`, message: `עמודה ${index + 1}: AUTO_INCREMENT דורש PRIMARY KEY` });
      }
    });

    return {
      isValid: newErrors.length === 0,
      errors: newErrors,
    };
  }, [formData]);

  const generateSqlQuery = useCallback((): string => {
    const { tableName, columns } = formData;
    
    let query = `CREATE TABLE ${tableName} (\n`;
    
    const columnDefinitions: string[] = [];
    
    columns.forEach((column) => {
      let definition = `    ${column.name}`;
      
      // Add data type
      if (column.type === 'VARCHAR' && column.length) {
        definition += ` VARCHAR(${column.length})`;
      } else if (column.type === 'DECIMAL' && column.precision) {
        if (column.scale !== undefined) {
          definition += ` DECIMAL(${column.precision}, ${column.scale})`;
        } else {
          definition += ` DECIMAL(${column.precision})`;
        }
      } else {
        definition += ` ${column.type}`;
      }
      
      // Add constraints
      if (column.primaryKey) {
        definition += ' PRIMARY KEY';
      }
      
      if (column.autoIncrement) {
        definition += ' AUTO_INCREMENT';
      }
      
      if (!column.nullable && !column.primaryKey) {
        definition += ' NOT NULL';
      }
      
      if (column.unique && !column.primaryKey) {
        definition += ' UNIQUE';
      }
      
      if (column.defaultValue) {
        if (['VARCHAR', 'TEXT', 'DATE', 'DATETIME', 'TIMESTAMP'].includes(column.type)) {
          definition += ` DEFAULT '${column.defaultValue}'`;
        } else {
          definition += ` DEFAULT ${column.defaultValue}`;
        }
      }
      
      columnDefinitions.push(definition);
    });
    
    query += columnDefinitions.join(',\n');
    query += '\n);';
    
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

  const handleColumnsChange = (columns: Column[]) => {
    setFormData(prev => ({
      ...prev,
      columns,
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
        <label className={styles.label}>עמודות הטבלה *</label>
        <ColumnBuilder
          columns={formData.columns}
          onChange={handleColumnsChange}
          errors={errors}
        />
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

export default CreateTableForm;
