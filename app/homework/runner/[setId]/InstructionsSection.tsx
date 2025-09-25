"use client";

import { Database } from "lucide-react";
import styles from "./runner.module.css";

interface InstructionsSectionProps {
  instructions: string;
}

export function InstructionsSection({ instructions }: InstructionsSectionProps) {
  // Parse the background story text and format it
  const parseBackgroundStory = (text: string) => {
    const paragraphs = text.split('\n\n').filter(para => para.trim());
    const parsed = [];

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (trimmed) {
        // Check if it's a special instruction (starts with "הנחייה חשובה")
        if (trimmed.includes('הנחייה חשובה:')) {
          const parts = trimmed.split('הנחייה חשובה:');
          if (parts[0].trim()) {
            parsed.push({
              type: 'regular',
              content: parts[0].trim()
            });
          }
          parsed.push({
            type: 'important',
            content: 'הנחייה חשובה: ' + parts[1].trim()
          });
        } else {
          parsed.push({
            type: 'regular',
            content: trimmed
          });
        }
      }
    }

    return parsed;
  };

  const formatTechnicalTerms = (text: string) => {
    // Highlight technical terms and database concepts
    return text.replace(/\b(MySQL|CREATE|INSERT|SELECT|PDF|WORD|MOODLE|Print Screen|צילום מסך|בסיס הנתונים|טבלאות|שאילתות|מערכות מידע|ABCDEFGHI|ת\.ז\.|תעודת זהות)\b/g, 
      '<span class="technicalTerm">$1</span>');
  };

  const parsedStory = parseBackgroundStory(instructions);

  return (
    <div className={styles.instructionsSection}>
      <div className={styles.instructionsHeader}>
        <Database className={styles.instructionsIcon} />
        <h3 className={styles.instructionsTitle}>סיפור הרקע</h3>
      </div>
      
      <div className={styles.instructionsContent}>
        {parsedStory.map((item, index) => (
          <div key={index} className={item.type === 'important' ? styles.importantNote : styles.storyParagraph}>
            <div 
              dangerouslySetInnerHTML={{ 
                __html: formatTechnicalTerms(item.content) 
              }} 
            />
          </div>
        ))}
      </div>
    </div>
  );
}
