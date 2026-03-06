"use client";

import type { LucideIcon } from "lucide-react";
import { Database } from "lucide-react";
import styles from "./runner.module.css";

interface InstructionsSectionProps {
  instructions: string;
  title?: string;
  icon?: LucideIcon;
  emptyMessage?: string;
}

export function InstructionsSection({
  instructions,
  title = "סיפור הרקע",
  icon: Icon = Database,
  emptyMessage = "לא הוגדר הסבר נפרד למבנה הנתונים במטלה זו.",
}: InstructionsSectionProps) {
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
    return text.replace(/\b(MySQL|CREATE|INSERT|SELECT|PDF|WORD|MOODLE|Print Screen|צילום מסך|בסיס הנתונים|טבלאות|שאילתות|מערכות מידע|ABCDEFGHI|ת\.ז\.|תעודת זהות)\b/g, 
      '<span class="technicalTerm">$1</span>');
  };

  const normalizedInstructions = instructions.trim();
  const parsedStory = normalizedInstructions ? parseBackgroundStory(normalizedInstructions) : [];

  return (
    <div className={styles.instructionsSection}>
      <div className={styles.instructionsHeader}>
        <Icon className={styles.instructionsIcon} />
        <h3 className={styles.instructionsTitle}>{title}</h3>
      </div>
      
      <div className={styles.instructionsContent}>
        {parsedStory.length > 0 ? (
          parsedStory.map((item, index) => (
            <div key={index} className={item.type === 'important' ? styles.importantNote : styles.storyParagraph}>
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: formatTechnicalTerms(item.content) 
                }} 
              />
            </div>
          ))
        ) : (
          <p className={styles.instructionsEmpty}>{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
