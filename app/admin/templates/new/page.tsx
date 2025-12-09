"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Eye, AlertCircle, X, Plus, Trash2, Code, Settings } from "lucide-react";
import styles from "../template-editor.module.css";

interface VariableDefinition {
  id: string;
  name: string;
  type: string;
  description?: string;
  constraints?: any;
  defaultValue?: any;
  required?: boolean;
}

const VARIABLE_TYPES = [
  { value: 'number', label: 'מספר' },
  { value: 'string', label: 'מחרוזת' },
  { value: 'date', label: 'תאריך' },
  { value: 'list', label: 'רשימה' },
  { value: 'range', label: 'טווח' },
  { value: 'sql_value', label: 'ערך SQL' },
  { value: 'table_name', label: 'שם טבלה' },
  { value: 'column_name', label: 'שם עמודה' },
];

export default function NewTemplatePage() {
  const router = useRouter();
  const [template, setTemplate] = useState({
    name: '',
    description: '',
    template: '',
    variables: [] as VariableDefinition[],
    expectedResultSchema: [] as Array<{ column: string; type: string }>,
    starterSql: '',
    instructions: '',
    gradingRubric: [] as any[],
    datasetId: '',
    maxAttempts: 3,
    points: 10,
    evaluationMode: 'auto' as 'auto' | 'manual' | 'custom',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addVariable = () => {
    const newVariable: VariableDefinition = {
      id: generateId(),
      name: '',
      type: 'string',
      description: '',
      constraints: {},
      defaultValue: '',
      required: false,
    };
    setTemplate(prev => ({
      ...prev,
      variables: [...prev.variables, newVariable]
    }));
  };

  const updateVariable = (index: number, field: keyof VariableDefinition, value: any) => {
    setTemplate(prev => ({
      ...prev,
      variables: prev.variables.map((variable, i) => 
        i === index ? { ...variable, [field]: value } : variable
      )
    }));
  };

  const removeVariable = (index: number) => {
    setTemplate(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }));
  };

  const validateTemplate = async () => {
    try {
      const response = await fetch('/api/templates/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: template.template,
          variables: template.variables
        })
      });

      const data = await response.json();
      if (data.success) {
        setValidationErrors(data.data.errors);
        return data.data.isValid;
      } else {
        setValidationErrors([data.error]);
        return false;
      }
    } catch (err) {
      setValidationErrors(['Failed to validate template']);
      return false;
    }
  };

  const handlePreview = async () => {
    const isValid = await validateTemplate();
    if (!isValid) {
      setError('Please fix validation errors before previewing');
      return;
    }

    try {
      // Create a temporary template for preview
      const tempTemplate = {
        ...template,
        id: 'temp',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Generate preview data using the template system
      const response = await fetch('/api/templates/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: template.template })
      });

      const parseData = await response.json();
      if (parseData.success) {
        // Generate sample values for preview
        const sampleCount = 3;
        const previews = [];
        
        for (let i = 0; i < sampleCount; i++) {
          const variables = template.variables.map(variable => ({
            variableId: variable.name,
            value: generateSampleValue(variable, i),
            generatedAt: new Date().toISOString()
          }));
          
          let preview = template.template;
          variables.forEach(variable => {
            preview = preview.replace(new RegExp(`\\{\\{${variable.variableId}\\}\\}`, 'g'), String(variable.value));
          });
          
          previews.push({ variables, preview });
        }
        
        setPreviewData(previews);
        setShowPreview(true);
      }
    } catch (err) {
      setError('Failed to generate preview');
      console.error('Error generating preview:', err);
    }
  };

  const generateSampleValue = (variable: VariableDefinition, seed: number): any => {
    switch (variable.type) {
      case 'number':
        const min = variable.constraints?.min || 1;
        const max = variable.constraints?.max || 100;
        return min + (seed * 10) % (max - min + 1);
      case 'string':
        return `Sample${seed + 1}`;
      case 'date':
        return '2024-01-01';
      case 'list':
        const options = variable.constraints?.options || ['Option1', 'Option2'];
        return options[seed % options.length];
      case 'range':
        const start = variable.constraints?.start || 1;
        const end = variable.constraints?.end || 10;
        return start + (seed % (end - start + 1));
      default:
        return `Value${seed + 1}`;
    }
  };

  const handleSave = async () => {
    if (!template.name.trim() || !template.template.trim()) {
      setError('Name and template are required');
      return;
    }

    const isValid = await validateTemplate();
    if (!isValid) {
      setError('Please fix validation errors before saving');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });

      const data = await response.json();
      
      if (data.success) {
        router.push('/admin/templates');
      } else {
        setError(data.error || 'Failed to create template');
      }
    } catch (err) {
      setError('Failed to create template');
      console.error('Error creating template:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>צור תבנית שאלה</h1>
          <p>צור תבנית שאלה פרמטרית עם משתנים דינמיים</p>
        </div>
        
        <div className={styles.actions}>
          <button
            onClick={handlePreview}
            className={styles.previewButton}
            disabled={loading}
          >
            <Eye size={20} />
            תצוגה מקדימה
          </button>
          <button
            onClick={handleSave}
            className={styles.saveButton}
            disabled={loading}
          >
            <Save size={20} />
            {loading ? 'שומר...' : 'שמור תבנית'}
          </button>
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

      {validationErrors.length > 0 && (
        <div className={styles.validationErrors}>
          <AlertCircle size={20} />
          <div>
            <strong>שגיאות אימות:</strong>
            <ul>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
          <button onClick={() => setValidationErrors([])} className={styles.closeButton}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className={styles.editor}>
        <div className={styles.leftPanel}>
          <div className={styles.section}>
            <h2>מידע בסיסי</h2>
            <div className={styles.formGroup}>
              <label>שם התבנית *</label>
              <input
                type="text"
                value={template.name}
                onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="הזן שם תבנית"
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label>תיאור</label>
              <textarea
                value={template.description}
                onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
                placeholder="הזן תיאור התבנית"
                className={styles.textarea}
                rows={3}
              />
            </div>
          </div>

          <div className={styles.section}>
            <h2>תוכן התבנית</h2>
            <div className={styles.formGroup}>
              <label>תבנית השאלה *</label>
              <div className={styles.templateEditor}>
                <div className={styles.editorHeader}>
                  <Code size={16} />
                  <span>השתמש ב-{`{{שם_משתנה}}`} לתוכן דינמי</span>
                </div>
                <textarea
                  value={template.template}
                  onChange={(e) => setTemplate(prev => ({ ...prev, template: e.target.value }))}
                  placeholder="הזן את תבנית השאלה עם משתנים כמו {`{{שם_סטודנט}}`} או {`{{מספר_אקראי}}`}"
                  className={styles.templateTextarea}
                  rows={8}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>הוראות</label>
              <textarea
                value={template.instructions}
                onChange={(e) => setTemplate(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="הזן הוראות לסטודנטים"
                className={styles.textarea}
                rows={3}
              />
            </div>
            <div className={styles.formGroup}>
              <label>SQL התחלתי</label>
              <textarea
                value={template.starterSql}
                onChange={(e) => setTemplate(prev => ({ ...prev, starterSql: e.target.value }))}
                placeholder="הזן קוד SQL התחלתי (אופציונלי)"
                className={styles.textarea}
                rows={4}
              />
            </div>
          </div>

          <div className={styles.section}>
            <h2>הגדרות שאלה</h2>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>מקסימום ניסיונות</label>
                <input
                  type="number"
                  value={template.maxAttempts}
                  onChange={(e) => setTemplate(prev => ({ ...prev, maxAttempts: parseInt(e.target.value) || 3 }))}
                  min="1"
                  max="10"
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label>נקודות</label>
                <input
                  type="number"
                  value={template.points}
                  onChange={(e) => setTemplate(prev => ({ ...prev, points: parseInt(e.target.value) || 10 }))}
                  min="1"
                  max="100"
                  className={styles.input}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>מצב הערכה</label>
              <select
                value={template.evaluationMode}
                onChange={(e) => setTemplate(prev => ({ ...prev, evaluationMode: e.target.value as any }))}
                className={styles.select}
              >
                <option value="auto">אוטומטי</option>
                <option value="manual">ידני</option>
                <option value="custom">מותאם אישית</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>משתנים</h2>
              <button onClick={addVariable} className={styles.addButton}>
                <Plus size={16} />
                הוסף משתנה
              </button>
            </div>
            
            {template.variables.length === 0 ? (
              <div className={styles.emptyVariables}>
                <Settings size={32} />
                <p>לא הוגדרו משתנים</p>
                <p>הוסף משתנים כדי להפוך את התבנית לדינמית</p>
              </div>
            ) : (
              <div className={styles.variablesList}>
                {template.variables.map((variable, index) => (
                  <div key={variable.id} className={styles.variableCard}>
                    <div className={styles.variableHeader}>
                      <input
                        type="text"
                        value={variable.name}
                        onChange={(e) => updateVariable(index, 'name', e.target.value)}
                        placeholder="שם משתנה"
                        className={styles.variableNameInput}
                      />
                      <button
                        onClick={() => removeVariable(index)}
                        className={styles.removeButton}
                        title="הסר משתנה"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className={styles.variableFields}>
                      <div className={styles.formGroup}>
                        <label>סוג</label>
                        <select
                          value={variable.type}
                          onChange={(e) => updateVariable(index, 'type', e.target.value)}
                          className={styles.select}
                        >
                          {VARIABLE_TYPES.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className={styles.formGroup}>
                        <label>תיאור</label>
                        <input
                          type="text"
                          value={variable.description || ''}
                          onChange={(e) => updateVariable(index, 'description', e.target.value)}
                          placeholder="תיאור המשתנה"
                          className={styles.input}
                        />
                      </div>
                      
                      <div className={styles.formGroup}>
                        <label>ערך ברירת מחדל</label>
                        <input
                          type="text"
                          value={variable.defaultValue || ''}
                          onChange={(e) => updateVariable(index, 'defaultValue', e.target.value)}
                          placeholder="ערך ברירת מחדל"
                          className={styles.input}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPreview && (
        <div className={styles.previewModal}>
          <div className={styles.previewContent}>
            <div className={styles.previewHeader}>
              <h2>תצוגה מקדימה של התבנית</h2>
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
                  {template.template}
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
