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

const formatSessionDate = (timestamp: number) => {
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(new Date(timestamp))
    .replace(/\//g, "-");
};

const SidebarEnglish: React.FC<SidebarProps> = ({ chatSessions, onChatSelect, handleLogout, onNewChat, currentUser, onToggleSidebar }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const userInitial = currentUser?.charAt(0)?.toUpperCase() ?? "J";

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
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
            <button
              type="button"
              className={styles.userIcon}
              title="User Menu"
              onClick={toggleMenu}
              aria-label="User Icon"
            >
              {userInitial}
            </button>
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
                pathname === `/chat/${session._id}` ? styles.sidebarLinkActive : ""
              }`}
            >
              <span className={styles.sessionTitle}>{session.title}</span>
              <span className={styles.sessionDate}>{formatSessionDate(session.lastMessageTimestamp)}</span>
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
