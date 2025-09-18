"use client";

import React, { useState } from 'react';
import { Shield, HelpCircle, Check, X } from 'lucide-react';
import styles from './EnhancedSettingsToggle.module.css';

interface ToggleItem {
  id: string;
  label: string;
  description: string;
  helpText?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

interface EnhancedSettingsToggleProps {
  items: ToggleItem[];
  title: string;
  icon?: React.ComponentType<any>;
  className?: string;
}

const EnhancedSettingsToggle: React.FC<EnhancedSettingsToggleProps> = ({
  items,
  title,
  icon: Icon = Shield,
  className = ''
}) => {
  const [expandedHelp, setExpandedHelp] = useState<string | null>(null);

  const toggleHelp = (itemId: string) => {
    setExpandedHelp(expandedHelp === itemId ? null : itemId);
  };

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Icon size={20} />
        </div>
        <h3 className={styles.title}>{title}</h3>
      </div>

      <div className={styles.togglesList}>
        {items.map((item) => (
          <div key={item.id} className={styles.toggleItem}>
            <div className={styles.toggleMain}>
              <div className={styles.toggleInfo}>
                <div className={styles.toggleLabel}>
                  {item.label}
                  {item.helpText && (
                    <button
                      onClick={() => toggleHelp(item.id)}
                      className={styles.helpButton}
                      title="מידע נוסף"
                    >
                      <HelpCircle size={14} />
                    </button>
                  )}
                </div>
                <div className={styles.toggleDescription}>{item.description}</div>
              </div>

              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.onChange(e.target.checked)}
                  disabled={item.disabled}
                />
                <span className={styles.slider}>
                  <span className={`${styles.sliderIcon} ${styles.onIcon}`}>
                    <Check size={12} />
                  </span>
                  <span className={`${styles.sliderIcon} ${styles.offIcon}`}>
                    <X size={12} />
                  </span>
                </span>
              </label>
            </div>

            {expandedHelp === item.id && item.helpText && (
              <div className={styles.helpPanel}>
                <div className={styles.helpContent}>
                  {item.helpText}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EnhancedSettingsToggle;
