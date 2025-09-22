"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import styles from "../entities/basic-chat/page.module.css";
import ChatEnglish from "../components/chat-english";

const EnglishDemo = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      router.push('/login'); // Redirect to login if no user is found
      return;
    }
    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <main className={styles.main}>
        {/* <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '14px',
          zIndex: 1000
        }}>
          English Demo Version
        </div> */}
        <ChatEnglish chatId={null}/>
      </main>
    </div>
  );
};

export default EnglishDemo;
