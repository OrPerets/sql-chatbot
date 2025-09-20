"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import styles from "./page.module.css";
import EnhancedChatWithAvatar from "../../components/EnhancedChatWithAvatar";

const EnhancedAvatarDemo = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [sqlMappingEnabled, setSqlMappingEnabled] = useState(true);

  return (
    <div>
      <main className={styles.main}>
        {/* Demo Controls */}
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 1000,
          minWidth: '250px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>🎭 Enhanced Avatar Demo</h3>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Enable Avatar Interactions
            </label>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sqlMappingEnabled}
                onChange={(e) => setSqlMappingEnabled(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              SQL Gesture Mapping
            </label>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={analyticsEnabled}
                onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Analytics Tracking
            </label>
          </div>
          
          <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.8 }}>
            <div>💡 Try these interactions:</div>
            <div>• Click/touch the avatar</div>
            <div>• Hover over the avatar</div>
            <div>• Ask SQL questions</div>
            <div>• Type SQL queries</div>
          </div>
        </div>

        {/* Enhanced Chat with Avatar */}
        <EnhancedChatWithAvatar
          chatId={null}
          enableAvatarInteractions={isEnabled}
          enableSQLGestureMapping={sqlMappingEnabled}
          enableAnalytics={analyticsEnabled}
        />
        
        {/* Feature Information */}
        <div style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          fontSize: '12px',
          zIndex: 1000,
          maxWidth: '300px'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>🚀 Sprint 1 Features</h4>
          <div style={{ marginBottom: '5px' }}>✅ Interactive Avatar System</div>
          <div style={{ marginBottom: '5px' }}>✅ Gesture Queue Management</div>
          <div style={{ marginBottom: '5px' }}>✅ SQL Query Analysis</div>
          <div style={{ marginBottom: '5px' }}>✅ User Analytics Tracking</div>
          <div style={{ marginBottom: '5px' }}>✅ Visual Micro-interactions</div>
          <div style={{ marginBottom: '5px' }}>✅ Mobile Touch Support</div>
          <div style={{ marginBottom: '5px' }}>✅ Accessibility Features</div>
          
          <div style={{ marginTop: '10px', fontSize: '11px', opacity: 0.7 }}>
            Ready for Sprint 2: Intelligence Layer
          </div>
        </div>
      </main>
    </div>
  );
};

export default EnhancedAvatarDemo;
