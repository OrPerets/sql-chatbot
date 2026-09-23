"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpenText,
  Check,
  CircleAlert,
  MessageCircle,
  Play,
  Save,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Chat from "@/app/components/chat";
import { LEARNING_VIDEOS } from "@/lib/learning-videos";

import styles from "./virtual-learning.module.css";

type NoteStatus = "idle" | "loading" | "saving" | "saved" | "error";

const getUserId = (storedUser: string) => {
  const user = JSON.parse(storedUser);
  const resolvedId = user?.id || user?._id || user?.email;
  return resolvedId ? String(resolvedId) : null;
};

export default function VirtualLearningClient() {
  const router = useRouter();
  const [selectedVideoId, setSelectedVideoId] = useState(LEARNING_VIDEOS[0].id);
  const [userId, setUserId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [lastSavedContent, setLastSavedContent] = useState("");
  const [noteStatus, setNoteStatus] = useState<NoteStatus>("idle");
  const activeVideoIdRef = useRef(selectedVideoId);

  const selectedVideo = useMemo(
    () =>
      LEARNING_VIDEOS.find((video) => video.id === selectedVideoId) ??
      LEARNING_VIDEOS[0],
    [selectedVideoId],
  );

  const isNoteDirty = noteContent !== lastSavedContent;

  useEffect(() => {
    const storedUser = window.localStorage.getItem("currentUser");

    if (!storedUser) {
      setAuthResolved(true);
      router.replace("/");
      return;
    }

    try {
      const resolvedId = getUserId(storedUser);
      if (!resolvedId) {
        throw new Error("Missing learner id");
      }
      setUserId(resolvedId);
    } catch (error) {
      console.error("Failed to resolve learner for virtual learning:", error);
      router.replace("/");
    } finally {
      setAuthResolved(true);
    }
  }, [router]);

  useEffect(() => {
    activeVideoIdRef.current = selectedVideoId;
  }, [selectedVideoId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const controller = new AbortController();
    const targetId = selectedVideoId;
    setNoteStatus("loading");
    setNoteContent("");
    setLastSavedContent("");

    const loadNote = async () => {
      try {
        const response = await fetch(
          `/api/learning/notes?userId=${encodeURIComponent(userId)}&targetType=video&targetId=${encodeURIComponent(targetId)}`,
          {
            headers: { "x-user-id": userId },
            credentials: "same-origin",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Failed to load video note");
        }

        const data = await response.json();
        if (activeVideoIdRef.current !== targetId) {
          return;
        }

        const content = typeof data?.note?.content === "string" ? data.note.content : "";
        setNoteContent(content);
        setLastSavedContent(content);
        setNoteStatus("idle");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load video note:", error);
        setNoteStatus("error");
      }
    };

    void loadNote();
    return () => controller.abort();
  }, [selectedVideoId, userId]);

  const saveNote = useCallback(
    async (targetId: string, content: string) => {
      if (!userId) {
        return;
      }

      setNoteStatus("saving");

      try {
        const response = await fetch("/api/learning/notes", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId,
          },
          credentials: "same-origin",
          body: JSON.stringify({
            userId,
            targetType: "video",
            targetId,
            content,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save video note");
        }

        if (activeVideoIdRef.current === targetId) {
          setLastSavedContent(content);
          setNoteStatus("saved");
        }
      } catch (error) {
        console.error("Failed to save video note:", error);
        if (activeVideoIdRef.current === targetId) {
          setNoteStatus("error");
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId || noteStatus === "loading" || !isNoteDirty) {
      return;
    }

    const targetId = selectedVideoId;
    const timeoutId = window.setTimeout(() => {
      void saveNote(targetId, noteContent);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [isNoteDirty, noteContent, noteStatus, saveNote, selectedVideoId, userId]);

  const handleSelectVideo = (videoId: string) => {
    if (videoId === selectedVideoId) {
      return;
    }

    if (isNoteDirty && userId) {
      void saveNote(selectedVideoId, noteContent);
    }
    activeVideoIdRef.current = videoId;
    setSelectedVideoId(videoId);
  };

  const noteStatusLabel = {
    idle: isNoteDirty ? "טרם נשמר" : "ההערה מעודכנת",
    loading: "טוען הערה...",
    saving: "שומר...",
    saved: "נשמר",
    error: "לא הצלחנו לשמור",
  }[noteStatus];

  if (!authResolved || !userId) {
    return (
      <div className={styles.loadingScreen} dir="rtl" role="status">
        <span className={styles.loadingSpinner} aria-hidden="true" />
        <span>מכינים את סביבת הלמידה...</span>
      </div>
    );
  }

  return (
    <div className={styles.page} dir="rtl">
      <header className={styles.header}>
        <div className={styles.headerIdentity}>
          <Link className={styles.backLink} href="/landing" aria-label="חזרה למסך הראשי">
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
          <div className={styles.headerIcon} aria-hidden="true">
            <Play size={20} fill="currentColor" />
          </div>
          <div>
            <p className={styles.eyebrow}>Michael SQL Learning Lab</p>
            <h1>סביבת למידה וירטואלית</h1>
          </div>
        </div>
        <p className={styles.headerHint}>צופים, מסכמים ושואלים — באותו מסך</p>
      </header>

      <main className={styles.workspace}>
        <aside className={styles.videoLibrary} aria-label="ספריית סרטוני SQL">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.panelEyebrow}>ספריית תוכן</p>
              <h2>סרטוני SQL</h2>
            </div>
            <span className={styles.videoCount}>{LEARNING_VIDEOS.length}</span>
          </div>

          <div className={styles.videoList}>
            {LEARNING_VIDEOS.map((video, index) => {
              const isActive = video.id === selectedVideo.id;
              return (
                <button
                  key={video.id}
                  type="button"
                  className={`${styles.videoItem} ${isActive ? styles.videoItemActive : ""}`}
                  onClick={() => handleSelectVideo(video.id)}
                  aria-pressed={isActive}
                >
                  <span className={styles.videoNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.videoItemCopy}>
                    <strong>{video.title}</strong>
                    <span>{video.description}</span>
                  </span>
                  <span className={styles.videoPlayIcon} aria-hidden="true">
                    {isActive ? <Check size={17} /> : <Play size={15} fill="currentColor" />}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={styles.learningCanvas} aria-labelledby="selected-video-title">
          <div className={styles.videoHeader}>
            <div>
              <p className={styles.panelEyebrow}>עכשיו לומדים</p>
              <h2 id="selected-video-title">{selectedVideo.title}</h2>
              <p>{selectedVideo.description}</p>
            </div>
            <span className={styles.lessonIndex}>
              שיעור {LEARNING_VIDEOS.findIndex((video) => video.id === selectedVideo.id) + 1} מתוך {LEARNING_VIDEOS.length}
            </span>
          </div>

          <div className={styles.videoFrame}>
            <video
              key={selectedVideo.id}
              className={styles.video}
              controls
              preload="metadata"
              playsInline
              aria-label={`סרטון: ${selectedVideo.title}`}
            >
              <source src={`/learning-videos/${selectedVideo.filename}`} type="video/mp4" />
              הדפדפן שלך אינו תומך בניגון וידאו.
            </video>
          </div>

          <div className={styles.conceptRow} aria-label="נושאים בסרטון">
            {selectedVideo.concepts.map((concept) => (
              <span key={concept}>{concept}</span>
            ))}
          </div>

          <section className={styles.notesSection} aria-labelledby="notes-title">
            <div className={styles.notesHeader}>
              <div className={styles.notesTitleGroup}>
                <BookOpenText size={20} aria-hidden="true" />
                <div>
                  <p className={styles.panelEyebrow}>מחברת אישית</p>
                  <h2 id="notes-title">הערות ל־{selectedVideo.title}</h2>
                </div>
              </div>
              <div className={styles.noteActions}>
                <span
                  className={`${styles.noteStatus} ${noteStatus === "error" ? styles.noteStatusError : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  {noteStatus === "error" ? <CircleAlert size={14} /> : noteStatus === "saved" ? <Check size={14} /> : null}
                  {noteStatusLabel}
                </span>
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={() => void saveNote(selectedVideo.id, noteContent)}
                  disabled={!isNoteDirty || noteStatus === "loading" || noteStatus === "saving"}
                >
                  <Save size={16} aria-hidden="true" />
                  שמירה
                </button>
              </div>
            </div>
            <textarea
              className={styles.notesInput}
              value={noteContent}
              onChange={(event) => {
                setNoteContent(event.target.value);
                if (noteStatus === "saved") {
                  setNoteStatus("idle");
                }
              }}
              onBlur={() => {
                if (isNoteDirty) {
                  void saveNote(selectedVideo.id, noteContent);
                }
              }}
              disabled={noteStatus === "loading"}
              placeholder={`כתבו כאן נקודות חשובות, דוגמאות ושאלות על ${selectedVideo.title}...`}
              aria-label={`הערות אישיות עבור ${selectedVideo.title}`}
            />
          </section>
        </section>

        <aside className={styles.michaelSidebar} aria-label="שיחה עם Michael">
          <div className={styles.michaelHeader}>
            <div className={styles.michaelMark} aria-hidden="true">
              <Sparkles size={18} />
            </div>
            <div>
              <h2>Michael</h2>
              <p>אפשר לשאול אותי על מה שראיתם</p>
            </div>
            <MessageCircle className={styles.messageIcon} size={20} aria-hidden="true" />
          </div>
          <div className={styles.chatContent}>
            <Chat
              chatId={null}
              hideSidebar={true}
              hideAvatar={true}
              minimalMode={true}
              embeddedMode={true}
              conversationVariant="professional"
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
