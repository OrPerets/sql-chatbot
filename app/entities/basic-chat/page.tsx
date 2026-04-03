"use client";

import React from "react";
import styles from "./page.module.css";
import Chat from "../../components/chat";

const Home = () => {
  return (
    <div>
      <main className={styles.main}>
        <Chat
          chatId={null}
          enableRelationalAlgebraMode={true}
          enableComposerCommands={true}
          conversationVariant="professional"
        />
      </main>
    </div>
  );
};

export default Home;
