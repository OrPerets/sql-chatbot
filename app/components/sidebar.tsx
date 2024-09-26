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
};

const Sidebar: React.FC<SidebarProps> = ({ chatSessions, onChatSelect, handleLogout }) => {
  const pathname = usePathname();

  return (
    <div className={styles.sidebar}>
      <h2 className={styles.sidebarTitle}>שיחות קודמות</h2>
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
      <button onClick={handleLogout} className={styles.logoutButton}>התנתק</button>
    </div>
  );
};

export default Sidebar;