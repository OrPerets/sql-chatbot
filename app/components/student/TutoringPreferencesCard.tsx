"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  StudentPreference,
  StudentPreferenceKey,
  StudentPreferenceScope,
} from "@/lib/student-preferences";

type PreferenceField = {
  key: StudentPreferenceKey;
  label: string;
  scope: StudentPreferenceScope;
  type: "select" | "textarea";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
};

const PREFERENCE_FIELDS: PreferenceField[] = [
  {
    key: "current_study_goal",
    label: "מה חשוב לך היום",
    scope: "session",
    type: "select",
    options: [
      { value: "homework_completion", label: "לסיים את שיעור הבית" },
      { value: "exam_practice", label: "להתכונן למבחן" },
      { value: "understand_concepts", label: "להבין את הרעיונות" },
      { value: "fix_recent_mistakes", label: "לתקן טעויות אחרונות" },
    ],
  },
  {
    key: "preferred_language",
    label: "שפת ההסבר",
    scope: "stable",
    type: "select",
    options: [
      { value: "he", label: "עברית" },
      { value: "en", label: "English" },
      { value: "mixed", label: "שילוב עברית ואנגלית" },
    ],
  },
  {
    key: "explanation_style",
    label: "סגנון הסבר",
    scope: "stable",
    type: "select",
    options: [
      { value: "concise", label: "קצר ולעניין" },
      { value: "coaching", label: "אימון עם שאלות מכוונות" },
      { value: "conceptual", label: "הסבר רעיוני" },
      { value: "worked_examples", label: "דוגמאות פתורות" },
    ],
  },
  {
    key: "example_density",
    label: "כמה דוגמאות להראות",
    scope: "stable",
    type: "select",
    options: [
      { value: "low", label: "מעט" },
      { value: "medium", label: "בינוני" },
      { value: "high", label: "הרבה" },
    ],
  },
  {
    key: "pace_preference",
    label: "קצב ההתקדמות",
    scope: "stable",
    type: "select",
    options: [
      { value: "steady", label: "יציב" },
      { value: "slow_and_safe", label: "לאט ובטוח" },
      { value: "fast", label: "מהיר" },
    ],
  },
  {
    key: "desired_challenge_level",
    label: "רמת האתגר",
    scope: "stable",
    type: "select",
    options: [
      { value: "gentle", label: "עדין" },
      { value: "balanced", label: "מאוזן" },
      { value: "stretch", label: "מאתגר" },
    ],
  },
  {
    key: "preferred_hint_style",
    label: "סגנון רמזים",
    scope: "stable",
    type: "select",
    options: [
      { value: "nudge", label: "רמז קטן" },
      { value: "stepwise", label: "צעד אחרי צעד" },
      { value: "schema_first", label: "קודם להסביר את הסכמה" },
      { value: "sql_first", label: "קודם להציע כיוון SQL" },
    ],
  },
  {
    key: "preferred_correction_style",
    label: "איך לתקן אותך",
    scope: "stable",
    type: "select",
    options: [
      { value: "direct", label: "ישיר" },
      { value: "gentle", label: "עדין" },
      { value: "ask_then_tell", label: "לשאול ואז להסביר" },
    ],
  },
  {
    key: "self_confidence_level",
    label: "איך את/ה מרגיש/ה כרגע",
    scope: "session",
    type: "select",
    options: [
      { value: "low", label: "לא בטוח/ה" },
      { value: "medium", label: "בסדר" },
      { value: "high", label: "די בטוח/ה" },
    ],
  },
  {
    key: "weak_topics_self_report",
    label: "נושאים שמרגישים חלשים",
    scope: "stable",
    type: "textarea",
    placeholder: "למשל: JOIN, GROUP BY, הבנת סכמות",
  },
  {
    key: "accessibility_needs",
    label: "התאמות חשובות",
    scope: "stable",
    type: "textarea",
    placeholder: "למשל: תשובות קצרות, פורמט ברור, פחות עומס טקסט",
  },
];

type TutoringPreferencesCardProps = {
  studentId: string;
};

export function TutoringPreferencesCard({
  studentId,
}: TutoringPreferencesCardProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/students/${studentId}/preferences`, {
          headers: {
            "x-user-id": studentId,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load preferences");
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        const values = (payload.preferences || []).reduce(
          (acc: Record<string, string>, preference: StudentPreference) => {
            acc[preference.key] = preference.value;
            return acc;
          },
          {}
        );

        setFormValues(values);
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError.message || "לא ניתן לטעון את העדפות הלמידה כרגע.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const groupedFields = useMemo(
    () => ({
      session: PREFERENCE_FIELDS.filter((field) => field.scope === "session"),
      stable: PREFERENCE_FIELDS.filter((field) => field.scope === "stable"),
    }),
    []
  );

  const handleChange = (key: StudentPreferenceKey, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      const preferences = PREFERENCE_FIELDS.map((field) => ({
        key: field.key,
        value: formValues[field.key] || "",
        scope: field.scope,
        confidence: 1,
      })).filter((entry) => entry.value.trim().length > 0);

      const response = await fetch(`/api/students/${studentId}/preferences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": studentId,
        },
        body: JSON.stringify({ preferences }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save preferences");
      }

      setMessage("העדפות הלמידה נשמרו.");
    } catch (saveError: any) {
      setError(saveError.message || "לא ניתן לשמור את העדפות הלמידה כרגע.");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: PreferenceField) => {
    const value = formValues[field.key] || "";

    if (field.type === "textarea") {
      return (
        <label key={field.key} className="field">
          <span>{field.label}</span>
          <textarea
            value={value}
            placeholder={field.placeholder}
            onChange={(event) => handleChange(field.key, event.target.value)}
            rows={3}
          />
        </label>
      );
    }

    return (
      <label key={field.key} className="field">
        <span>{field.label}</span>
        <select
          value={value}
          onChange={(event) => handleChange(field.key, event.target.value)}
        >
          <option value="">לא הוגדר</option>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <section className="card" aria-labelledby="tutoring-preferences-title">
      <div className="header">
        <div>
          <h3 id="tutoring-preferences-title">התאמת הליווי של מיכאל</h3>
          <p>אפשר לעדכן כמה העדפות קצרות כדי שההסברים, הרמזים והקצב יתאימו לך יותר.</p>
        </div>
        <button type="button" onClick={handleSave} disabled={loading || saving}>
          {saving ? "שומר..." : "שמור העדפות"}
        </button>
      </div>

      {loading ? <p className="status">טוען העדפות...</p> : null}
      {message ? <p className="status success">{message}</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      {!loading ? (
        <div className="groups">
          <div className="group">
            <h4>עכשיו, למפגש הזה</h4>
            <div className="grid">{groupedFields.session.map(renderField)}</div>
          </div>
          <div className="group">
            <h4>ברמה קבועה יותר</h4>
            <div className="grid">{groupedFields.stable.map(renderField)}</div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .card {
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94));
          padding: 20px;
          margin-top: 20px;
        }

        .header {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .header h3 {
          margin: 0 0 6px;
          font-size: 1.05rem;
          color: #0f172a;
        }

        .header p {
          margin: 0;
          color: #475569;
          line-height: 1.5;
        }

        .header button {
          border: none;
          border-radius: 999px;
          background: #0f172a;
          color: white;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 600;
          white-space: nowrap;
        }

        .header button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .groups {
          display: grid;
          gap: 18px;
        }

        .group h4 {
          margin: 0 0 10px;
          color: #1e293b;
          font-size: 0.98rem;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 6px;
        }

        .field span {
          color: #334155;
          font-weight: 600;
          font-size: 0.92rem;
        }

        .field select,
        .field textarea {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.45);
          padding: 10px 12px;
          background: white;
          color: #0f172a;
          font: inherit;
        }

        .field textarea {
          resize: vertical;
          min-height: 84px;
        }

        .status {
          margin: 0 0 10px;
          color: #475569;
        }

        .success {
          color: #166534;
        }

        .error {
          color: #b91c1c;
        }

        @media (max-width: 720px) {
          .header {
            flex-direction: column;
          }

          .header button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
