"use client";

import styles from "./Wizard.module.css";
import type { WizardStepId } from "./types";

interface StepperProps {
  steps: Array<{ id: WizardStepId; label: string }>;
  activeStep: WizardStepId;
  onStepClick: (id: WizardStepId) => void;
  disabledSteps?: WizardStepId[];
}

export function Stepper({ steps, activeStep, onStepClick, disabledSteps = [] }: StepperProps) {
  return (
    <div className={styles.stepper}>
      {steps.map((step) => {
        const disabled = disabledSteps.includes(step.id);
        const className = step.id === activeStep ? `${styles.stepperButton} ${styles.stepperButtonActive}` : styles.stepperButton;
        return (
          <button
            key={step.id}
            type="button"
            className={className}
            onClick={() => onStepClick(step.id)}
            disabled={disabled}
          >
            {step.label}
          </button>
        );
      })}
    </div>
  );
}
