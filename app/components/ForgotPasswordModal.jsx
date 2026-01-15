import React from "react";
import { Loader, User } from "lucide-react";
import styles from "../login.module.css";

const ForgotPasswordModal = ({
  email,
  onEmailChange,
  onClose,
  onSubmit,
  isLoading,
  message,
}) => (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }}
  >
    <div
      style={{
        backgroundColor: "white",
        padding: "30px",
        borderRadius: "10px",
        maxWidth: "400px",
        width: "90%",
        textAlign: "center",
      }}
    >
      <h3>איפוס סיסמה</h3>
      <p style={{ marginBottom: "20px", color: "#666" }}>
        הזן את כתובת המייל שלך ונשלח לך קישור לאיפוס הסיסמה
      </p>

      <form onSubmit={onSubmit}>
        <div className={styles.inputGroup}>
          <span className={styles.iconWrapper}>
            <User size={18} />
          </span>
          <input
            type="email"
            className={styles.input}
            placeholder="כתובת מייל"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
          />
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button
            type="submit"
            className={styles.button}
            disabled={isLoading}
            style={{ flex: 1 }}
          >
            {isLoading ? (
              <Loader className={styles.loadingSpinner} size={18} />
            ) : (
              "שלח קישור"
            )}
          </button>
          <button
            type="button"
            className={styles.button}
            style={{ backgroundColor: "#666", flex: 1 }}
            onClick={onClose}
          >
            ביטול
          </button>
        </div>
      </form>

      {message && (
        <div
          style={{
            marginTop: "15px",
            padding: "10px",
            backgroundColor: message.includes("שגיאה") ? "#f8d7da" : "#d4edda",
            color: message.includes("שגיאה") ? "#721c24" : "#155724",
            borderRadius: "5px",
            fontSize: "14px",
          }}
        >
          {message}
        </div>
      )}
    </div>
  </div>
);

export default ForgotPasswordModal;
