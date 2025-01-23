"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './admin_page.module.css';
import config from '../config';

const SERVER_BASE = config.serverUrl;

const AdminPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([{ id: 0, name: 'כל הכיתות' }]);

  // Fetch users and classes data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch users
        const usersResponse = await fetch(`${SERVER_BASE}/users`);
        const usersData = await usersResponse.json();
        setUsers(usersData);

        try {
          // Fetch classes if endpoint exists-- needs to add classes column to the users table
          const classesResponse = await fetch(`${SERVER_BASE}/classes`);
          if (classesResponse.ok) {
            const classesData = await classesResponse.json();
            setClasses([{ id: 0, name: 'כל הכיתות' }, ...classesData]);
          }
        } catch (classErr) {
          console.log('Classes endpoint not available yet');
          // Continue with default class only
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to fetch users');
      }
    };

    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState(0); // 0 represents all classes
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<Array<{type: string; amount?: number}>>([]);
  const [balanceAmount, setBalanceAmount] = useState<string>('');
  const [currentAction, setCurrentAction] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      router.push('/login');
      return;
    }

    const user = JSON.parse(storedUser);
    
    
    // For now using a placeholder check -needs to check if keeping it in a list version or a db version
    const adminEmails = ["liorbs89@gmail.com", "eyalh747@gmail.com", "orperets11@gmail.com"," roei mail"];
    const isAdmin = adminEmails.includes(user.email);
    
    if (!isAdmin) {
      setError('אין לך הרשאת גישה לממשק המנהל');
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      return;
    }

    setCurrentUser(user.name);
  }, [router]);

  return error ? (
    <div className={styles.adminContainer}>
      <div className={styles.errorMessage}>{error}</div>
    </div>
  ) : (
    <div className={styles.adminContainer}>
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <div className={styles.nickname}>
            היי {currentUser}
          </div>
        </div>
      </div>
      <div className={styles.controlsContainer}>
        {selectedUsers.length > 0 && (
          <div className={styles.bulkActions}>
            <div className={styles.selectedActions}>
              {selectedActions.map((action, index) => (
                <div key={index} className={styles.selectedAction}>
                  {action.type === 'reset_password' ? 'Reset Password' : 
                   `${action.type.replace('_', ' ').toUpperCase()}: ${action.amount}`}
                  <button onClick={() => {
                    setSelectedActions(prev => prev.filter((_, i) => i !== index));
                  }}>×</button>
                </div>
              ))}
            </div>
            
            <select
              value={currentAction}
              onChange={(e) => setCurrentAction(e.target.value)}
              className={styles.actionSelect}
            >
              <option value="">...Choose Action</option>
              <option value="reset_password">Reset Password</option>
              <option value="add_balance">Add Tokens </option>
              <option value="reduce_balance">Reduce Tokens </option>
              <option value="set_balance">Set New Balance </option>
            </select>
            
            {['add_balance', 'reduce_balance', 'set_balance'].includes(currentAction) && (
              <input
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="Amount"
                className={styles.balanceInput}
              />
            )}
            
            <button
              onClick={() => {
                if (!currentAction) return;
                
                if (['add_balance', 'reduce_balance', 'set_balance'].includes(currentAction) && !balanceAmount) {
                  setError('Please enter an amount');
                  return;
                }

                setSelectedActions(prev => [...prev, {
                  type: currentAction,
                  amount: ['add_balance', 'reduce_balance', 'set_balance'].includes(currentAction) 
                    ? parseInt(balanceAmount)
                    : undefined
                }]);

                setCurrentAction('');
                setBalanceAmount('');
              }}
              className={styles.addActionButton}
            >
              Add Action
            </button>

            <button 
              onClick={async () => {
                try {
                  if (selectedActions.length === 0) {
                    setError('Please add at least one action');
                    return;
                  }

                  // Prepare the request body with all actions
                  const requestBody = {
                    users: selectedUsers,
                    actions: selectedActions
                  };

                  // Send request to server with multiple actions
                  const response = await fetch('/api/admin/bulk-actions', {
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

                  // Refresh users data after successful action
                  const usersResponse = await fetch(`${SERVER_BASE}/users`);
                  const usersData = await usersResponse.json();
                  setUsers(usersData);

                  // Reset form and clear any previous errors
                  setError('');
                  setCurrentAction('');
                  setBalanceAmount('');
                  setSelectedUsers([]);
                  setSelectedActions([]);
                } catch (err) {
                  console.error('Error performing bulk action:', err);
                  setError('Failed to perform action');
                }
              }}
              className={styles.actionButton}
              disabled={selectedActions.length === 0}
            >
              בצע פעולה
            </button>
          </div>
        )}
        
        <div className={styles.searchContainer}>
          <div className={styles.searchHeader}>
            <input
              type="text"
              placeholder="חיפוש משתמש..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            <div className={styles.filterGroup}>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(Number(e.target.value))}
                className={styles.classSelect}
              >
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.usersContainer}>
          <div className={styles.usersHeader}>
            <label className={styles.selectAllContainer}>
              <input
                type="checkbox"
                checked={selectedUsers.length === users.filter(user => 
                  (selectedClass === 0 || user.classId === selectedClass) &&
                  (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  user.email.toLowerCase().includes(searchTerm.toLowerCase()))
                ).length}
                onChange={(e) => {
                  const filteredUsers = users.filter(user => 
                    (selectedClass === 0 || user.classId === selectedClass) &&
                    (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.email.toLowerCase().includes(searchTerm.toLowerCase()))
                  );
                  setSelectedUsers(e.target.checked ? filteredUsers.map(u => u.email) : []);
                }}
              />
              בחר הכל
            </label>
          </div>
          <div className={styles.usersList}>
            {users
              .filter(user => 
                (selectedClass === 0 || user.classId === selectedClass) &&
                (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase()))
              )
              .map(user => (
                <div key={user.id} className={styles.userCard}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.email)}
                    onChange={(e) => {
                      setSelectedUsers(prev => 
                        e.target.checked 
                          ? [...prev, user.email]
                          : prev.filter(email => email !== user.email)
                      );
                    }}
                    className={styles.userCheckbox}
                  />
                  <div className={styles.userBalance}>
                    <span>current balance: </span>{user.balance} tokens
                  </div>
                  <div className={styles.userInfo}>
                    <div className={styles.userEmail}>{user.email}</div>
                    <div className={styles.userName}>{user.name}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
};
export default AdminPage;
