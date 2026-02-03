"use client";

import React, { useState } from "react";
import styles from "./warnings.module.css";

const Warnings = () => {
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");

  const createResponsesSession = async () => {
    setLoading(true);

    const response = await fetch("/api/responses/sessions", { method: "POST" });
    const data = await response.json();
    setSessionId(data.sessionId || "");

    setLoading(false);
  };

  return (
    <>
      <div className={styles.container}>
        <h1>Responses API readiness check</h1>
        <div className={styles.message}>
          Create a test Responses session to verify runtime configuration.
        </div>
        {!sessionId ? (
          <button
            onClick={createResponsesSession}
            disabled={loading}
            className={styles.button}
          >
            {loading ? "Loading..." : "Create Session"}
          </button>
        ) : (
          <div className={styles.result}>{sessionId}</div>
        )}
      </div>
    </>
  );
};

export default Warnings;
