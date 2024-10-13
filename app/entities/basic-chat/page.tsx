"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import styles from "./page.module.css";
import Chat from "../../components/chat";
import SQLQueryEditor from "@/app/components/query-vizualizer";

const Home = () => {

  return (
    <div>
    <main className={styles.main}>
        <Chat chatId={null}/>
    </main>
    </div>
  );
};

export default Home;
