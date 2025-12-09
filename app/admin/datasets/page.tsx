"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Save, 
  ArrowLeft, 
  Database, 
  Table, 
  Columns, 
  List, 
  Edit3, 
  Trash2, 
  Eye,
  Zap,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  BarChart3
} from 'lucide-react';
import AdminLayout from '@/app/components/admin/AdminLayout';
import styles from './datasets.module.css';

interface Dataset {
  id: string;
  name: string;
  description: string;
  scenario: string;
  story: string;
  previewTables: Array<{
    name: string;
    columns: string[];
  }>;
  tags: string[];
  updatedAt: string;
}

interface GenerationStatus {
  id: string;
  datasetId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  generatedRows?: number;
}

interface DataGenerationConfig {
  targetRows: number;
  preserveExisting: boolean;
  dataTypes: {
    names: boolean;
    emails: boolean;
    dates: boolean;
    numbers: boolean;
    text: boolean;
  };
  patterns: {
    realistic: boolean;
    relationships: boolean;
    constraints: boolean;
  };
}

const DatasetsPage: React.FC = () => {
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [showExpansionPanel, setShowExpansionPanel] = useState(false);
  const [generationConfig, setGenerationConfig] = useState<DataGenerationConfig>({
    targetRows: 5000,
    preserveExisting: true,
    dataTypes: {
      names: true,
      emails: true,
      dates: true,
      numbers: true,
      text: true,
    },
    patterns: {
      realistic: true,
      relationships: true,
      constraints: true,
    },
  });
  const [generationStatuses, setGenerationStatuses] = useState<GenerationStatus[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; issues: string[] } | null>(null);
  const [generatedDataPreview, setGeneratedDataPreview] = useState<any>(null);

  // Load datasets
  const loadDatasets = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/datasets');
      if (response.ok) {
        const data = await response.json();
        setDatasets(data.items || []);
      }
    } catch (error) {
      console.error('Error loading datasets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load generation statuses for a dataset
  const loadGenerationStatuses = async (datasetId: string) => {
    try {
      const response = await fetch(`/api/datasets/${datasetId}/generation-status`);
      if (response.ok) {
        const data = await response.json();
        setGenerationStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error('Error loading generation statuses:', error);
    }
  };

  // Start data generation
  const startGeneration = async () => {
    if (!selectedDataset) return;

    setIsGenerating(true);
    try {
      const response = await fetch(`/api/datasets/${selectedDataset.id}/expand`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(generationConfig),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Data generation started! Generation ID: ${data.generationId}`);
        loadGenerationStatuses(selectedDataset.id);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error starting generation:', error);
      alert('Error starting data generation');
    } finally {
      setIsGenerating(false);
    }
  };

  // Rollback generation
  const rollbackGeneration = async () => {
    if (!selectedDataset) return;

    if (!confirm('Are you sure you want to rollback the generated data?')) {
      return;
    }

    try {
      const response = await fetch(`/api/datasets/${selectedDataset.id}/rollback`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Dataset rolled back successfully');
        loadGenerationStatuses(selectedDataset.id);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error rolling back:', error);
      alert('Error rolling back dataset');
    }
  };

  // Validate generated data
  const validateData = async () => {
    if (!selectedDataset) return;

    try {
      const response = await fetch(`/api/datasets/${selectedDataset.id}/validate`);
      if (response.ok) {
        const result = await response.json();
        setValidationResult(result);
      }
    } catch (error) {
      console.error('Error validating data:', error);
    }
  };

  // Preview generated data
  const previewGeneratedData = async () => {
    if (!selectedDataset) return;

    try {
      const response = await fetch(`/api/datasets/${selectedDataset.id}/preview-generated`);
      if (response.ok) {
        const result = await response.json();
        setGeneratedDataPreview(result);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to load preview'}`);
      }
    } catch (error) {
      console.error('Error previewing generated data:', error);
      alert('Error loading generated data preview');
    }
  };

  // Handle dataset selection
  const handleDatasetSelect = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setShowExpansionPanel(true);
    loadGenerationStatuses(dataset.id);
    setValidationResult(null);
  };

  // Load datasets on mount
  useEffect(() => {
    loadDatasets();
  }, []);

  // Poll for generation status updates
  useEffect(() => {
    if (selectedDataset && generationStatuses.some(status => status.status === 'running')) {
      const interval = setInterval(() => {
        loadGenerationStatuses(selectedDataset.id);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [selectedDataset, generationStatuses]);

  return (
    <AdminLayout
      activeTab="datasets"
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
        </div>

        <div className={styles.content}>
          {/* Datasets List */}
          <div className={styles.datasetsSection}>
            <div className={styles.sectionHeader}>
              <h2>רשימת מסדי נתונים</h2>
              <div className={styles.stats}>
                <span>סה"כ: {datasets.length} מסדי נתונים</span>
              </div>
            </div>

            {isLoading ? (
              <div className={styles.loadingState}>
                <div className={styles.loadingSpinner}></div>
                <p>טוען מסדי נתונים...</p>
              </div>
            ) : datasets.length === 0 ? (
              <div className={styles.emptyState}>
                <Database size={48} />
                <h3>אין מסדי נתונים</h3>
                <p>עדיין לא נוצרו מסדי נתונים במערכת</p>
              </div>
            ) : (
              <div className={styles.datasetsGrid}>
                {datasets.map((dataset) => (
                  <div key={dataset.id} className={styles.datasetCard}>
                    <div className={styles.datasetHeader}>
                      <div className={styles.datasetTitle}>
                        <Database size={20} />
                        <h3>{dataset.name}</h3>
                      </div>
                      <div className={styles.datasetActions}>
                        <button
                          onClick={() => handleDatasetSelect(dataset)}
                          className={styles.actionButton}
                          title="Expand Dataset"
                        >
                          <Zap size={16} />
                        </button>
                        <button
                          onClick={() => router.push(`/admin/databases`)}
                          className={styles.actionButton}
                          title="Edit"
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {dataset.description && (
                      <p className={styles.datasetDescription}>{dataset.description}</p>
                    )}
                    
                    <div className={styles.datasetMeta}>
                      <div className={styles.datasetTables}>
                        <Table size={16} />
                        <span>{dataset.previewTables.length} טבלאות</span>
                      </div>
                      <div className={styles.datasetDates}>
                        <span>עודכן: {new Date(dataset.updatedAt).toLocaleDateString('he-IL')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expansion Panel */}
          {showExpansionPanel && selectedDataset && (
            <div className={styles.expansionPanel}>
              <div className={styles.panelHeader}>
                <h2>הרחבת מסד נתונים: {selectedDataset.name}</h2>
                <button
                  onClick={() => setShowExpansionPanel(false)}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>

              <div className={styles.panelContent}>
                {/* Dataset Info */}
                <div className={styles.datasetInfo}>
                  <h3>מידע על מסד הנתונים</h3>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <label>מספר טבלאות:</label>
                      <span>{selectedDataset.previewTables.length}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <label>סה"כ עמודות:</label>
                      <span>{selectedDataset.previewTables.reduce((sum, table) => sum + table.columns.length, 0)}</span>
                    </div>
                  </div>
                  
                  <div className={styles.tablesList}>
                    <h4>טבלאות:</h4>
                    {selectedDataset.previewTables.map((table, index) => (
                      <div key={index} className={styles.tableItem}>
                        <Table size={16} />
                        <span>{table.name}</span>
                        <span className={styles.columnCount}>({table.columns.length} עמודות)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generation Configuration */}
                <div className={styles.configSection}>
                  <h3>הגדרות יצירת נתונים</h3>
                  
                  <div className={styles.configGrid}>
                    <div className={styles.configItem}>
                      <label>מספר שורות יעד:</label>
                      <input
                        type="number"
                        value={generationConfig.targetRows}
                        onChange={(e) => setGenerationConfig(prev => ({
                          ...prev,
                          targetRows: parseInt(e.target.value) || 5000
                        }))}
                        min="100"
                        max="50000"
                      />
                    </div>
                    
                    <div className={styles.configItem}>
                      <label>
                        <input
                          type="checkbox"
                          checked={generationConfig.preserveExisting}
                          onChange={(e) => setGenerationConfig(prev => ({
                            ...prev,
                            preserveExisting: e.target.checked
                          }))}
                        />
                        שמור נתונים קיימים
                      </label>
                    </div>
                  </div>

                  <div className={styles.dataTypesSection}>
                    <h4>סוגי נתונים:</h4>
                    <div className={styles.checkboxGrid}>
                      {Object.entries(generationConfig.dataTypes).map(([key, value]) => (
                        <label key={key} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setGenerationConfig(prev => ({
                              ...prev,
                              dataTypes: {
                                ...prev.dataTypes,
                                [key]: e.target.checked
                              }
                            }))}
                          />
                          {key === 'names' ? 'שמות' :
                           key === 'emails' ? 'כתובות אימייל' :
                           key === 'dates' ? 'תאריכים' :
                           key === 'numbers' ? 'מספרים' :
                           key === 'text' ? 'טקסט' : key}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className={styles.patternsSection}>
                    <h4>דפוסי נתונים:</h4>
                    <div className={styles.checkboxGrid}>
                      {Object.entries(generationConfig.patterns).map(([key, value]) => (
                        <label key={key} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setGenerationConfig(prev => ({
                              ...prev,
                              patterns: {
                                ...prev.patterns,
                                [key]: e.target.checked
                              }
                            }))}
                          />
                          {key === 'realistic' ? 'נתונים ריאליסטיים' :
                           key === 'relationships' ? 'קשרים בין טבלאות' :
                           key === 'constraints' ? 'אילוצי נתונים' : key}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generation Status */}
                {generationStatuses.length > 0 && (
                  <div className={styles.statusSection}>
                    <h3>סטטוס יצירת נתונים</h3>
                    {generationStatuses.map((status) => (
                      <div key={status.id} className={styles.statusItem}>
                        <div className={styles.statusHeader}>
                          <div className={styles.statusInfo}>
                            {status.status === 'completed' && <CheckCircle size={20} className={styles.successIcon} />}
                            {status.status === 'failed' && <AlertCircle size={20} className={styles.errorIcon} />}
                            {status.status === 'running' && <Clock size={20} className={styles.runningIcon} />}
                            {status.status === 'pending' && <Clock size={20} className={styles.pendingIcon} />}
                            <span className={styles.statusText}>
                              {status.status === 'completed' ? 'הושלם' :
                               status.status === 'failed' ? 'נכשל' :
                               status.status === 'running' ? 'רץ' :
                               status.status === 'pending' ? 'ממתין' : status.status}
                            </span>
                          </div>
                          <div className={styles.statusProgress}>
                            <div className={styles.progressBar}>
                              <div 
                                className={styles.progressFill}
                                style={{ width: `${status.progress}%` }}
                              />
                            </div>
                            <span>{status.progress}%</span>
                          </div>
                        </div>
                        <p className={styles.statusMessage}>{status.message}</p>
                        {status.error && (
                          <p className={styles.errorMessage}>{status.error}</p>
                        )}
                        {status.generatedRows && (
                          <p className={styles.successMessage}>
                            נוצרו {status.generatedRows} שורות
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Validation Result */}
                {validationResult && (
                  <div className={styles.validationSection}>
                    <h3>תוצאות אימות נתונים</h3>
                    <div className={`${styles.validationResult} ${validationResult.valid ? styles.valid : styles.invalid}`}>
                      {validationResult.valid ? (
                        <CheckCircle size={20} className={styles.successIcon} />
                      ) : (
                        <AlertCircle size={20} className={styles.errorIcon} />
                      )}
                      <span>
                        {validationResult.valid ? 'הנתונים תקינים' : 'נמצאו בעיות בנתונים'}
                      </span>
                    </div>
                    {validationResult.issues.length > 0 && (
                      <div className={styles.validationIssues}>
                        <h4>בעיות שנמצאו:</h4>
                        <ul>
                          {validationResult.issues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Generated Data Preview */}
                {generatedDataPreview && (
                  <div className={styles.previewSection}>
                    <h3>תצוגה מקדימה של הנתונים שנוצרו</h3>
                    <div className={styles.previewStats}>
                      <div className={styles.statItem}>
                        <label>מספר טבלאות:</label>
                        <span>{generatedDataPreview.totalTables}</span>
                      </div>
                      <div className={styles.statItem}>
                        <label>סה"כ שורות:</label>
                        <span>{generatedDataPreview.totalRows}</span>
                      </div>
                      <div className={styles.statItem}>
                        <label>נוצר בתאריך:</label>
                        <span>{new Date(generatedDataPreview.generatedAt).toLocaleString('he-IL')}</span>
                      </div>
                    </div>
                    
                    <div className={styles.previewTables}>
                      {Object.entries(generatedDataPreview.preview).map(([tableName, tableData]: [string, any]) => (
                        <div key={tableName} className={styles.previewTable}>
                          <h4>טבלה: {tableName}</h4>
                          <div className={styles.previewTableContent}>
                            <div className={styles.previewTableHeader}>
                              {tableData.length > 0 && Object.keys(tableData[0]).map(column => (
                                <div key={column} className={styles.previewColumnHeader}>{column}</div>
                              ))}
                            </div>
                            <div className={styles.previewTableBody}>
                              {tableData.slice(0, 3).map((row: any, index: number) => (
                                <div key={index} className={styles.previewTableRow}>
                                  {Object.values(row).map((value: any, colIndex: number) => (
                                    <div key={colIndex} className={styles.previewTableCell}>
                                      {typeof value === 'string' && value.length > 20 
                                        ? `${value.substring(0, 20)}...` 
                                        : String(value)}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className={styles.actionButtons}>
                  <button
                    onClick={startGeneration}
                    disabled={isGenerating}
                    className={styles.generateButton}
                  >
                    <Zap size={20} />
                    {isGenerating ? 'יוצר נתונים...' : 'התחל יצירת נתונים'}
                  </button>
                  
                  <button
                    onClick={rollbackGeneration}
                    className={styles.rollbackButton}
                  >
                    <RotateCcw size={20} />
                    החזר למצב קודם
                  </button>
                  
                  <button
                    onClick={validateData}
                    className={styles.validateButton}
                  >
                    <CheckCircle size={20} />
                    אמת נתונים
                  </button>
                  
                  <button
                    onClick={previewGeneratedData}
                    className={styles.previewButton}
                  >
                    <Eye size={20} />
                    תצוגה מקדימה
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default DatasetsPage;
