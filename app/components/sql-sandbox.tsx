"use client";

import { useState, useEffect } from "react";
import initSqlJs, { Database } from "sql.js";
import Editor from "@monaco-editor/react";
import styles from "./sandbox.module.css";

interface Exercise {
  id: number;
  question: string;
  solution: string;
}

const exercises: Exercise[] = [
  {
    id: 1,
    question: "List all employees in the Sales department",
    solution: "SELECT * FROM Employees WHERE department = 'Sales';",
  },
  {
    id: 2,
    question: "Show the average salary per department",
    solution: "SELECT department, AVG(salary) AS avg_salary FROM Employees GROUP BY department;",
  },
];

export default function SQLSandbox() {
  const [db, setDb] = useState<Database | null>(null);
  const [query, setQuery] = useState("SELECT * FROM Employees;");
  const [result, setResult] = useState<{ columns: string[]; values: any[][] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const init = async () => {
      const SQL = await initSqlJs({ locateFile: (file) => `https://sql.js.org/dist/${file}` });
      const db = new SQL.Database();
      db.run(`
        CREATE TABLE Employees (id INTEGER, name TEXT, department TEXT, salary INTEGER);
        INSERT INTO Employees VALUES (1, 'Alice', 'Sales', 5000);
        INSERT INTO Employees VALUES (2, 'Bob', 'Engineering', 7000);
        INSERT INTO Employees VALUES (3, 'Charlie', 'Sales', 5500);
        INSERT INTO Employees VALUES (4, 'Dana', 'HR', 4800);
      `);
      setDb(db);
      const stored = localStorage.getItem("sql-progress");
      if (stored) setProgress(JSON.parse(stored));
    };
    init();
  }, []);

  const runQuery = () => {
    if (!db) return;
    setError(null);
    try {
      const res = db.exec(query);
      if (res.length) {
        setResult({ columns: res[0].columns, values: res[0].values });
      } else {
        setResult(null);
      }
      checkExercises(query, res);
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    }
  };

  const checkExercises = (q: string, res: any[]) => {
    exercises.forEach((ex) => {
      if (progress[ex.id]) return;
      const normalized = q.replace(/\s+/g, " ").trim().toLowerCase();
      const sol = ex.solution.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized === sol) {
        const updated = { ...progress, [ex.id]: true };
        setProgress(updated);
        localStorage.setItem("sql-progress", JSON.stringify(updated));
      }
    });
  };

  return (
    <div className={styles.container}>
      <h2>SQL Sandbox</h2>
      <Editor
        height="150px"
        defaultLanguage="sql"
        value={query}
        onChange={(val) => setQuery(val || "")}
        options={{ fontSize: 14, minimap: { enabled: false } }}
      />
      <button className={styles.runButton} onClick={runQuery}>Run</button>
      {error && <div className={styles.error}>{error}</div>}
      {result && (
        <table className={styles.table}>
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
      <div className={styles.exercises}>
        <h3>Exercises</h3>
        <ul>
          {exercises.map((ex) => (
            <li key={ex.id} className={progress[ex.id] ? styles.done : ""}>
              {ex.question}
              {progress[ex.id] && <span className={styles.check}>✓</span>}
            </li>
          ))}
        </ul>
        <p>
          Completed {Object.values(progress).filter(Boolean).length} of {exercises.length}
          {" "}exercises
        </p>
      </div>
    </div>
  );
}

