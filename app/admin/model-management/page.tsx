"use client";

import { useState, useEffect } from 'react';
import styles from './ModelManagement.module.css';

interface AssistantInfo {
  assistantId: string;
  model: string;
  name: string;
  tools: number;
  createdAt?: number;
  instructions?: string;
}

interface TestResult {
  success: boolean;
  model: string;
  testType: string;
  runStatus: string;
  executionTime: string;
  results: {
    success: boolean;
    responseQuality: string;
    languageSupport: string;
    functionCalling: string;
    responseLength: number;
    containsExample: boolean;
    containsHebrew: boolean;
    issues: string[];
  };
}

interface UsageAnalytics {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageTokensPerRequest: number;
  averageCostPerRequest: number;
  modelBreakdown: Record<string, any>;
}

export default function ModelManagement() {
  const [assistantInfo, setAssistantInfo] = useState<AssistantInfo | null>(null);
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [usageAnalytics, setUsageAnalytics] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAssistantInfo();
    loadUsageAnalytics();
  }, []);

  const loadAssistantInfo = async () => {
    try {
      const response = await fetch('/api/assistants/update');
      if (response.ok) {
        const data = await response.json();
        setAssistantInfo(data);
      }
    } catch (err) {
      console.error('Failed to load assistant info:', err);
    }
  };

  const loadUsageAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/model-usage?timeRange=24h');
      if (response.ok) {
        const data = await response.json();
        setUsageAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Failed to load usage analytics:', err);
    }
  };

  const upgradeAssistant = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/assistants/update', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAssistantInfo({
          assistantId: data.assistantId,
          model: data.model,
          name: 'Michael - SQL Teaching Assistant',
          tools: data.tools
        });
        alert(`Assistant successfully upgraded to ${data.model}`);
      } else {
        setError(data.error || 'Upgrade failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runTest = async (testType: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/assistants/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTestResults(data);
      } else {
        setError(data.error || 'Test failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const rollbackAssistant = async (reason: string) => {
    if (!confirm(`Are you sure you want to rollback? Reason: ${reason}`)) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/assistants/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Rollback successful: ${data.message}`);
        loadAssistantInfo(); // Refresh assistant info
      } else {
        setError(data.error || 'Rollback failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.navigation}>
        <button 
          onClick={() => window.location.href = '/admin'}
          className={styles.backButton}
        >
          ← חזור לדשבורד ניהול
        </button>
      </div>
      
      <div className={styles.header}>
        <h1>ניהול מודלי AI</h1>
        <p>ניהול ובדיקת מודלים של מייקל - עוזר ה-SQL</p>
      </div>
      
      {error && (
        <div className={styles.error}>
          Error: {error}
        </div>
      )}

      {/* Assistant Information */}
      <section className={styles.section}>
        <h2>הגדרות עוזר AI נוכחיות</h2>
        {assistantInfo ? (
          <div className={styles.info}>
            <p><strong>מזהה עוזר:</strong> {assistantInfo.assistantId}</p>
            <p><strong>מודל:</strong> {assistantInfo.model}</p>
            <p><strong>שם:</strong> {assistantInfo.name}</p>
            <p><strong>כלים:</strong> {assistantInfo.tools}</p>
          </div>
        ) : (
          <p>טוען מידע על העוזר...</p>
        )}
        
        <div className={styles.actions}>
          <button 
            onClick={upgradeAssistant}
            disabled={loading}
            className={styles.upgradeButton}
          >
            {loading ? 'משדרג...' : 'שדרג ל-GPT-5-nano'}
          </button>
          
          <button 
            onClick={() => rollbackAssistant('Manual rollback from admin panel')}
            disabled={loading}
            className={styles.rollbackButton}
          >
            {loading ? 'מחזיר...' : 'חזרה חירום'}
          </button>
        </div>
      </section>

      {/* Testing Section */}
      <section className={styles.section}>
        <h2>בדיקות מודל</h2>
        <div className={styles.testButtons}>
          <button onClick={() => runTest('basic')} disabled={loading}>
            בדיקה בסיסית
          </button>
          <button onClick={() => runTest('hebrew')} disabled={loading}>
            בדיקת עברית
          </button>
          <button onClick={() => runTest('function_calling')} disabled={loading}>
            בדיקת פונקציות SQL
          </button>
          <button onClick={() => runTest('complex_query')} disabled={loading}>
            בדיקת שאילתות מורכבות
          </button>
        </div>
        
        {testResults && (
          <div className={styles.testResults}>
            <h3>תוצאות בדיקה אחרונות</h3>
            <div className={`${styles.result} ${testResults.success ? styles.success : styles.failure}`}>
              <p><strong>Test Type:</strong> {testResults.testType}</p>
              <p><strong>Status:</strong> {testResults.runStatus}</p>
              <p><strong>Execution Time:</strong> {testResults.executionTime}</p>
              <p><strong>Response Quality:</strong> {testResults.results.responseQuality}</p>
              <p><strong>Response Length:</strong> {testResults.results.responseLength} characters</p>
              <p><strong>Contains Example:</strong> {testResults.results.containsExample ? 'Yes' : 'No'}</p>
              <p><strong>Contains Hebrew:</strong> {testResults.results.containsHebrew ? 'Yes' : 'No'}</p>
              
              {testResults.results.issues.length > 0 && (
                <div className={styles.issues}>
                  <strong>Issues:</strong>
                  <ul>
                    {testResults.results.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Usage Analytics */}
      <section className={styles.section}>
        <h2>ניתוח שימוש (24 שעות אחרונות)</h2>
        {usageAnalytics ? (
          <div className={styles.analytics}>
            <div className={styles.stat}>
              <strong>Total Requests:</strong> {usageAnalytics.totalRequests}
            </div>
            <div className={styles.stat}>
              <strong>Total Tokens:</strong> {usageAnalytics.totalTokens.toLocaleString()}
            </div>
            <div className={styles.stat}>
              <strong>Total Cost:</strong> ${usageAnalytics.totalCost.toFixed(4)}
            </div>
            <div className={styles.stat}>
              <strong>Avg Tokens/Request:</strong> {usageAnalytics.averageTokensPerRequest}
            </div>
            <div className={styles.stat}>
              <strong>Avg Cost/Request:</strong> ${usageAnalytics.averageCostPerRequest.toFixed(4)}
            </div>
            
            {Object.keys(usageAnalytics.modelBreakdown).length > 0 && (
              <div className={styles.modelBreakdown}>
                <h4>Model Breakdown:</h4>
                {Object.entries(usageAnalytics.modelBreakdown).map(([model, stats]: [string, any]) => (
                  <div key={model} className={styles.modelStat}>
                    <strong>{model}:</strong> {stats.requests} requests, {stats.tokens} tokens, ${stats.cost.toFixed(4)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p>Loading usage analytics...</p>
        )}
      </section>
    </div>
  );
}
