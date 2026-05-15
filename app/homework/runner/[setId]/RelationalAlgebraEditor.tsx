"use client";

import { useCallback, useRef } from "react";
import styles from "./RelationalAlgebraEditor.module.css";

interface RelationalAlgebraEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface OperatorGroup {
  label: string;
  operators: Array<{ symbol: string; title: string; insert?: string }>;
}

const OPERATOR_GROUPS: OperatorGroup[] = [
  {
    label: "פעולות יחס",
    operators: [
      { symbol: "σ", title: "בחירה (Selection)" },
      { symbol: "π", title: "הטלה (Projection)" },
      { symbol: "ρ", title: "שינוי שם (Rename)" },
    ],
  },
  {
    label: "חיבורים",
    operators: [
      { symbol: "⋈", title: "צירוף טבעי (Natural Join)" },
      { symbol: "⟕", title: "צירוף שמאלי (Left Join)" },
      { symbol: "⟖", title: "צירוף ימני (Right Join)" },
      { symbol: "⋉", title: "חצי-צירוף שמאלי (Left Semi-Join)" },
      { symbol: "⋊", title: "חצי-צירוף ימני (Right Semi-Join)" },
      { symbol: "×", title: "מכפלה קרטזית (Cartesian Product)" },
    ],
  },
  {
    label: "תורת קבוצות",
    operators: [
      { symbol: "∪", title: "איחוד (Union)" },
      { symbol: "∩", title: "חיתוך (Intersection)" },
      { symbol: "−", title: "הפרש (Difference)" },
      { symbol: "÷", title: "חלוקה (Division)" },
    ],
  },
  {
    label: "לוגיקה והשוואה",
    operators: [
      { symbol: "∧", title: "וגם (AND)" },
      { symbol: "∨", title: "או (OR)" },
      { symbol: "¬", title: "שלילה (NOT)" },
      { symbol: "≥", title: "גדול-שווה" },
      { symbol: "≤", title: "קטן-שווה" },
      { symbol: "≠", title: "שונה" },
      { symbol: "=", title: "שווה" },
      { symbol: ">", title: "גדול" },
      { symbol: "<", title: "קטן" },
    ],
  },
  {
    label: "מבנה",
    operators: [
      { symbol: "()", title: "סוגריים", insert: "()" },
      { symbol: "_{}", title: "תנאי/רשימה", insert: "_{}" },
      { symbol: "←", title: "חץ שמאלה (השמה)" },
      { symbol: ",", title: "פסיק (הפרדה)" },
    ],
  },
];

export function RelationalAlgebraEditor({
  value,
  onChange,
  disabled = false,
}: RelationalAlgebraEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea || disabled) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const newValue = before + text + after;
      onChange(newValue);

      requestAnimationFrame(() => {
        const cursorPos =
          text === "()" || text === "_{}"
            ? start + text.length - 1
            : start + text.length;
        textarea.focus();
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [value, onChange, disabled],
  );

  return (
    <div className={styles.container}>
      <div className={styles.palette}>
        {OPERATOR_GROUPS.map((group) => (
          <div key={group.label} className={styles.group}>
            <span className={styles.groupLabel}>{group.label}</span>
            <div className={styles.groupButtons}>
              {group.operators.map((op) => (
                <button
                  key={op.symbol}
                  type="button"
                  className={styles.opButton}
                  title={op.title}
                  disabled={disabled}
                  onClick={() => insertAtCursor(op.insert ?? op.symbol)}
                >
                  {op.symbol}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        className={styles.editor}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="π_{name, age}(σ_{age > 25}(Employees))"
        spellCheck={false}
        autoComplete="off"
        rows={10}
      />

      {value.trim() && (
        <div className={styles.preview}>
          <span className={styles.previewLabel}>תצוגה מקדימה</span>
          <div className={styles.previewContent} dir="ltr">
            {value}
          </div>
        </div>
      )}
    </div>
  );
}
