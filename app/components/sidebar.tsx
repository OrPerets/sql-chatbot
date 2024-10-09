import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './sidebar.module.css';

type ChatSession = {
  _id: string;
  title: string;
  lastMessageTimestamp: number;
};

type SidebarProps = {
  chatSessions: ChatSession[];
  onChatSelect: (chatId: string) => void;
  handleLogout: () => void;
  onNewChat: () => void;
  currentUser: string; // Add this new prop
};

const Sidebar: React.FC<SidebarProps> = ({ chatSessions, onChatSelect, handleLogout, onNewChat, currentUser }) => {
  const pathname = usePathname();

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
      <h2 className={styles.sidebarTitle}>שיחות קודמות</h2>
        {/* User Icon with first letter of currentUser */}
        <div
          className={styles.userIcon}
          title="Want to logout?"
          onClick={handleLogout}
          aria-label="User Icon"
        >
          {currentUser.charAt(0).toUpperCase()}
        </div>
        
      </div>
      <ul className={styles.sidebarList}>
        {chatSessions.map((session) => (
          <li key={session._id} className={styles.sidebarItem}>
            <Link
              href={`/chat/${session._id}`}
              onClick={(e) => {
                e.preventDefault();
                onChatSelect(session._id);
              }}
              className={`${styles.sidebarLink} ${
                pathname === `/chat/${session._id}` ? styles.active : ''
              }`}
            >
              {session.title}
            </Link>
          </li>
        ))}
      </ul>
      {/* New Chat Button moved to bottom left */}
      <button
        onClick={onNewChat}
        className={styles.newChatButton}
        aria-label="New Chat"
      >
        +
      </button>
      {/* <button onClick={handleLogout} className={styles.logoutButton}>התנתק</button> */}
    </div>
  );
};

export default Sidebar;