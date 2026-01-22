'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { enhancedTTS } from '@/app/utils/enhanced-tts';
import { contextAwareVoice } from '@/app/utils/context-aware-voice';
import styles from './VoiceControlledSQLEditor.module.css';

interface VoiceCommand {
  command: string;
  pattern: RegExp;
  handler: (match: RegExpMatchArray, editor: any) => void;
  description: string;
}

interface VoiceControlledSQLEditorProps {
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
  onExecute?: (query: string) => void;
  isVoiceEnabled?: boolean;
  className?: string;
}

export const VoiceControlledSQLEditor: React.FC<VoiceControlledSQLEditorProps> = ({
  initialQuery = '',
  onQueryChange,
  onExecute,
  isVoiceEnabled = true,
  className = ''
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [voiceFeedback, setVoiceFeedback] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const commandHistoryRef = useRef<string[]>([]);

  // Speak feedback
  const speakFeedback = useCallback(async (text: string) => {
    try {
      const context = contextAwareVoice.analyzeContext(text);
      const { processedText, voiceParameters } = contextAwareVoice.processTextForVoice(text, context);
      
      await enhancedTTS.speak(processedText, {
        speed: voiceParameters.speed,
        pitch: voiceParameters.pitch,
        emotion: voiceParameters.emotion as any,
        contentType: context.contentType as any,
        characterStyle: 'university_ta'
      });
    } catch (error) {
      console.error('Error speaking feedback:', error);
    }
  }, []);

  // Explain query
  const explainQuery = useCallback(async (sqlQuery: string) => {
    try {
      setIsProcessing(true);
      
      // Basic query explanation logic
      let explanation = '';
      
      if (sqlQuery.toLowerCase().includes('select')) {
        explanation += 'This is a SELECT query that retrieves data. ';
      }
      if (sqlQuery.toLowerCase().includes('from')) {
        const fromMatch = sqlQuery.match(/from\s+(\w+)/i);
        if (fromMatch) {
          explanation += `It retrieves data from the ${fromMatch[1]} table. `;
        }
      }
      if (sqlQuery.toLowerCase().includes('where')) {
        explanation += 'It includes a WHERE clause to filter the results. ';
      }
      if (sqlQuery.toLowerCase().includes('join')) {
        explanation += 'It uses a JOIN to combine data from multiple tables. ';
      }
      if (sqlQuery.toLowerCase().includes('order by')) {
        explanation += 'The results are ordered by a specific column. ';
      }
      if (sqlQuery.toLowerCase().includes('group by')) {
        explanation += 'The results are grouped by specific columns. ';
      }
      
      if (!explanation) {
        explanation = 'This appears to be a SQL query. ';
      }
      
      explanation += 'Would you like me to execute this query?';
      
      setLastCommand('Query explanation provided');
      speakFeedback(explanation);
    } catch (error) {
      console.error('Error explaining query:', error);
      speakFeedback('Sorry, I could not explain this query');
    } finally {
      setIsProcessing(false);
    }
  }, [speakFeedback]);

  // Voice commands configuration
  const voiceCommands: VoiceCommand[] = useMemo(() => [
    {
      command: 'select_all',
      pattern: /select\s+all\s+from\s+(\w+)/gi,
      handler: (match, editor) => {
        const tableName = match[1];
        const newQuery = `SELECT * FROM ${tableName}`;
        setQuery(newQuery);
        setLastCommand(`Selected all from ${tableName}`);
        speakFeedback(`Selected all columns from ${tableName} table`);
      },
      description: 'Select all from [table] - Creates SELECT * FROM [table] query'
    },
    {
      command: 'select_columns',
      pattern: /select\s+(\w+(?:\s*,\s*\w+)*)\s+from\s+(\w+)/gi,
      handler: (match, editor) => {
        const columns = match[1].split(',').map(col => col.trim()).join(', ');
        const tableName = match[2];
        const newQuery = `SELECT ${columns} FROM ${tableName}`;
        setQuery(newQuery);
        setLastCommand(`Selected ${columns} from ${tableName}`);
        speakFeedback(`Selected ${columns} from ${tableName} table`);
      },
      description: 'Select [columns] from [table] - Creates SELECT query with specific columns'
    },
    {
      command: 'join_tables',
      pattern: /join\s+tables?\s+(\w+)\s+and\s+(\w+)/gi,
      handler: (match, editor) => {
        const table1 = match[1];
        const table2 = match[2];
        const newQuery = `SELECT * FROM ${table1} JOIN ${table2} ON ${table1}.id = ${table2}.${table1}_id`;
        setQuery(newQuery);
        setLastCommand(`Joined ${table1} and ${table2}`);
        speakFeedback(`Created join between ${table1} and ${table2} tables`);
      },
      description: 'Join tables [table1] and [table2] - Creates JOIN query'
    },
    {
      command: 'inner_join',
      pattern: /inner\s+join\s+(\w+)\s+and\s+(\w+)/gi,
      handler: (match, editor) => {
        const table1 = match[1];
        const table2 = match[2];
        const newQuery = `SELECT * FROM ${table1} INNER JOIN ${table2} ON ${table1}.id = ${table2}.${table1}_id`;
        setQuery(newQuery);
        setLastCommand(`Inner joined ${table1} and ${table2}`);
        speakFeedback(`Created inner join between ${table1} and ${table2} tables`);
      },
      description: 'Inner join [table1] and [table2] - Creates INNER JOIN query'
    },
    {
      command: 'left_join',
      pattern: /left\s+join\s+(\w+)\s+and\s+(\w+)/gi,
      handler: (match, editor) => {
        const table1 = match[1];
        const table2 = match[2];
        const newQuery = `SELECT * FROM ${table1} LEFT JOIN ${table2} ON ${table1}.id = ${table2}.${table1}_id`;
        setQuery(newQuery);
        setLastCommand(`Left joined ${table1} and ${table2}`);
        speakFeedback(`Created left join between ${table1} and ${table2} tables`);
      },
      description: 'Left join [table1] and [table2] - Creates LEFT JOIN query'
    },
    {
      command: 'filter_by',
      pattern: /filter\s+by\s+(\w+)\s+(greater\s+than|less\s+than|equal\s+to|not\s+equal\s+to|like|not\s+like)\s+([^,]+)/gi,
      handler: (match, editor) => {
        const column = match[1];
        const operator = match[2].replace(/\s+/g, ' ').toLowerCase();
        const value = match[3].trim();
        
        let sqlOperator = '';
        switch (operator) {
          case 'greater than': sqlOperator = '>'; break;
          case 'less than': sqlOperator = '<'; break;
          case 'equal to': sqlOperator = '='; break;
          case 'not equal to': sqlOperator = '!='; break;
          case 'like': sqlOperator = 'LIKE'; break;
          case 'not like': sqlOperator = 'NOT LIKE'; break;
        }

        const newQuery = query ? `${query} WHERE ${column} ${sqlOperator} ${value}` : `SELECT * FROM table WHERE ${column} ${sqlOperator} ${value}`;
        setQuery(newQuery);
        setLastCommand(`Filtered by ${column} ${operator} ${value}`);
        speakFeedback(`Added filter: ${column} ${operator} ${value}`);
      },
      description: 'Filter by [column] [operator] [value] - Adds WHERE clause'
    },
    {
      command: 'order_by',
      pattern: /order\s+by\s+(\w+)\s+(ascending|descending|asc|desc)/gi,
      handler: (match, editor) => {
        const column = match[1];
        const direction = match[2].toLowerCase();
        const sqlDirection = direction.includes('desc') ? 'DESC' : 'ASC';
        
        const newQuery = query ? `${query} ORDER BY ${column} ${sqlDirection}` : `SELECT * FROM table ORDER BY ${column} ${sqlDirection}`;
        setQuery(newQuery);
        setLastCommand(`Ordered by ${column} ${sqlDirection}`);
        speakFeedback(`Added ordering by ${column} in ${sqlDirection} order`);
      },
      description: 'Order by [column] [ascending/descending] - Adds ORDER BY clause'
    },
    {
      command: 'group_by',
      pattern: /group\s+by\s+(\w+(?:\s*,\s*\w+)*)/gi,
      handler: (match, editor) => {
        const columns = match[1].split(',').map(col => col.trim()).join(', ');
        const newQuery = query ? `${query} GROUP BY ${columns}` : `SELECT * FROM table GROUP BY ${columns}`;
        setQuery(newQuery);
        setLastCommand(`Grouped by ${columns}`);
        speakFeedback(`Added grouping by ${columns}`);
      },
      description: 'Group by [columns] - Adds GROUP BY clause'
    },
    {
      command: 'count_records',
      pattern: /count\s+records?\s+in\s+(\w+)/gi,
      handler: (match, editor) => {
        const tableName = match[1];
        const newQuery = `SELECT COUNT(*) FROM ${tableName}`;
        setQuery(newQuery);
        setLastCommand(`Count records in ${tableName}`);
        speakFeedback(`Created query to count records in ${tableName} table`);
      },
      description: 'Count records in [table] - Creates COUNT query'
    },
    {
      command: 'insert_record',
      pattern: /insert\s+into\s+(\w+)\s+values?\s+([^,]+(?:\s*,\s*[^,]+)*)/gi,
      handler: (match, editor) => {
        const tableName = match[1];
        const values = match[2].split(',').map(val => val.trim()).map(val => isNaN(Number(val)) ? `'${val}'` : val).join(', ');
        const newQuery = `INSERT INTO ${tableName} VALUES (${values})`;
        setQuery(newQuery);
        setLastCommand(`Insert into ${tableName}`);
        speakFeedback(`Created insert query for ${tableName} table`);
      },
      description: 'Insert into [table] values [values] - Creates INSERT query'
    },
    {
      command: 'update_record',
      pattern: /update\s+(\w+)\s+set\s+(\w+)\s*=\s*([^,]+)\s+where\s+(\w+)\s*=\s*([^,]+)/gi,
      handler: (match, editor) => {
        const tableName = match[1];
        const setColumn = match[2];
        const setValue = isNaN(Number(match[3])) ? `'${match[3]}'` : match[3];
        const whereColumn = match[4];
        const whereValue = isNaN(Number(match[5])) ? `'${match[5]}'` : match[5];
        const newQuery = `UPDATE ${tableName} SET ${setColumn} = ${setValue} WHERE ${whereColumn} = ${whereValue}`;
        setQuery(newQuery);
        setLastCommand(`Update ${tableName} set ${setColumn}`);
        speakFeedback(`Created update query for ${tableName} table`);
      },
      description: 'Update [table] set [column] = [value] where [column] = [value] - Creates UPDATE query'
    },
    {
      command: 'delete_records',
      pattern: /delete\s+from\s+(\w+)\s+where\s+(\w+)\s*=\s*([^,]+)/gi,
      handler: (match, editor) => {
        const tableName = match[1];
        const whereColumn = match[2];
        const whereValue = isNaN(Number(match[3])) ? `'${match[3]}'` : match[3];
        const newQuery = `DELETE FROM ${tableName} WHERE ${whereColumn} = ${whereValue}`;
        setQuery(newQuery);
        setLastCommand(`Delete from ${tableName}`);
        speakFeedback(`Created delete query for ${tableName} table`);
      },
      description: 'Delete from [table] where [column] = [value] - Creates DELETE query'
    },
    {
      command: 'clear_query',
      pattern: /clear\s+(query|sql|code)/gi,
      handler: (match, editor) => {
        setQuery('');
        setLastCommand('Cleared query');
        speakFeedback('Query cleared');
      },
      description: 'Clear query - Clears the SQL editor'
    },
    {
      command: 'execute_query',
      pattern: /execute\s+(query|sql|code)|run\s+(query|sql|code)/gi,
      handler: (match, editor) => {
        if (query.trim()) {
          setLastCommand('Executing query');
          speakFeedback('Executing query now');
          onExecute?.(query);
        } else {
          setLastCommand('No query to execute');
          speakFeedback('Please write a query first');
        }
      },
      description: 'Execute query / Run query - Executes the current SQL query'
    },
    {
      command: 'explain_query',
      pattern: /explain\s+(query|sql|code)/gi,
      handler: (match, editor) => {
        if (query.trim()) {
          setLastCommand('Explaining query');
          explainQuery(query);
        } else {
          setLastCommand('No query to explain');
          speakFeedback('Please write a query first');
        }
      },
      description: 'Explain query - Provides explanation of the current SQL query'
    },
    {
      command: 'show_tables',
      pattern: /show\s+(tables?|databases?)/gi,
      handler: (match, editor) => {
        const newQuery = 'SHOW TABLES';
        setQuery(newQuery);
        setLastCommand('Show tables');
        speakFeedback('Created query to show all tables');
      },
      description: 'Show tables - Creates query to list all tables'
    },
    {
      command: 'describe_table',
      pattern: /describe\s+(\w+)|show\s+columns?\s+from\s+(\w+)/gi,
      handler: (match, editor) => {
        const tableName = match[1] || match[2];
        const newQuery = `DESCRIBE ${tableName}`;
        setQuery(newQuery);
        setLastCommand(`Describe ${tableName}`);
        speakFeedback(`Created query to describe ${tableName} table structure`);
      },
      description: 'Describe [table] - Creates query to show table structure'
    }
  ], [explainQuery, onExecute, query, speakFeedback]);

  // Process voice command
  const processVoiceCommand = useCallback((transcript: string) => {
    console.log('Processing voice command:', transcript);
    setVoiceFeedback(`Processing: "${transcript}"`);

    let commandMatched = false;

    for (const voiceCommand of voiceCommands) {
      const match = transcript.match(voiceCommand.pattern);
      if (match) {
        commandMatched = true;
        commandHistoryRef.current.push(transcript);
        setIsProcessing(true);

        try {
          voiceCommand.handler(match, editorRef.current);
        } catch (error) {
          console.error('Error executing voice command:', error);
          speakFeedback('Sorry, I encountered an error processing that command');
        } finally {
          setIsProcessing(false);
        }
        break;
      }
    }

    if (!commandMatched) {
      setVoiceFeedback(`Command not recognized: "${transcript}"`);
      speakFeedback('Sorry, I did not understand that command. Try saying "help" for available commands.');
    }
  }, [speakFeedback, voiceCommands]);

  // Initialize speech recognition
  useEffect(() => {
    if (!isVoiceEnabled || typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setVoiceFeedback('Listening for voice commands...');
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');

      if (event.results[event.results.length - 1].isFinal) {
        processVoiceCommand(transcript);
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setVoiceFeedback(`Error: ${event.error}`);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isVoiceEnabled, processVoiceCommand]);

  // Start/stop listening
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }, [isListening]);

  // Handle query change
  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setCursorPosition(e.target.selectionStart);
    onQueryChange?.(newQuery);
  }, [onQueryChange]);

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          onExecute?.(query);
          break;
        case 'k':
          e.preventDefault();
          toggleListening();
          break;
      }
    }
  }, [query, onExecute, toggleListening]);

  // Get available commands help
  const getAvailableCommands = useCallback(() => {
    return voiceCommands.map(cmd => cmd.description).join('. ');
  }, [voiceCommands]);

  // Show help
  const showHelp = useCallback(() => {
    const helpText = `Available voice commands: ${getAvailableCommands()}`;
    speakFeedback(helpText);
  }, [getAvailableCommands, speakFeedback]);

  return (
    <div className={`${styles.voiceSQLEditor} ${className}`}>
      <div className={styles.header}>
        <h3>Voice-Controlled SQL Editor</h3>
        <div className={styles.controls}>
          <button
            onClick={toggleListening}
            disabled={!isVoiceEnabled}
            className={`${styles.voiceButton} ${isListening ? styles.listening : ''}`}
            title={isListening ? 'Stop listening' : 'Start voice commands'}
          >
            <span className={styles.buttonIcon}>
              {isListening ? '🎤' : '🎙️'}
            </span>
            <span className={styles.buttonText}>
              {isListening ? 'Listening...' : 'Voice Commands'}
            </span>
          </button>
          
          <button
            onClick={showHelp}
            className={styles.helpButton}
            title="Show available voice commands"
          >
            <span className={styles.buttonIcon}>❓</span>
            <span className={styles.buttonText}>Help</span>
          </button>

          <button
            onClick={() => onExecute?.(query)}
            disabled={!query.trim()}
            className={styles.executeButton}
            title="Execute query (Ctrl+Enter)"
          >
            <span className={styles.buttonIcon}>▶️</span>
            <span className={styles.buttonText}>Execute</span>
          </button>
        </div>
      </div>

      <div className={styles.editorContainer}>
        <textarea
          ref={editorRef}
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder="Write SQL query here or use voice commands..."
          className={styles.sqlEditor}
          rows={10}
        />
      </div>

      <div className={styles.statusBar}>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Voice:</span>
          <span className={`${styles.statusValue} ${isListening ? styles.active : ''}`}>
            {isListening ? 'Listening' : 'Ready'}
          </span>
        </div>
        
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Last Command:</span>
          <span className={styles.statusValue}>{lastCommand || 'None'}</span>
        </div>
        
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Processing:</span>
          <span className={`${styles.statusValue} ${isProcessing ? styles.processing : ''}`}>
            {isProcessing ? 'Yes' : 'No'}
          </span>
        </div>
      </div>

      {voiceFeedback && (
        <div className={styles.voiceFeedback}>
          <span className={styles.feedbackIcon}>🔊</span>
          <span className={styles.feedbackText}>{voiceFeedback}</span>
        </div>
      )}

      <div className={styles.quickCommands}>
        <h4>Quick Voice Commands:</h4>
        <div className={styles.commandList}>
          {voiceCommands.slice(0, 6).map((cmd, index) => (
            <div key={index} className={styles.commandItem}>
              <span className={styles.commandDescription}>{cmd.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
