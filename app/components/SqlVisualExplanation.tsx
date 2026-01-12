import { useState, useEffect } from 'react';
import styles from './SqlVisualExplanation.module.css';

type VisualType = 'join' | 'groupby' | 'where' | null;
type JoinType = 'inner' | 'left' | 'right' | 'full' | null;

interface SqlVisualExplanationProps {
  visualType: VisualType;
  onClose: () => void;
}

export default function SqlVisualExplanation({ visualType, onClose }: SqlVisualExplanationProps) {
  const [animationStep, setAnimationStep] = useState(0);
  const [selectedJoinType, setSelectedJoinType] = useState<JoinType>(null);

  useEffect(() => {
    // Reset selection when visual type changes
    if (visualType !== 'join') {
      setSelectedJoinType(null);
    }
  }, [visualType]);

  useEffect(() => {
    // For JOIN: Start animation only when join type is selected
    if (visualType === 'join' && selectedJoinType) {
      setAnimationStep(0);
      const interval = setInterval(() => {
        setAnimationStep((prev) => {
          if (prev >= 3) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
      return () => clearInterval(interval);
    } 
    // For GROUP BY and WHERE: Start animation immediately
    else if (visualType && visualType !== 'join') {
      setAnimationStep(0);
      const interval = setInterval(() => {
        setAnimationStep((prev) => {
          if (prev >= 3) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
      return () => clearInterval(interval);
    }
    // Reset animation step when switching back to selection
    else if (visualType === 'join' && !selectedJoinType) {
      setAnimationStep(0);
    }
  }, [visualType, selectedJoinType]);

  const renderJoinVisual = (joinType: JoinType) => {
    const joinTypeNames = {
      'inner': 'INNER JOIN',
      'left': 'LEFT JOIN',
      'right': 'RIGHT JOIN',
      'full': 'FULL OUTER JOIN'
    };

    const joinTypeDescriptions = {
      'inner': 'מחזיר רק שורות שיש התאמה בשתי הטבלאות',
      'left': 'מחזיר את כל השורות מהטבלה השמאלית + התאמות מהטבלה הימנית',
      'right': 'מחזיר את כל השורות מהטבלה הימנית + התאמות מהטבלה השמאלית',
      'full': 'מחזיר את כל השורות משתי הטבלאות (עם NULL עבור שורות ללא התאמה)'
    };

    if (!joinType) return null;

    return (
      <div className={styles.visualContainer}>
        <button 
          className={styles.backButton}
          onClick={() => {
            setSelectedJoinType(null);
            setAnimationStep(0);
          }}
        >
          ← חזור לבחירה
        </button>
        <div className={styles.title}>ויזואליזציה: {joinTypeNames[joinType]}</div>
        <div className={styles.description}>
          {joinTypeDescriptions[joinType]}
        </div>
        <div className={styles.joinVisual}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div className={`${styles.table} ${styles.table1} ${animationStep >= 1 ? styles.highlighted : ''}`}>
            <div className={styles.tableHeader}>טבלה: משתמשים (טבלה שמאלית)</div>
            <div className={styles.tableRow}>
              <div className={styles.cell}>ID</div>
              <div className={styles.cell}>שם</div>
              <div className={styles.cell}>מדינה_ID</div>
            </div>
            <div className={styles.tableRow}>
              <div className={styles.cell}>1</div>
              <div className={styles.cell}>יוסי</div>
              <div className={`${styles.cell} ${styles.keyCell}`}>10</div>
            </div>
            <div className={styles.tableRow}>
              <div className={styles.cell}>2</div>
              <div className={styles.cell}>שרה</div>
              <div className={`${styles.cell} ${styles.keyCell}`}>20</div>
            </div>
            {(joinType === 'left' || joinType === 'full') && (
              <div className={styles.tableRow}>
                <div className={styles.cell}>3</div>
                <div className={styles.cell}>דוד</div>
                <div className={`${styles.cell} ${styles.keyCell}`} style={{ background: '#fee2e2', color: '#991b1b' }}>NULL</div>
              </div>
            )}
          </div>

          {animationStep >= 1 && (
            <div className={styles.joinArrow}>
              <svg width="80" height="40" viewBox="0 0 80 40">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
                  </marker>
                </defs>
                <path
                  d="M 0 20 Q 40 10, 40 20 T 80 20"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                />
                <text x="40" y="15" fill="#3b82f6" fontSize="12" textAnchor="middle" fontWeight="bold">
                  ON users.מדינה_ID = countries.ID
                </text>
              </svg>
            </div>
          )}

          <div className={`${styles.table} ${styles.table2} ${animationStep >= 2 ? styles.highlighted : ''}`}>
            <div className={styles.tableHeader}>טבלה: מדינות (טבלה ימנית)</div>
            <div className={styles.tableRow}>
              <div className={styles.cell}>ID</div>
              <div className={styles.cell}>שם מדינה</div>
            </div>
            <div className={styles.tableRow}>
              <div className={`${styles.cell} ${styles.keyCell}`}>10</div>
              <div className={styles.cell}>ישראל</div>
            </div>
            <div className={styles.tableRow}>
              <div className={`${styles.cell} ${styles.keyCell}`}>20</div>
              <div className={styles.cell}>ארה&quot;ב</div>
            </div>
            {(joinType === 'right' || joinType === 'full') && (
              <div className={styles.tableRow}>
                <div className={`${styles.cell} ${styles.keyCell}`}>30</div>
                <div className={styles.cell}>צרפת</div>
              </div>
            )}
          </div>
        </div>

          {animationStep >= 2 && (
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '24px', justifyContent: 'center', marginTop: '24px' }}>
              <div className={styles.equalSign}>=</div>
              <div className={`${styles.table} ${styles.resultTable} ${animationStep >= 3 ? styles.highlighted : ''}`}>
                <div className={styles.tableHeader}>תוצאה: {joinTypeNames[joinType]}</div>
                <div className={styles.tableRow}>
                  <div className={styles.cell}>ID</div>
                  <div className={styles.cell}>שם</div>
                  <div className={styles.cell}>שם מדינה</div>
                </div>
                {joinType === 'inner' && (
                  <>
                    <div className={styles.tableRow}>
                      <div className={styles.cell}>1</div>
                      <div className={styles.cell}>יוסי</div>
                      <div className={styles.cell}>ישראל</div>
                    </div>
                    <div className={styles.tableRow}>
                      <div className={styles.cell}>2</div>
                      <div className={styles.cell}>שרה</div>
                      <div className={styles.cell}>ארה&quot;ב</div>
                    </div>
                  </>
                )}
                {joinType === 'left' && (
                  <>
                    <div className={styles.tableRow}>
                      <div className={styles.cell}>1</div>
                      <div className={styles.cell}>יוסי</div>
                      <div className={styles.cell}>ישראל</div>
                    </div>
                    <div className={styles.tableRow}>
                      <div className={styles.cell}>2</div>
                      <div className={styles.cell}>שרה</div>
                      <div className={styles.cell}>ארה&quot;ב</div>
                    </div>
                    <div className={styles.tableRow}>
                      <div className={styles.cell}>3</div>
                      <div className={styles.cell}>דוד</div>
                      <div className={`${styles.cell} ${styles.nullCell}`}>NULL</div>
                    </div>
                  </>
                )}
                {joinType === 'right' && (
                  <>
                    <div className={styles.tableRow}>
                      <div className={styles.cell}>1</div>
                      <div className={styles.cell}>יוסי</div>
                      <div className={styles.cell}>ישראל</div>
                    </div>
                    <div className={styles.tableRow}>
                      <div className={styles.cell}>2</div>
                      <div className={styles.cell}>שרה</div>
                      <div className={styles.cell}>ארה&quot;ב</div>
                    </div>
                    <div className={styles.tableRow}>
                      <div className={`${styles.cell} ${styles.nullCell}`}>NULL</div>
                      <div className={`${styles.cell} ${styles.nullCell}`}>NULL</div>
                      <div className={styles.cell}>צרפת</div>
                    </div>
                  </>
                )}
                {joinType === 'full' && (
                  <>
                    <div className={styles.tableRow}>
                      <div className={styles.cell}>1</div>
                      <div className={styles.cell}>יוסי</div>
                      <div className={styles.cell}>ישראל</div>
                    </div>
                    <div className={styles.tableRow}>
                      <div className={styles.cell}>2</div>
                      <div className={styles.cell}>שרה</div>
                      <div className={styles.cell}>ארה&quot;ב</div>
                    </div>
                    <div className={styles.tableRow}>
                      <div className={styles.cell}>3</div>
                      <div className={styles.cell}>דוד</div>
                      <div className={`${styles.cell} ${styles.nullCell}`}>NULL</div>
                    </div>
                    <div className={styles.tableRow}>
                      <div className={`${styles.cell} ${styles.nullCell}`}>NULL</div>
                      <div className={`${styles.cell} ${styles.nullCell}`}>NULL</div>
                      <div className={styles.cell}>צרפת</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <div className={styles.sqlExample}>
          <code>
            SELECT users.שם, countries.שם_מדינה<br />
            FROM users<br />
            {joinTypeNames[joinType].toUpperCase()} countries ON users.מדינה_ID = countries.ID
          </code>
        </div>
      </div>
    );
  };

  const renderGroupByVisual = () => (
    <div className={styles.visualContainer}>
      <div className={styles.title}>ויזואליזציה: GROUP BY</div>
      <div className={styles.description}>
        GROUP BY מקבץ שורות לפי ערכים זהים בעמודה מסוימת ומאפשר חישובי סיכום
      </div>
      <div className={styles.groupByVisual}>
        <div className={`${styles.table} ${styles.table1} ${animationStep >= 1 ? styles.highlighted : ''}`}>
          <div className={styles.tableHeader}>טבלה: הזמנות</div>
          <div className={styles.tableRow}>
            <div className={styles.cell}>לקוח</div>
            <div className={styles.cell}>סכום</div>
            <div className={styles.cell}>תאריך</div>
          </div>
          <div className={styles.tableRow}>
            <div className={styles.cell}>יוסי</div>
            <div className={styles.cell}>100</div>
            <div className={styles.cell}>01/01</div>
          </div>
          <div className={styles.tableRow}>
            <div className={styles.cell}>יוסי</div>
            <div className={styles.cell}>200</div>
            <div className={styles.cell}>02/01</div>
          </div>
          <div className={styles.tableRow}>
            <div className={styles.cell}>שרה</div>
            <div className={styles.cell}>150</div>
            <div className={styles.cell}>01/01</div>
          </div>
          <div className={styles.tableRow}>
            <div className={styles.cell}>שרה</div>
            <div className={styles.cell}>300</div>
            <div className={styles.cell}>03/01</div>
          </div>
        </div>

        {animationStep >= 1 && (
          <div className={styles.groupByArrow}>
            <svg width="60" height="100" viewBox="0 0 60 100">
              <defs>
                <marker id="arrowhead-group" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#10b981" />
                </marker>
              </defs>
              <path
                d="M 30 0 L 30 100"
                stroke="#10b981"
                strokeWidth="3"
                fill="none"
                markerEnd="url(#arrowhead-group)"
              />
              <text x="35" y="50" fill="#10b981" fontSize="12" fontWeight="bold">
                GROUP BY לקוח
              </text>
            </svg>
          </div>
        )}

        {animationStep >= 2 && (
          <div className={`${styles.table} ${styles.resultTable} ${animationStep >= 3 ? styles.highlighted : ''}`}>
            <div className={styles.tableHeader}>תוצאה: סיכום לפי לקוח</div>
            <div className={styles.tableRow}>
              <div className={styles.cell}>לקוח</div>
              <div className={styles.cell}>סה"כ סכום</div>
            </div>
            <div className={styles.tableRow}>
              <div className={`${styles.cell} ${styles.groupedCell}`}>יוסי</div>
              <div className={styles.cell}>300</div>
            </div>
            <div className={styles.tableRow}>
              <div className={`${styles.cell} ${styles.groupedCell}`}>שרה</div>
              <div className={styles.cell}>450</div>
            </div>
          </div>
        )}
      </div>
      <div className={styles.sqlExample}>
        <code>
          SELECT לקוח, SUM(סכום) AS סה_כל_סכום<br />
          FROM הזמנות<br />
          GROUP BY לקוח
        </code>
      </div>
    </div>
  );

  const renderWhereVisual = () => (
    <div className={styles.visualContainer}>
      <div className={styles.title}>ויזואליזציה: WHERE</div>
      <div className={styles.description}>
        WHERE מסנן שורות לפי תנאי מסוים ומחזיר רק שורות שעונות על התנאי
      </div>
      <div className={styles.whereVisual}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', width: '100%' }}>
          {/* Original Table */}
          <div className={`${styles.table} ${styles.table1} ${animationStep >= 1 ? styles.highlighted : ''}`}>
            <div className={styles.tableHeader}>טבלה: מוצרים</div>
            <div className={styles.tableRow}>
              <div className={styles.cell}>ID</div>
              <div className={styles.cell}>שם מוצר</div>
              <div className={styles.cell}>מחיר</div>
            </div>
            <div className={styles.tableRow}>
              <div className={styles.cell}>1</div>
              <div className={styles.cell}>עוגה</div>
              <div className={`${styles.cell} ${animationStep >= 1 && 50 >= 30 ? styles.filteredOut : ''}`}>50</div>
            </div>
            <div className={styles.tableRow}>
              <div className={styles.cell}>2</div>
              <div className={styles.cell}>עוגייה</div>
              <div className={`${styles.cell} ${animationStep >= 1 && 20 < 30 ? styles.matching : ''} ${animationStep >= 1 && 20 >= 30 ? styles.filteredOut : ''}`}>20</div>
            </div>
            <div className={styles.tableRow}>
              <div className={styles.cell}>3</div>
              <div className={styles.cell}>פרי</div>
              <div className={`${styles.cell} ${animationStep >= 1 && 15 < 30 ? styles.matching : ''} ${animationStep >= 1 && 15 >= 30 ? styles.filteredOut : ''}`}>15</div>
            </div>
            <div className={styles.tableRow}>
              <div className={styles.cell}>4</div>
              <div className={styles.cell}>עוגה גדולה</div>
              <div className={`${styles.cell} ${animationStep >= 1 && 80 >= 30 ? styles.filteredOut : ''}`}>80</div>
            </div>
          </div>

          {/* Filter Condition */}
          {animationStep >= 1 && (
            <div className={styles.whereFilter}>
              <div className={styles.filterCondition}>
                <span className={styles.filterLabel}>WHERE מחיר &lt; 30</span>
                <div style={{ fontSize: '12px', marginTop: '8px', color: '#92400e', opacity: 0.8 }}>
                  רק שורות עם מחיר קטן מ-30 יעברו את הסינון
                </div>
              </div>
            </div>
          )}

          {/* Arrow pointing to result */}
          {animationStep >= 2 && (
            <div style={{ margin: '16px 0' }}>
              <svg width="60" height="60" viewBox="0 0 60 60">
                <defs>
                  <marker id="arrowhead-where" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="#10b981" />
                  </marker>
                </defs>
                <path
                  d="M 30 0 L 30 60"
                  stroke="#10b981"
                  strokeWidth="3"
                  fill="none"
                  markerEnd="url(#arrowhead-where)"
                />
              </svg>
            </div>
          )}

          {/* Filtered Result Table */}
          {animationStep >= 2 && (
            <div className={`${styles.table} ${styles.resultTable} ${animationStep >= 3 ? styles.highlighted : ''}`}>
              <div className={styles.tableHeader}>תוצאה: שורות מסוננות (WHERE מחיר &lt; 30)</div>
              <div className={styles.tableRow}>
                <div className={styles.cell}>ID</div>
                <div className={styles.cell}>שם מוצר</div>
                <div className={styles.cell}>מחיר</div>
              </div>
              <div className={styles.tableRow}>
                <div className={styles.cell}>2</div>
                <div className={styles.cell}>עוגייה</div>
                <div className={`${styles.cell} ${styles.matching}`}>20 ✓</div>
              </div>
              <div className={styles.tableRow}>
                <div className={styles.cell}>3</div>
                <div className={styles.cell}>פרי</div>
                <div className={`${styles.cell} ${styles.matching}`}>15 ✓</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={styles.sqlExample}>
        <code>
          SELECT *<br />
          FROM מוצרים<br />
          WHERE מחיר &lt; 30
        </code>
      </div>
    </div>
  );

  // Render JOIN type selection screen
  const renderJoinTypeSelection = () => (
    <div className={styles.visualContainer}>
      <div className={styles.title}>בחר סוג JOIN</div>
      <div className={styles.description}>
        בחר את סוג ה-JOIN שברצונך לראות בויזואליזציה
      </div>
      <div className={styles.joinTypeSelection}>
        <button 
          className={`${styles.joinTypeButton} ${selectedJoinType === 'inner' ? styles.selected : ''}`}
          onClick={() => {
            setSelectedJoinType('inner');
            setAnimationStep(0);
          }}
        >
          <div className={styles.joinTypeIcon}>⟕</div>
          <div className={styles.joinTypeName}>INNER JOIN</div>
          <div className={styles.joinTypeDesc}>מחזיר רק שורות שיש התאמה בשתי הטבלאות</div>
        </button>
        
        <button 
          className={`${styles.joinTypeButton} ${selectedJoinType === 'left' ? styles.selected : ''}`}
          onClick={() => {
            setSelectedJoinType('left');
            setAnimationStep(0);
          }}
        >
          <div className={styles.joinTypeIcon}>⟖</div>
          <div className={styles.joinTypeName}>LEFT JOIN</div>
          <div className={styles.joinTypeDesc}>מחזיר את כל השורות מהטבלה השמאלית</div>
        </button>
        
        <button 
          className={`${styles.joinTypeButton} ${selectedJoinType === 'right' ? styles.selected : ''}`}
          onClick={() => {
            setSelectedJoinType('right');
            setAnimationStep(0);
          }}
        >
          <div className={styles.joinTypeIcon}>⟗</div>
          <div className={styles.joinTypeName}>RIGHT JOIN</div>
          <div className={styles.joinTypeDesc}>מחזיר את כל השורות מהטבלה הימנית</div>
        </button>
        
        <button 
          className={`${styles.joinTypeButton} ${selectedJoinType === 'full' ? styles.selected : ''}`}
          onClick={() => {
            setSelectedJoinType('full');
            setAnimationStep(0);
          }}
        >
          <div className={styles.joinTypeIcon}>⟐</div>
          <div className={styles.joinTypeName}>FULL OUTER JOIN</div>
          <div className={styles.joinTypeDesc}>מחזיר את כל השורות משתי הטבלאות</div>
        </button>
      </div>
      
      <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
        {!selectedJoinType && 'בחר סוג JOIN כדי לראות את הוויזואליזציה'}
      </div>
    </div>
  );

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        {visualType === 'join' && !selectedJoinType && renderJoinTypeSelection()}
        {visualType === 'join' && selectedJoinType && renderJoinVisual(selectedJoinType)}
        {visualType === 'groupby' && renderGroupByVisual()}
        {visualType === 'where' && renderWhereVisual()}
      </div>
    </div>
  );
}

