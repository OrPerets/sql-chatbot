import { useState } from 'react';
import Editor from '@monaco-editor/react';
import styles from './query-vizualizer.module.css'; 

export default function SQLQueryEditor({ toggleModal }) {
  const [query, setQuery] = useState('SELECT \nFROM \nWHERE');

  const copyQuery = () => {
    navigator.clipboard.writeText(query);
  };

  const addClause = (clause) => {
    setQuery((prevQuery) => `${prevQuery}\n${clause}`);
  };

  return (
    <div className={styles.modalContainer}>
        <button className={styles.closeButton} onClick={toggleModal}>X</button>
        <div className={styles.editorContainer}>
          <Editor
            height="200px"
            value={query}
            defaultLanguage="sql"
            options={{
                scrollBeyondLastLine:false,
                fontSize: 16
            }}
            onChange={(value) => setQuery(value)}
          />
        </div>
      <div className={styles.buttonContainer}>
        <button className={styles.commonButton} onClick={() => addClause('GROUP BY column_name')}>GROUP BY</button>
        <button className={styles.commonButton} onClick={() => addClause('HAVING condition')}>HAVING</button>
        <button className={styles.commonButton} onClick={() => addClause('table_1 JOIN table_2 ON condition')}>JOIN</button>
        <button className={styles.commonButton} onClick={() => addClause('ORDER BY column_name')}>ORDER BY</button>
      </div>
      <button className={styles.commonButton} onClick={copyQuery}>העתק שאילתה</button>
    </div>
  );
}
