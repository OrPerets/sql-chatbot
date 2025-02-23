import React from 'react';
import styles from '../admin_page.module.css';
import config from '../../config';

const options = {
  'add_balance': 'הוסף מטבעות',
  'reduce_balance': 'הפחת מטבעות',
  'reset_password': 'איפוס סיסמה'
};

interface BulkActionsProps {
  selectedUsers: string[];
  onSuccess: () => void;
  onError: (message: string) => void;
}

const BulkActions: React.FC<BulkActionsProps> = ({ selectedUsers, onSuccess, onError }) => {
  const [actionType, setActionType] = React.useState('');
  const [balanceAmount, setBalanceAmount] = React.useState('');

  const handleAction = async () => {
    try {
      if (!actionType) {
        onError('Please select an action');
        return;
      }
      if (['add_balance', 'reduce_balance', 'set_balance'].includes(actionType) && !balanceAmount) {
        onError('Please enter an amount');
        return;
      }

      if (actionType === "reset_password") {
        await fetch(`${config.serverUrl}/updatePasswordToMany`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emails: selectedUsers})
        });
      } else {
        const requestBody = {
          users: selectedUsers,
          type: actionType,
          amount: parseInt(balanceAmount)
        };

        const response = await fetch(`${config.serverUrl}/admin/changeBalance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to perform bulk action');
        }
      }

      setActionType('');
      setBalanceAmount('');
      onSuccess();
    } catch (err) {
      console.error('Error performing bulk action:', err);
      onError('Failed to perform action');
    }
  };

  return (
    <div className={styles.bulkActions}>
      <select
        value={actionType}
        onChange={(e) => setActionType(e.target.value)}
        className={styles.actionSelect}
      >
        <option value="">בחר אפשרות</option>
        {Object.entries(options).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      
      {Object.keys(options).includes(actionType) && (
        <input
          type="number"
          value={balanceAmount}
          onChange={(e) => setBalanceAmount(e.target.value)}
          placeholder="Amount"
          className={styles.balanceInput}
        />
      )}

      <button
        onClick={handleAction}
        className={styles.actionButton}
        disabled={!actionType}
      >
        אישור
      </button>
    </div>
  );
};

export default BulkActions;