import React, { useEffect, useState } from 'react';
import initSqlJs from 'sql.js';
import styles from './sql-sandbox.module.css';

interface Props {
  onClose: () => void;
}

interface QueryResult {
  columns: string[];
  values: any[][];
}

const SQLSandbox: React.FC<Props> = ({ onClose }) => {
  const [db, setDb] = useState<any>(null);
  const [query, setQuery] = useState('SELECT * FROM students;');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      const SQL = await initSqlJs();
      const database = new SQL.Database();
      database.run(`
        CREATE TABLE students(id INTEGER PRIMARY KEY, name TEXT, grade INTEGER);
        INSERT INTO students VALUES (1,'Alice',90),(2,'Bob',85),(3,'Charlie',92);
      `);
      setDb(database);
    };
    init();
  }, []);

  const runQuery = () => {
    if (!db) return;
    try {
      const res = db.exec(query);
      if (res.length === 0) {
        setResult({ columns: [], values: [] });
      } else {
        setResult({ columns: res[0].columns, values: res[0].values });
      }
      setError('');
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    }
  };

  const examples = [
    { label: 'All students', query: 'SELECT * FROM students;' },
    { label: 'Top grades', query: 'SELECT name, grade FROM students WHERE grade > 90;' }
  ];

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>SQL Sandbox</h2>
      <div className={styles.examples}>
        {examples.map((ex) => (
          <button key={ex.label} onClick={() => setQuery(ex.query)} className={styles.exampleButton}>
            {ex.label}
          </button>
        ))}
      </div>
      <textarea className={styles.queryInput} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className={styles.actions}>
        <button onClick={runQuery} className={styles.runButton}>Run</button>
        <button onClick={onClose} className={styles.closeButton}>Close</button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {result && result.columns.length > 0 && (
        <table className={styles.results}>
          <thead>
            <tr>
              {result.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.values.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result && result.columns.length === 0 && (
        <div className={styles.noResult}>Query executed.</div>
      )}
    </div>
  );
};

export default SQLSandbox;
