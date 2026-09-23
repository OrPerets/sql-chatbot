"use client";

import { Check } from "lucide-react";
import styles from "./Wizard.module.css";
import type { WizardStepId } from "./types";

interface StepperProps {
  steps: Array<{ id: WizardStepId; label: string }>;
  activeStep: WizardStepId;
  onStepClick: (id: WizardStepId) => void;
  disabledSteps?: WizardStepId[];
  autoSaveState?: "idle" | "saving" | "saved" | "error";
}

function resolveState(
  index: number,
  activeIndex: number,
  disabled: boolean,
): "active" | "completed" | "upcoming" | "disabled" {
  if (disabled) return "disabled";
  if (index === activeIndex) return "active";
  if (index < activeIndex) return "completed";
  return "upcoming";
}

export function Stepper({
  steps,
  activeStep,
  onStepClick,
  disabledSteps = [],
  autoSaveState,
}: StepperProps) {
  const activeIndex = steps.findIndex((s) => s.id === activeStep);

  return (
    <nav className={styles.stepper} aria-label="Wizard progress">
      <ol className={styles.stepperTrack}>
        {steps.map((step, index) => {
          const disabled = disabledSteps.includes(step.id);
          const state = resolveState(index, activeIndex, disabled);

          return (
            <li key={step.id} className={styles.stepperItem}>
              {index > 0 && (
                <span
                  className={styles.stepperConnector}
                  data-filled={state === "completed" || state === "active" ? "" : undefined}
                />
              )}
              <button
                type="button"
                className={styles.stepperTrigger}
                data-state={state}
                onClick={() => onStepClick(step.id)}
                disabled={disabled}
                aria-current={state === "active" ? "step" : undefined}
              >
                <span className={styles.stepperCircle} data-state={state}>
                  {state === "completed" ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={styles.stepperLabel}>{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {autoSaveState && autoSaveState !== "idle" && (
        <span className={styles.autoSaveIndicator} data-state={autoSaveState}>
          {autoSaveState === "saving" && "שומר..."}
          {autoSaveState === "saved" && "נשמר \u2713"}
          {autoSaveState === "error" && "שגיאת שמירה"}
        </span>
      )}
    </nav>
  );
}
