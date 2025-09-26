import { ReactNode } from "react";
import { CheckCircle, Clock, AlertCircle, Archive, Eye } from "lucide-react";
import type { HomeworkStatusFilter } from "@/app/homework/types";
import styles from "./StatusBadge.module.css";

// Enhanced status configuration with icons and semantics
const statusConfig = {
  draft: {
    icon: AlertCircle,
    label: "טיוטה",
    description: "טרם פורסם לסטודנטים",
    color: "warning",
    ariaLabel: "סטטוס: טיוטה - המטלה טרם פורסמה לסטודנטים"
  },
  scheduled: {
    icon: Clock,
    label: "מתוזמן",
    description: "מתוזמן לפרסום אוטומטי",
    color: "info",
    ariaLabel: "סטטוס: מתוזמן - המטלה תפורסם אוטומטיים בזמן שנקבע"
  },
  published: {
    icon: CheckCircle,
    label: "פורסם",
    description: "זמין לסטודנטים",
    color: "success",
    ariaLabel: "סטטוס: פורסם - המטלה זמינה כעת לסטודנטים"
  },
  archived: {
    icon: Archive,
    label: "בארכיון",
    description: "לא זמין לסטודנטים",
    color: "neutral",
    ariaLabel: "סטטוס: בארכיון - המטלה אינה זמינה יותר לסטודנטים"
  },
  in_progress: {
    icon: Eye,
    label: "בעבודה",
    description: "הסטודנט עובד על המטלה",
    color: "info",
    ariaLabel: "סטטוס: בעבודה - הסטודנט כרגע עובד על המטלה"
  },
  submitted: {
    icon: CheckCircle,
    label: "הוגש",
    description: "הוגש ומחכה לבדיקה",
    color: "success",
    ariaLabel: "סטטוס: הוגש - המטלה הוגשה ומחכה לבדיקה"
  },
  graded: {
    icon: CheckCircle,
    label: "נבדק",
    description: "נבדק וקיבל ציון",
    color: "success",
    ariaLabel: "סטטוס: נבדק - המטלה נבדקה והציון פורסם"
  }
} as const;

export interface StatusBadgeProps {
  status: HomeworkStatusFilter | "in_progress" | "submitted" | "graded";
  size?: "sm" | "md" | "lg";
  variant?: "filled" | "outlined" | "subtle";
  showIcon?: boolean;
  showTooltip?: boolean;
  className?: string;
  children?: ReactNode;
}

export function StatusBadge({ 
  status, 
  size = "md", 
  variant = "filled",
  showIcon = true,
  showTooltip = false,
  className,
  children 
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <span 
      className={`${styles.badge} ${styles[size]} ${styles[variant]} ${styles[config.color]} ${className || ''}`}
      role="status"
      aria-label={config.ariaLabel}
      title={showTooltip ? config.description : undefined}
    >
      {showIcon && <Icon size={size === "sm" ? 12 : size === "lg" ? 18 : 14} />}
      <span className={styles.label}>
        {children || config.label}
      </span>
    </span>
  );
}

// Higher-order component for animated status transitions
export function AnimatedStatusBadge(props: StatusBadgeProps) {
  return (
    <div className={styles.animatedContainer}>
      <StatusBadge {...props} />
    </div>
  );
}

// Status filter button component for dashboards
export interface StatusFilterProps extends Omit<StatusBadgeProps, 'children'> {
  count: number;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function StatusFilter({ 
  status, 
  count, 
  active = false, 
  onClick, 
  disabled = false,
  ...badgeProps 
}: StatusFilterProps) {
  const config = statusConfig[status];
  
  return (
    <button
      type="button"
      className={`${styles.filter} ${active ? styles.filterActive : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${config.ariaLabel}, ${count} פריטים`}
    >
      <StatusBadge 
        status={status} 
        variant={active ? "filled" : "subtle"}
        {...badgeProps}
      />
      <span className={styles.count} aria-hidden="true">
        {count}
      </span>
    </button>
  );
}
