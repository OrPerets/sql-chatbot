import React from 'react';
import styles from '../admin_page.module.css';

interface User {
  id: string;
  email: string;
  name: string;
  firstName: string;
  classId: number;
  coins: number;
}

interface UsersListProps {
  users: User[];
  selectedUsers: string[];
  setSelectedUsers: (users: string[]) => void;
  searchTerm: string;
  selectedClass: number;
}

const UsersList: React.FC<UsersListProps> = ({
  users,
  selectedUsers,
  setSelectedUsers,
  searchTerm,
  selectedClass,
}) => {
  const filteredUsers = users.filter(user =>
    (selectedClass === 0 || user.classId === selectedClass) &&
    (user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={styles.usersContainer}>
      <div className={styles.usersHeader}>
        <label className={styles.selectAllContainer}>
          <input
            type="checkbox"
            checked={selectedUsers.length === filteredUsers.length}
            onChange={(e) => {
              setSelectedUsers(e.target.checked ? filteredUsers.map(u => u.email) : []);
            }}
          />
          בחר הכל
        </label>
      </div>
      <div className={styles.usersList}>
        {filteredUsers.map(user => (
          <div key={user.id} className={styles.userCard}>
            <div className={styles.leftSection}>
              <input
                type="checkbox"
                checked={selectedUsers.includes(user.email)}
                onChange={(e) => {
                  setSelectedUsers(
                    e.target.checked
                      ? [...selectedUsers, user.email]
                      : selectedUsers.filter(email => email !== user.email)
                  );
                }}
                className={styles.userCheckbox}
              />
              <div className={styles.userBalance}>
                <span>יתרה נוכחית: </span>{user.coins}
              </div>
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userEmail}>{user.email}</div>
              <div className={styles.userName}>{user.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsersList;