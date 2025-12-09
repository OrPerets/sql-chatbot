"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Filter, BookOpen, Edit3, Trash2, Copy, AlertCircle, X, Eye, Play } from "lucide-react";
import styles from "./templates.module.css";

interface VariableDefinition {
  id: string;
  name: string;
  type: string;
  description?: string;
  constraints?: any;
  defaultValue?: any;
  required?: boolean;
}

interface QuestionTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  variables: VariableDefinition[];
  expectedResultSchema?: Array<{ column: string; type: string }>;
  starterSql?: string;
  instructions?: string;
  gradingRubric?: any[];
  datasetId?: string;
  maxAttempts?: number;
  points?: number;
  evaluationMode?: "auto" | "manual" | "custom";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<QuestionTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/templates');
      const data = await response.json();
      
      if (data.success) {
        setTemplates(data.data);
      } else {
        setError(data.error || 'Failed to load templates');
      }
    } catch (err) {
      setError('Failed to load templates');
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTemplates(templates.filter(t => t.id !== templateId));
        if (selectedTemplate?.id === templateId) {
          setSelectedTemplate(null);
        }
      } else {
        setError(data.error || 'Failed to delete template');
      }
    } catch (err) {
      setError('Failed to delete template');
      console.error('Error deleting template:', err);
    }
  };

  const handlePreviewTemplate = async (template: QuestionTemplate) => {
    try {
      const response = await fetch(`/api/templates/${template.id}/preview?sampleCount=3`);
      const data = await response.json();
      
      if (data.success) {
        setPreviewData(data.data);
        setSelectedTemplate(template);
        setShowPreview(true);
      } else {
        setError(data.error || 'Failed to preview template');
      }
    } catch (err) {
      setError('Failed to preview template');
      console.error('Error previewing template:', err);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.template.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>תבניות שאלות</h1>
          <p>ניהול תבניות שאלות פרמטריות עם משתנים דינמיים</p>
        </div>
        
        <div className={styles.actions}>
          <Link href="/admin/templates/new" className={styles.createButton}>
            <Plus size={20} />
            צור תבנית
          </Link>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className={styles.closeButton}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <Search size={20} />
          <input
            type="text"
            placeholder="חיפוש תבניות..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.templatesGrid}>
        {filteredTemplates.length === 0 ? (
          <div className={styles.emptyState}>
            <BookOpen size={48} />
            <h3>לא נמצאו תבניות</h3>
            <p>
              {searchTerm 
                ? "אין תבניות התואמות לקריטריוני החיפוש שלך" 
                : "צור את התבנית הפרמטרית הראשונה שלך"
              }
            </p>
            {!searchTerm && (
              <Link href="/admin/templates/new" className={styles.createButton}>
                <Plus size={20} />
                צור תבנית
              </Link>
            )}
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <div key={template.id} className={styles.templateCard}>
              <div className={styles.templateHeader}>
                <h3>{template.name}</h3>
                <div className={styles.templateActions}>
                  <button
                    onClick={() => handlePreviewTemplate(template)}
                    className={styles.actionButton}
                    title="תצוגה מקדימה"
                  >
                    <Eye size={16} />
                  </button>
                  <Link
                    href={`/admin/templates/${template.id}/edit`}
                    className={styles.actionButton}
                    title="ערוך תבנית"
                  >
                    <Edit3 size={16} />
                  </Link>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className={styles.actionButton}
                    title="מחק תבנית"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {template.description && (
                <p className={styles.templateDescription}>{template.description}</p>
              )}
              
              <div className={styles.templateInfo}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>משתנים:</span>
                  <span className={styles.infoValue}>{template.variables.length}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>גרסה:</span>
                  <span className={styles.infoValue}>{template.version}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>עודכן:</span>
                  <span className={styles.infoValue}>
                    {new Date(template.updatedAt).toLocaleDateString('he-IL')}
                  </span>
                </div>
              </div>
              
              <div className={styles.templatePreview}>
                <div className={styles.previewLabel}>תצוגה מקדימה:</div>
                <div className={styles.previewText}>
                  {template.template.length > 100 
                    ? `${template.template.substring(0, 100)}...` 
                    : template.template
                  }
                </div>
              </div>
              
              <div className={styles.variablesList}>
                <div className={styles.variablesLabel}>משתנים:</div>
                <div className={styles.variablesTags}>
                  {template.variables.map((variable) => (
                    <span key={variable.id} className={styles.variableTag}>
                      {variable.name} ({variable.type})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showPreview && selectedTemplate && (
        <div className={styles.previewModal}>
          <div className={styles.previewContent}>
            <div className={styles.previewHeader}>
              <h2>תצוגה מקדימה: {selectedTemplate.name}</h2>
              <button
                onClick={() => setShowPreview(false)}
                className={styles.closeButton}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.previewBody}>
              <div className={styles.previewSection}>
                <h3>טקסט התבנית:</h3>
                <div className={styles.templateText}>
                  {selectedTemplate.template}
                </div>
              </div>
              
              <div className={styles.previewSection}>
                <h3>דוגמאות יצירה:</h3>
                {previewData.map((preview, index) => (
                  <div key={index} className={styles.samplePreview}>
                    <div className={styles.sampleHeader}>
                      <span>דוגמה {index + 1}</span>
                    </div>
                    <div className={styles.sampleContent}>
                      {preview.preview}
                    </div>
                    <div className={styles.sampleVariables}>
                      <strong>משתנים בשימוש:</strong>
                      <div className={styles.variableValues}>
                        {preview.variables.map((variable: any) => (
                          <span key={variable.variableId} className={styles.variableValue}>
                            {variable.variableId}: {String(variable.value)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
