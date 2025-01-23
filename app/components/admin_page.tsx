"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './admin_page.module.css';

const AdminPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([
    // TO-DO - Need to connect this to DB to fetch real users, their class IDs, and balances
    // This is temporary mock data
    { id: 1, name: 'משה כהן', email: 'moshe@example.com', classId: 1, balance: 50 },
    { id: 2, name: 'שרה לוי', email: 'sarah@example.com', classId: 1, balance: 30 },
    { id: 3, name: 'דוד ישראלי', email: 'david@example.com', classId: 2, balance: 100 },
    { id: 4, name: 'רחל כהן', email: 'rachel@example.com', classId: 2, balance: 75 },
    { id: 5, name: 'יעקב לוי', email: 'yaakov@example.com', classId: 3, balance: 25 },
    { id: 6, name: 'חנה גולדברג', email: 'hana@example.com', classId: 3, balance: 60 },
    { id: 7, name: 'יוסף אברהם', email: 'yosef@example.com', classId: 1, balance: 45 },
    { id: 8, name: 'מרים דוד', email: 'miriam@example.com', classId: 2, balance: 85 },
    { id: 9, name: 'אברהם כץ', email: 'avraham@example.com', classId: 3, balance: 15 },
    { id: 10, name: 'רות בן דוד', email: 'ruth@example.com', classId: 1, balance: 90 },
  ]);

  // TO-DO - Need to connect this to DB to fetch class data
  const classes = [
    { id: 0, name: 'כל הכיתות' },
    { id: 1, name: 'כיתה א׳' },
    { id: 2, name: 'כיתה ב׳' },
    { id: 3, name: 'כיתה ג׳' },
  ];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState(0); // 0 represents all classes
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [balanceAmount, setBalanceAmount] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      router.push('/login');
      return;
    }

    const user = JSON.parse(storedUser);
    
    // TO-DO - Need to connect this function to DB to check if user is admin
    // For now using a placeholder check
    const adminEmails = ["liorbs89@gmail.com", "eyalh747@gmail.com", "or mail"," roei mail"];
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
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className={styles.actionSelect}
            >
              <option value="">...Choose Action</option>
              <option value="reset_password">Reset Password</option>
              <option value="add_balance">Add Tokens </option>
              <option value="reduce_balance">Reduce Tokens </option>
              <option value="set_balance">Set New Balance </option>
            </select>
            
            {['add_balance', 'reduce_balance', 'set_balance'].includes(selectedAction) && (
              <input
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="Amount"
                className={styles.balanceInput}
              />
            )}
            
            <button 
              onClick={async () => {
                // TO-DO: Implement bulk actions and connect to DB
                console.log('Action:', selectedAction, 'Users:', selectedUsers, 'Amount:', balanceAmount);

                // Send email notifications based on action type
                for (const userEmail of selectedUsers) {
                  const user = users.find(u => u.email === userEmail);
                  if (!user) continue;

                  let emailContent = {
                    to: userEmail,
                    subject: '',
                    body: ''
                  };

                  switch (selectedAction) {
                    case 'reset_password':
                      emailContent.subject = 'Michael Password Reset Notification';
                      emailContent.body = `Dear ${user.name}, your password has been reset by an administrator. Please check your inbox for further instructions.`;
                      break;
                    case 'add_balance':
                      emailContent.subject = 'Michael Tokens Added to Your Account';
                      emailContent.body = `Dear ${user.name}, ${balanceAmount} tokens have been added to your account. Your new balance is ${user.balance + parseInt(balanceAmount)} tokens.`;
                      break;
                    case 'reduce_balance':
                      emailContent.subject = 'Michael Tokens Deducted from Your Account';
                      emailContent.body = `Dear ${user.name}, ${balanceAmount} tokens have been deducted from your account. Your new balance is ${user.balance - parseInt(balanceAmount)} tokens.`;
                      break;
                    case 'set_balance':
                      emailContent.subject = 'Michael Account Balance Updated';
                      emailContent.body = `Dear ${user.name}, your account balance has been set to ${balanceAmount} tokens.`;
                      break;
                  }

                  // TODO: Implement email sending service integration
                  console.log('Sending email notification:', emailContent);
                }

                setSelectedAction('');
                setBalanceAmount('');
                setSelectedUsers([]);
              }}
              className={styles.actionButton}
              disabled={!selectedAction || (['add_balance', 'reduce_balance', 'set_balance'].includes(selectedAction) && !balanceAmount)}
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
