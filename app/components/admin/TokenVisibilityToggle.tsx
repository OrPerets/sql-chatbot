import React from 'react';
import styles from '../admin_page.module.css';
import config from '../../config';

interface TokenVisibilityToggleProps {
  isVisible: boolean;
  onToggle: (newValue: boolean) => void;
}

const TokenVisibilityToggle: React.FC<TokenVisibilityToggleProps> = ({ isVisible, onToggle }) => {
  return (
    <div className={styles.tokenVisibilityToggle}>
      <label>
        מטבעות וירטואלים
        <div className={styles.toggle}>
          <input
            type="checkbox"
            checked={isVisible}
            onChange={async (e) => {
              const newValue = e.target.checked;
              onToggle(newValue);
              try {
                await fetch(`${config.serverUrl}/setTokenVisibility`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ isVisible: newValue })
                });
              } catch (error) {
                console.error('Error updating token visibility:', error);
              }
            }}
          />
          <div className={styles.slider}>
            <span className={styles.on}></span>
            <span className={styles.off}></span>
          </div>
        </div>
      </label>
    </div>
  );
};

export default TokenVisibilityToggle;