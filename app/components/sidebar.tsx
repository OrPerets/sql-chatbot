import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
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

const Sidebar: React.FC<SidebarProps> = ({ chatSessions, onChatSelect, handleLogout, onNewChat, currentUser, onToggleSidebar }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const userInitial = currentUser?.charAt(0)?.toUpperCase() ?? "?";

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
            {/* <button
              type="button"
              className={styles.userIcon}
              title="User Menu"
              onClick={toggleMenu}
              aria-label="User Icon"
            >
              {userInitial}
            </button> */}
        <h2 className={styles.sidebarTitle}>  <button
            onClick={onNewChat}
            className={styles.newChatButton}
            aria-label="New Chat"
            title="שיחה חדשה"
          >
            <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
          </button>&nbsp;&nbsp; שיחות קודמות </h2>
        <div className={styles.headerButtons}>
          
          {/* Close Button */}
          {onToggleSidebar && (
            <button
              className={styles.closeButton}
              onClick={onToggleSidebar}
              title="סגור צד"
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
                  שיחה חדשה
                </button>
                <button onClick={handleLogout} className={styles.menuItem}>
                  התנתק
                </button>
              </div>
            )}
          </div>
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
                pathname === `/chat/${session._id}` ? styles.sidebarLinkActive : ""
              }`}
            >
              <span className={styles.sessionTitle}>{session.title}</span>
              <span className={styles.sessionDate}>{formatSessionDate(session.lastMessageTimestamp)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sidebar;
