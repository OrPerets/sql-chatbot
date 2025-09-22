import React, { useState } from 'react';
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
  currentUser: string;
  onToggleSidebar?: () => void;
};

const SidebarEnglish: React.FC<SidebarProps> = ({ chatSessions, onChatSelect, handleLogout, onNewChat, currentUser, onToggleSidebar }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Hardcoded sample chat sessions for demo
  const sampleSessions = [
    { _id: '1', title: 'SQL Basics Tutorial', lastMessageTimestamp: Date.now() },
    { _id: '2', title: 'JOIN Operations Help', lastMessageTimestamp: Date.now() - 86400000 },
    { _id: '3', title: 'Database Design Questions', lastMessageTimestamp: Date.now() - 172800000 },
    { _id: '4', title: 'Advanced Queries Practice', lastMessageTimestamp: Date.now() - 259200000 },
    { _id: '5', title: 'Performance Optimization', lastMessageTimestamp: Date.now() - 345600000 },
  ];

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
            <div
              className={styles.userIcon}
              title="User Menu"
              onClick={toggleMenu}
              aria-label="User Icon"
            >
              J
            </div>
        <h2 className={styles.sidebarTitle}>Previous Chats</h2>
        <div className={styles.headerButtons}>
          {/* Close Button */}
          {onToggleSidebar && (
            <button
              className={styles.closeButton}
              onClick={onToggleSidebar}
              title="Close Sidebar"
              aria-label="Close Sidebar"
            >
              ×
            </button>
          )}
          {/* User Icon with first letter of currentUser */}
          <div className={styles.userIconWrapper}>
            
            {isMenuOpen && (
              <div className={styles.dropdownMenu}>
                <button onClick={onNewChat} className={styles.menuItem}>
                  New Chat
                </button>
                <button onClick={handleLogout} className={styles.menuItem}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ul className={styles.sidebarList}>
        {sampleSessions.map((session) => (
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
      <button
        onClick={onNewChat}
        className={styles.newChatButton}
        aria-label="New Chat"
      >
        +
      </button>
    </div>
  );
};

export default SidebarEnglish;
