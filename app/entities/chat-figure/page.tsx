"use client";

import {
  Copy,
  Paperclip,
  Play,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  X,
} from "lucide-react";
import FigureMichaelAvatar from "../../components/FigureMichaelAvatar";
import styles from "./page.module.css";

const previousChats = [
  "SQL Basics Tutorial",
  "JOIN Operations Help",
  "Database Design Questions",
  "Advanced Queries Practice",
  "Performance Optimization",
];

export default function ChatFigurePage() {
  return (
    <main className={styles.page} dir="ltr">
      <div className={styles.frame}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.profileBadge}>J</div>
            <div className={styles.sidebarTitle}>Previous Chats</div>
            <button className={styles.closeButton} type="button" aria-label="Close sidebar">
              <X size={14} />
            </button>
          </div>

          <nav className={styles.chatList} aria-label="Previous chats">
            {previousChats.map((item) => (
              <div key={item} className={styles.chatListItem}>
                {item}
              </div>
            ))}
          </nav>

          <button className={styles.floatingAddButton} type="button" aria-label="New chat">
            <Plus size={22} />
          </button>
        </aside>

        <section className={styles.chatStage}>
          <div className={styles.messageColumn}>
            <div className={`${styles.bubble} ${styles.systemBubble}`}>
              <p>
                Hi John! Welcome to class number 9 in topic JOINs and Sub-Queries. How can I help
                you today?
              </p>

              <div className={styles.reactionRow}>
                <button type="button" aria-label="Play audio">
                  <Volume2 size={16} />
                </button>
                <button type="button" aria-label="Like">
                  <ThumbsUp size={16} />
                </button>
                <button type="button" aria-label="Dislike">
                  <ThumbsDown size={16} />
                </button>
                <button type="button" aria-label="Copy">
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className={`${styles.bubble} ${styles.userBubble}`}>
              <p>Hi Michael! What are sub-queries?</p>
            </div>

            <div className={`${styles.bubble} ${styles.assistantBubble}`}>
              <p>
                Great question! Sub-queries are queries nested inside another query. They&apos;re
                incredibly useful for complex data retrieval. Here&apos;s a clean example that
                combines a JOIN with a sub-query to find employees whose salary is above the
                department average:
              </p>

              <h2>Types of Sub-queries:</h2>
              <h3>1. Scalar Sub-query</h3>
              <p>Returns a single value that can be compared inside a larger SQL statement:</p>

              <div className={styles.codeCard}>
                <div className={styles.codeBadge}>
                  <span className={styles.codeDot} />
                  <span>SQL</span>
                  <Copy size={15} />
                </div>

                <pre>
                  <code>{`SELECT e.name,
       d.department_name,
       e.salary
FROM employees AS e
JOIN departments AS d
  ON d.department_id = e.department_id
WHERE e.salary > (
  SELECT AVG(e2.salary)
  FROM employees AS e2
  WHERE e2.department_id = e.department_id
)
ORDER BY e.salary DESC;`}</code>
                </pre>
              </div>
            </div>
          </div>

          <div className={styles.composerShell}>
            <div className={styles.composerInput}>Type here...</div>

            <div className={styles.composerTools}>
              <div className={styles.composerLeftTools}>
                <button type="button" aria-label="Attach file">
                  <Paperclip size={16} />
                </button>
                <button type="button" className={styles.sqlTag} aria-label="SQL mode">
                  <Play size={12} />
                  SQL
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className={styles.avatarRail}>
          <div className={styles.avatarViewport}>
            <FigureMichaelAvatar className={styles.avatarCanvas} />
          </div>

          <div className={styles.avatarGreeting}>Hello, John</div>
        </aside>
      </div>
    </main>
  );
}
