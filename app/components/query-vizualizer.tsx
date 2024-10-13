import { useState } from 'react';
import Editor from '@monaco-editor/react';
import styles from './query-vizualizer.module.css'; 

export default function SQLQueryEditor({ toggleModal }) {
  const [query, setQuery] = useState('SELECT \nFROM \nWHERE');

  const copyQuery = () => {
    navigator.clipboard.writeText(query);
  }

  return (
    <div className={styles.modalContainer}>
        <button className={styles.closeButton} onClick={toggleModal}>X</button>
        <div className={styles.editorContainer}>
        <Editor
        height="200px"
        // width="400px"
        defaultLanguage="sql"
        defaultValue=""
        value={query}
        options={{
            scrollBeyondLastLine:false,
            fontSize: 16
        }}
        onChange={(value) => setQuery(value)}
      />
        </div>
      <button className={styles.commonButton} onClick={copyQuery}>העתק שאילתה</button>
      
    </div>
  );
}
