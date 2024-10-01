"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import styles from "./page.module.css";
import Chat from "../../components/chat";

const Home = () => {

  const [currentUser, setCurrectUser] = useState(null);

  useEffect(() => {
    let cUser = JSON.parse(localStorage.getItem("currentUser"))
    setCurrectUser(cUser["name"])
  }, [])
  
  return (
    <div>
      <div className={styles.nickname}>
        שלום, {currentUser}
      </div>
    <main className={styles.main}>
        <Chat chatId={null}/>
    </main>
    </div>
  );
};

export default Home;
