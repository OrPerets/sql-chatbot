"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, ArrowLeft, Database, Table, Columns, List, Edit3, Trash2, Eye } from 'lucide-react';
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

interface ExistingDataset {
  id: string;
  name: string;
  description: string;
  scenario: string;
  story: string;
  previewTables: any[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const DatabaseCreationPage: React.FC = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentView, setCurrentView] = useState<'create' | 'list'>('create');
  const [isEditing, setIsEditing] = useState(false);
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [existingDatasets, setExistingDatasets] = useState<ExistingDataset[]>([]);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [formData, setFormData] = useState<DatabaseFormData>({
    name: '',
    description: '',
    scenario: '',
    story: '',
    tables: []
  });

  // Load existing datasets
  const loadExistingDatasets = async () => {
    setIsLoadingDatasets(true);
    try {
      const response = await fetch('/api/datasets');
      if (response.ok) {
        const data = await response.json();
        setExistingDatasets(data.items || []);
      } else {
        console.error('Failed to load datasets');
      }
    } catch (error) {
      console.error('Error loading datasets:', error);
    } finally {
      setIsLoadingDatasets(false);
    }
  };

  // Load datasets when switching to list view
  useEffect(() => {
    if (currentView === 'list') {
      loadExistingDatasets();
    }
  }, [currentView]);

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
      if (isEditing && editingDatasetId) {
        const datasetResponse = await fetch(`/api/datasets/${editingDatasetId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            scenario: formData.scenario,
            story: formData.story,
          }),
        });

        if (!datasetResponse.ok) {
          throw new Error('Failed to update dataset');
        }

        await datasetResponse.json();
        alert('מסד הנתונים עודכן בהצלחה!');
        setIsEditing(false);
        setEditingDatasetId(null);
        setFormData({ name: '', description: '', scenario: '', story: '', tables: [] });
        setCurrentView('list');
        loadExistingDatasets();
      } else {
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
        // Reset form
        setFormData({
          name: '',
          description: '',
          scenario: '',
          story: '',
          tables: []
        });
        // Switch to list view to show the new dataset
        setCurrentView('list');
        loadExistingDatasets();
      }
    } catch (error) {
      console.error('Error saving database:', error);
      alert('שגיאה בשמירת מסד הנתונים');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את מסד הנתונים?')) {
      return;
    }

    try {
      const response = await fetch(`/api/datasets/${datasetId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('מסד הנתונים נמחק בהצלחה!');
        loadExistingDatasets();
      } else {
        throw new Error('Failed to delete dataset');
      }
    } catch (error) {
      console.error('Error deleting dataset:', error);
      alert('שגיאה במחיקת מסד הנתונים');
    }
  };

  const handleEditDataset = async (datasetId: string) => {
    try {
      const res = await fetch(`/api/datasets/${datasetId}`);
      if (!res.ok) {
        throw new Error('Failed to load dataset');
      }
      const dataset = await res.json();

      // Convert previewTables to TableDefinition format
      const tables: TableDefinition[] = (dataset.previewTables || []).map((table: any, index: number) => ({
        id: `table_${index}`,
        name: table.name || '',
        description: `Table with ${table.columns?.length || 0} columns`,
        columns: (table.columns || []).map((colName: string, colIndex: number) => ({
          id: `column_${index}_${colIndex}`,
          name: colName,
          type: 'VARCHAR(255)', // Default type
          nullable: true,
          description: ''
        }))
      }));

      setFormData({
        name: dataset.name || '',
        description: dataset.description || '',
        scenario: dataset.scenario || '',
        story: dataset.story || '',
        tables: tables
      });

      setIsEditing(true);
      setEditingDatasetId(datasetId);
      setCurrentView('create');
    } catch (error) {
      console.error('Error loading dataset for edit:', error);
      alert('שגיאה בטעינת מסד הנתונים לעריכה');
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
            <h1>ניהול מסדי נתונים</h1>
          </div>
          <div className={styles.viewToggle}>
            <button
              onClick={() => setCurrentView('create')}
              className={`${styles.toggleButton} ${currentView === 'create' ? styles.active : ''}`}
            >
              <Plus size={20} />
              יצירת מסד חדש
            </button>
            <button
              onClick={() => setCurrentView('list')}
              className={`${styles.toggleButton} ${currentView === 'list' ? styles.active : ''}`}
            >
              <List size={20} />
              רשימת מסדי נתונים
            </button>
          </div>
        </div>

        {currentView === 'create' ? (
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
                <p>לחץ על &quot;הוסף טבלה&quot; כדי להתחיל</p>
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
              disabled={isSubmitting || (!isEditing && !canSubmit)}
              className={`${styles.submitButton} ${!canSubmit ? styles.disabled : ''}`}
            >
              <Save size={20} />
              {isSubmitting ? (isEditing ? 'שומר...' : 'יוצר...') : (isEditing ? 'שמור שינויים' : 'צור מסד נתונים')}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditingDatasetId(null);
                  setFormData({ name: '', description: '', scenario: '', story: '', tables: [] });
                  setCurrentView('list');
                }}
                className={styles.cancelButton}
              >
                בטל
              </button>
            )}
          </div>
        </form>
        ) : (
          <div className={styles.datasetsList}>
            <div className={styles.listHeader}>
              <h2>רשימת מסדי נתונים קיימים</h2>
              <div className={styles.stats}>
                <span>סה&quot;כ: {existingDatasets.length} מסדי נתונים</span>
              </div>
            </div>

            {isLoadingDatasets ? (
              <div className={styles.loadingState}>
                <div className={styles.loadingSpinner}></div>
                <p>טוען מסדי נתונים...</p>
              </div>
            ) : existingDatasets.length === 0 ? (
              <div className={styles.emptyState}>
                <Database size={48} />
                <h3>אין מסדי נתונים</h3>
                <p>עדיין לא נוצרו מסדי נתונים במערכת</p>
                <button 
                  onClick={() => setCurrentView('create')}
                  className={styles.createButton}
                >
                  <Plus size={20} />
                  צור מסד נתונים ראשון
                </button>
              </div>
            ) : (
              <div className={styles.datasetsGrid}>
                {existingDatasets.map((dataset) => (
                  <div key={dataset.id} className={styles.datasetCard}>
                    <div className={styles.datasetHeader}>
                      <div className={styles.datasetTitle}>
                        <Database size={20} />
                        <h3>{dataset.name}</h3>
                      </div>
                      <div className={styles.datasetActions}>
                        <button
                          onClick={() => handleEditDataset(dataset.id)}
                          className={styles.actionButton}
                          title="עריכה"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteDataset(dataset.id)}
                          className={styles.actionButton}
                          title="מחיקה"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {dataset.description && (
                      <p className={styles.datasetDescription}>{dataset.description}</p>
                    )}
                    
                    {dataset.scenario && (
                      <div className={styles.datasetScenario}>
                        <strong>תרחיש:</strong> {dataset.scenario}
                      </div>
                    )}
                    
                    <div className={styles.datasetMeta}>
                      <div className={styles.datasetTags}>
                        {dataset.tags.map(tag => (
                          <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                      </div>
                      <div className={styles.datasetDates}>
                        <span>נוצר: {new Date(dataset.createdAt).toLocaleDateString('he-IL')}</span>
                        <span>עודכן: {new Date(dataset.updatedAt).toLocaleDateString('he-IL')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default DatabaseCreationPage;
