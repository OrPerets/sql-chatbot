"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, ArrowLeft, Database, Table, Columns } from 'lucide-react';
import AdminLayout from '@/app/components/admin/AdminLayout';
import styles from './databases.module.css';

interface TableDefinition {
  id: string;
  name: string;
  description: string;
  columns: ColumnDefinition[];
}

interface ColumnDefinition {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  description: string;
}

interface DatabaseFormData {
  name: string;
  description: string;
  scenario: string;
  story: string;
  tables: TableDefinition[];
}

const DatabaseCreationPage: React.FC = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<DatabaseFormData>({
    name: '',
    description: '',
    scenario: '',
    story: '',
    tables: []
  });

  const addTable = () => {
    const newTable: TableDefinition = {
      id: `table_${Date.now()}`,
      name: '',
      description: '',
      columns: []
    };
    setFormData(prev => ({
      ...prev,
      tables: [...prev.tables, newTable]
    }));
  };

  const updateTable = (tableId: string, updates: Partial<TableDefinition>) => {
    setFormData(prev => ({
      ...prev,
      tables: prev.tables.map(table =>
        table.id === tableId ? { ...table, ...updates } : table
      )
    }));
  };

  const removeTable = (tableId: string) => {
    setFormData(prev => ({
      ...prev,
      tables: prev.tables.filter(table => table.id !== tableId)
    }));
  };

  const addColumn = (tableId: string) => {
    const newColumn: ColumnDefinition = {
      id: `column_${Date.now()}`,
      name: '',
      type: 'VARCHAR(255)',
      nullable: true,
      description: ''
    };
    
    updateTable(tableId, {
      columns: [...formData.tables.find(t => t.id === tableId)?.columns || [], newColumn]
    });
  };

  const updateColumn = (tableId: string, columnId: string, updates: Partial<ColumnDefinition>) => {
    updateTable(tableId, {
      columns: formData.tables.find(t => t.id === tableId)?.columns.map(col =>
        col.id === columnId ? { ...col, ...updates } : col
      ) || []
    });
  };

  const removeColumn = (tableId: string, columnId: string) => {
    updateTable(tableId, {
      columns: formData.tables.find(t => t.id === tableId)?.columns.filter(col => col.id !== columnId) || []
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create the dataset with basic information
      const datasetResponse = await fetch('/api/datasets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          scenario: formData.scenario,
          story: formData.story,
          tags: ['admin-created']
        }),
      });

      if (!datasetResponse.ok) {
        throw new Error('Failed to create dataset');
      }

      const createdDataset = await datasetResponse.json();
      console.log('Created dataset:', createdDataset);
      
      alert('מסד הנתונים נוצר בהצלחה!');
      router.push('/admin');
    } catch (error) {
      console.error('Error creating database:', error);
      alert('שגיאה ביצירת מסד הנתונים');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = formData.name.trim() && 
                   formData.tables.length > 0 &&
                   formData.tables.every(table => 
                     table.name.trim() && 
                     table.description.trim() && 
                     table.columns.length > 0 &&
                     table.columns.every(col => col.name.trim())
                   );

  return (
    <AdminLayout
      activeTab="databases"
      onTabChange={() => {}}
      currentUser={null}
      onLogout={() => {}}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <button 
            onClick={() => router.back()}
            className={styles.backButton}
          >
            <ArrowLeft size={20} />
            חזור
          </button>
          <div className={styles.titleSection}>
            <Database size={32} />
            <h1>יצירת מסד נתונים חדש</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Basic Information */}
          <section className={styles.section}>
            <h2>מידע בסיסי</h2>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label htmlFor="name">שם מסד הנתונים *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="לדוגמה: מסד נתונים לחברה"
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="description">תיאור קצר</label>
                <input
                  id="description"
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="תיאור קצר של מסד הנתונים"
                />
              </div>
            </div>
          </section>

          {/* Scenario & Story */}
          <section className={styles.section}>
            <h2>תרחיש וסיפור</h2>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label htmlFor="scenario">תרחיש עסקי</label>
                <textarea
                  id="scenario"
                  value={formData.scenario}
                  onChange={(e) => setFormData(prev => ({ ...prev, scenario: e.target.value }))}
                  placeholder="תאר את התרחיש העסקי או הקונטקסט של מסד הנתונים..."
                  rows={4}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="story">סיפור רקע</label>
                <textarea
                  id="story"
                  value={formData.story}
                  onChange={(e) => setFormData(prev => ({ ...prev, story: e.target.value }))}
                  placeholder="ספר את הסיפור מאחורי הנתונים - מה הם מייצגים, איך הם מתחברים, וכו'..."
                  rows={4}
                />
              </div>
            </div>
          </section>

          {/* Tables */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>טבלאות</h2>
              <button
                type="button"
                onClick={addTable}
                className={styles.addButton}
              >
                <Plus size={20} />
                הוסף טבלה
              </button>
            </div>

            {formData.tables.length === 0 ? (
              <div className={styles.emptyState}>
                <Table size={48} />
                <p>אין טבלאות במסד הנתונים</p>
                <p>לחץ על "הוסף טבלה" כדי להתחיל</p>
              </div>
            ) : (
              <div className={styles.tablesContainer}>
                {formData.tables.map((table, index) => (
                  <div key={table.id} className={styles.tableCard}>
                    <div className={styles.tableHeader}>
                      <div className={styles.tableTitle}>
                        <Table size={20} />
                        <span>טבלה {index + 1}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTable(table.id)}
                        className={styles.removeButton}
                      >
                        ×
                      </button>
                    </div>

                    <div className={styles.fieldGroup}>
                      <div className={styles.field}>
                        <label>שם הטבלה *</label>
                        <input
                          type="text"
                          value={table.name}
                          onChange={(e) => updateTable(table.id, { name: e.target.value })}
                          placeholder="לדוגמה: customers"
                          required
                        />
                      </div>
                      <div className={styles.field}>
                        <label>תיאור הטבלה *</label>
                        <input
                          type="text"
                          value={table.description}
                          onChange={(e) => updateTable(table.id, { description: e.target.value })}
                          placeholder="תיאור של מה הטבלה מכילה"
                          required
                        />
                      </div>
                    </div>

                    {/* Columns */}
                    <div className={styles.columnsSection}>
                      <div className={styles.columnsHeader}>
                        <Columns size={16} />
                        <span>עמודות</span>
                        <button
                          type="button"
                          onClick={() => addColumn(table.id)}
                          className={styles.addColumnButton}
                        >
                          <Plus size={16} />
                          הוסף עמודה
                        </button>
                      </div>

                      {table.columns.length === 0 ? (
                        <div className={styles.emptyColumns}>
                          <p>אין עמודות בטבלה</p>
                        </div>
                      ) : (
                        <div className={styles.columnsList}>
                          {table.columns.map((column, colIndex) => (
                            <div key={column.id} className={styles.columnCard}>
                              <div className={styles.columnHeader}>
                                <span>עמודה {colIndex + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => removeColumn(table.id, column.id)}
                                  className={styles.removeColumnButton}
                                >
                                  ×
                                </button>
                              </div>
                              <div className={styles.columnFields}>
                                <input
                                  type="text"
                                  value={column.name}
                                  onChange={(e) => updateColumn(table.id, column.id, { name: e.target.value })}
                                  placeholder="שם העמודה"
                                  required
                                />
                                <select
                                  value={column.type}
                                  onChange={(e) => updateColumn(table.id, column.id, { type: e.target.value })}
                                >
                                  <option value="VARCHAR(255)">VARCHAR(255)</option>
                                  <option value="INT">INT</option>
                                  <option value="DECIMAL(10,2)">DECIMAL(10,2)</option>
                                  <option value="DATE">DATE</option>
                                  <option value="DATETIME">DATETIME</option>
                                  <option value="BOOLEAN">BOOLEAN</option>
                                  <option value="TEXT">TEXT</option>
                                </select>
                                <label className={styles.checkboxLabel}>
                                  <input
                                    type="checkbox"
                                    checked={column.nullable}
                                    onChange={(e) => updateColumn(table.id, column.id, { nullable: e.target.checked })}
                                  />
                                  Nullable
                                </label>
                                <input
                                  type="text"
                                  value={column.description}
                                  onChange={(e) => updateColumn(table.id, column.id, { description: e.target.value })}
                                  placeholder="תיאור העמודה"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Submit */}
          <div className={styles.submitSection}>
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className={`${styles.submitButton} ${!canSubmit ? styles.disabled : ''}`}
            >
              <Save size={20} />
              {isSubmitting ? 'יוצר...' : 'צור מסד נתונים'}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default DatabaseCreationPage;
