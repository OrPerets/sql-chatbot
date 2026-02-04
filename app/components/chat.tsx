"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import styles from "./chat.module.css";
import "./mobile-optimizations.css";
import Markdown from "react-markdown";
import { ThumbsUp, ThumbsDown, ClipboardCopy, Plus, Sparkles, ImagePlus, Braces, BarChart3, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import Sidebar from './sidebar';
import { useRouter } from 'next/navigation';
import Modal from "./modal";
import SQLQueryEditorComponent from "./query-vizualizer";
import ImageUpload from "./image-upload";
import { fileToBase64 } from "../utils/parseImage";
// import AudioRecorder from "./audio-recorder"; // Clean version: hide audio recorder button
// AVATAR RE-ENABLED
import MichaelAvatarDirect from "./MichaelAvatarDirect";
import VoiceModeCircle from "./VoiceModeCircle";
import StaticLogoMode from "./StaticLogoMode";
// import { AvatarIcon, MicIcon } from "./AvatarToggleIcons";
// import Avatar3DErrorBoundary from "./michael-3d-visual-wrapper";
// import { enhancedTTS } from "@/app/utils/enhanced-tts";
// import AvatarInteractionManager from "./AvatarInteractionManager";
import { analyzeMessage } from "../utils/sql-query-analyzer";
// import { avatarAnalytics } from "../utils/avatar-analytics";
import PracticeModal from "./PracticeModal";
import SqlQueryBuilder from "./SqlQueryBuilder/SqlQueryBuilder";
import type { ResponseStreamEvent, SqlTutorResponse } from "@/lib/openai/contracts";

export const maxDuration = 50;

// Replace external base with internal routes
const SAVE = "/api/chat/save"; // not used directly; message saving goes via chat sessions endpoint
const UPDATE_BALANCE = "/api/users/balance";

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
  feedback?: "like" | "dislike" | null;
  onFeedback?: (feedback: "like" | "dislike" | null) => void;
  hasImage?: boolean;
  tutorResponse?: SqlTutorResponse | null;
};

type ClientFunctionToolCall = {
  id?: string;
  function: {
    name: string;
    arguments: string;
  };
};

type StreamFailureKind = "tool_timeout" | "invalid_function_args" | "stream_interruption" | "generic";

type ChatMessage = {
  role: "user" | "assistant" | "code";
  text: string;
  feedback?: "like" | "dislike" | null;
  hasImage?: boolean;
  tutorResponse?: SqlTutorResponse | null;
};

// Add these types
type ChatSession = {
  _id: string;
  title: string;
  lastMessageTimestamp: number;
};

type HomeworkChatContext = {
  homeworkTitle: string;
  backgroundStory?: string;
  tables: Array<{
    name: string;
    columns: string[];
    sampleRows?: Record<string, unknown>[];
  }>;
  questions: Array<{
    id: string;
    prompt: string;
    instructions?: string;
    index: number;
    points?: number;
  }>;
  currentQuestion?: {
    id: string;
    prompt: string;
    instructions?: string;
    index: number;
  } | null;
  studentTableData?: Record<string, any[]>;
};

const UserMessage = ({ text }: { text: string }) => {
  return <div className={styles.userMessage}>{text}</div>;
};
const AssistantMessage = ({
  text,
  feedback = null,
  onFeedback,
  tutorResponse,
  autoPlaySpeech,
  onPlayMessage,
}: {
  text: string;
  feedback: "like" | "dislike" | null;
  onFeedback?: (feedback: "like" | "dislike" | null) => void;
  tutorResponse?: SqlTutorResponse | null;
  autoPlaySpeech?: boolean;
  onPlayMessage?: () => void;
}) => {
  const [activeFeedback, setActiveFeedback] = useState(feedback);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showPlayTooltip, setShowPlayTooltip] = useState(false);  // Separate state for play button tooltip
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [copied, setCopied] = useState(false);  // Tooltip state
  const [copiedText, setCopiedText] =  useState("העתק שאילתה")
  const [playTooltipText, setPlayTooltipText] = useState("השמע הודעה זו");
  const compactText = useMemo(() => {
    const segments = text.split(/(```[\s\S]*?```)/g);
    return segments
      .map((segment) => {
        if (segment.startsWith("```")) return segment;
        return segment.replace(/\n{3,}/g, "\n\n");
      })
      .join("");
  }, [text]);


  const handleLike = () => {
    const newFeedback = activeFeedback === "like" ? null : "like"; // Toggle like
    setActiveFeedback(newFeedback);
    onFeedback && onFeedback(newFeedback);
  };

  const handleDislike = () => {
    const newFeedback = activeFeedback === "dislike" ? null : "dislike"; // Toggle dislike
    setActiveFeedback(newFeedback);
    onFeedback && onFeedback(newFeedback);
  };

  const handlePlayMessage = () => {
    console.log('🔊 handlePlayMessage called', {
      onPlayMessage: !!onPlayMessage,
      text: text?.substring(0, 50) + '...',
      autoPlaySpeech,
      textLength: text?.length || 0
    });
    if (onPlayMessage) {
      onPlayMessage();
      setPlayTooltipText("משמיע...");
      setTimeout(() => {
        setPlayTooltipText("השמע הודעה זו");
      }, 1500);
    } else {
      console.error('❌ onPlayMessage callback is not defined!');
    }
  };

  const copyToClipboard = (textToCopy) => {
    console.log(1)
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setCopied(true); // Show "Copied!" tooltip
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
        }
        tooltipTimeoutRef.current = setTimeout(() => {
          setCopied(false); // Hide tooltip after delay
        }, 2000); 
      })
      .catch((err) => console.error("Failed to copy text: ", err));
  };

const renderers = {
  h1: ({ node, children, ...props }) => (
    <h1 className={styles.messageHeader1} {...props}>{children}</h1>
  ),
  h2: ({ node, children, ...props }) => (
    <h2 className={styles.messageHeader2} {...props}>{children}</h2>
  ),
  h3: ({ node, children, ...props }) => (
    <h3 className={styles.messageHeader3} {...props}>{children}</h3>
  ),
  p: ({ node, children, ...props }) => (
    <p className={styles.messageParagraph} {...props}>{children}</p>
  ),
  ul: ({ node, children, ...props }) => (
    <ul className={styles.messageList} {...props}>{children}</ul>
  ),
  ol: ({ node, children, ...props }) => (
    <ol className={styles.messageOrderedList} {...props}>{children}</ol>
  ),
  li: ({ node, children, ...props }) => (
    <li className={styles.messageListItem} {...props}>{children}</li>
  ),
  strong: ({ node, children, ...props }) => (
    <strong className={styles.messageStrong} {...props}>{children}</strong>
  ),
  em: ({ node, children, ...props }) => (
    <em className={styles.messageEmphasis} {...props}>{children}</em>
  ),
  blockquote: ({ node, children, ...props }) => (
    <blockquote className={styles.messageBlockquote} {...props}>{children}</blockquote>
  ),
  code: ({ node, inline, className, children, ...props }) => {
    const code = Array.isArray(children) ? children.join("") : children;
    
    if (inline) {
      return <code className={styles.inlineCode} {...props}>{children}</code>;
    }
    
    if (className === "language-sql") {
      return (
        <div className={styles.sqlCodeContainer}>
          <div className={styles.sqlCodeHeader}>
            <span className={styles.sqlCodeLabel}>SQL</span>
            <button
              className={styles.sqlCopyButton}
              onClick={() => {
                copyToClipboard(code)
                setCopiedText("הועתק בהצלחה")
              }}
              title="העתק SQL"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>
          </div>
          <pre className={styles.sqlCode}>
            <code className={styles.sqlCodeText}>{code}</code>
          </pre>
          {copied && <div className={styles.sqlTooltip}>{copiedText}</div>}
        </div>
      );
    }
    
    // Generic code block
    return (
      <div className={styles.codeBlock}>
        <pre><code className={className} {...props}>{children}</code></pre>
      </div>
    );
  },
};

  const renderTutorSection = (title: string, content: string) => (
    <div className={styles.tutorSection}>
      <h4 className={styles.tutorSectionTitle}>{title}</h4>
      <Markdown components={renderers}>{content}</Markdown>
    </div>
  );

  const renderTutorResponse = (response: SqlTutorResponse) => {
    const mistakes =
      response.commonMistakes?.length > 0
        ? response.commonMistakes.map((mistake) => `- ${mistake}`).join("\n")
        : "—";
    return (
      <div className={styles.tutorResponse}>
        {renderTutorSection("שאילתה", `\`\`\`sql\n${response.query}\n\`\`\``)}
        {renderTutorSection("הסבר", response.explanation || "—")}
        {renderTutorSection("טעויות נפוצות", mistakes)}
        {renderTutorSection("אופטימיזציה", response.optimization || "—")}
      </div>
    );
  };
const copyQueryToClipboard = (text) => {
  // Regular expression to find SQL queries within ```sql ... ``` blocks
  const sqlRegex = /```sql\s*([\s\S]*?)\s*```/gi; 
  let extractedQueries = [];
  let match;

  // Loop through all matches
  while ((match = sqlRegex.exec(text)) !== null) {
    extractedQueries.push(match[1].trim());
  }

  var queriesToCopy;
  if (extractedQueries.length > 0) {
    queriesToCopy = extractedQueries.join('\n\n'); // Join queries with newlines
  } else {
    queriesToCopy = text;
  }
  navigator.clipboard.writeText(queriesToCopy)
      .then(() => {
        console.log("SQL queries copied to clipboard:\n", queriesToCopy);
        setCopiedText("הועתק בהצלחה");
        setTimeout(() => {
          setCopiedText("העתק שאילתה");
        }, 3000);
      })
      .catch((error) => {
        console.error("Failed to copy:", error);
      });
};
  const copyTextSource = tutorResponse
    ? `\`\`\`sql\n${tutorResponse.query}\n\`\`\``
    : text;

  return (
    <div className={styles.assistantMessage}>
      <div className={styles.messageContent}>
        {tutorResponse ? renderTutorResponse(tutorResponse) : <Markdown components={renderers}>{compactText}</Markdown>}
      </div>
      <div className={styles.feedbackButtons}>
        {!autoPlaySpeech && (
          <button
            onClick={handlePlayMessage}
            className={`${styles.feedbackButton} ${styles.playMessageButton}`}
            onMouseEnter={() => setShowPlayTooltip(true)}
            onMouseLeave={() => setShowPlayTooltip(false)}
            style={{
              marginLeft: "5px"
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
            {showPlayTooltip && (
              <div className={styles.tooltip}>{playTooltipText}</div>
            )}
          </button>
        )}
        <button
          onClick={handleLike}
          className={`${styles.feedbackButton} ${activeFeedback === "like" ? styles.positive : ""}`}
          style={{
            marginLeft: "-1%"
          }}
        >
          {activeFeedback === "like" ? <ThumbsUp width="80%" height="80%" color="green" fill="green" /> : <ThumbsUp width="80%" height="80%" />}
        </button>
        <button
          onClick={handleDislike}
          className={`${styles.feedbackButton} ${activeFeedback === "dislike" ? styles.negative : ""}`}
        >
          {activeFeedback === "dislike" ? <ThumbsDown width="80%" height="80%" color="red" fill="red" /> : <ThumbsDown width="80%" height="80%" />}
        </button>
        <button
          onClick={() => copyQueryToClipboard(copyTextSource)} // Keep this for general copying
          className={`${styles.feedbackButton} ${styles.copyButton}`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          // style={{ opacity: extractedQuery ? 0.5 : 1 }} // Dim if SQL-specific copy exists
        >
          <ClipboardCopy />
          {showTooltip && (
            <div className={styles.tooltip}>{copiedText}</div>
          )}
        </button>
      </div>
    </div>
  );
};
const CodeMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.codeMessage}>
      {text.split("\n").map((line, index) => (
        <div key={index}>
          <span>{`${index + 1}. `}</span>
          {line}
        </div>
      ))}
    </div>
  );
};

const Message = ({
  role,
  text,
  feedback,
  onFeedback,
  hasImage,
  tutorResponse,
  autoPlaySpeech,
  onPlayMessage,
}: MessageProps & { autoPlaySpeech?: boolean; onPlayMessage?: () => void }) => {
  switch (role) {
    case "user":
      return <UserMessage text={text} />;
    case "assistant":
      return (
        <AssistantMessage
          text={text}
          feedback={feedback}
          onFeedback={onFeedback}
          tutorResponse={tutorResponse}
          autoPlaySpeech={autoPlaySpeech}
          onPlayMessage={onPlayMessage}
        />
      );
    case "code":
      return <CodeMessage text={text} />;
    default:
      return null;
  }
};

type ChatProps = {
  functionCallHandler?: (
    toolCall: ClientFunctionToolCall
  ) => Promise<string>;
  chatId: string | null;
  onUserMessage?: (message: string) => void;
  onAssistantResponse?: (response: string) => void;
  hideSidebar?: boolean;
  hideAvatar?: boolean;
  minimalMode?: boolean;
  homeworkContext?: HomeworkChatContext | null;
  embeddedMode?: boolean;
};

const Chat = ({
  functionCallHandler = () => Promise.resolve(""), // default to return empty string
  chatId: initialChatId,
  onUserMessage,
  onAssistantResponse,
  hideSidebar = false,
  hideAvatar = false,
  minimalMode = false,
  homeworkContext = null,
  embeddedMode = false,
}: ChatProps) => {
  void functionCallHandler;
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [previousResponseId, setPreviousResponseId] = useState("");
  const sessionIdRef = useRef("");
  const createSessionPromiseRef = useRef<Promise<string> | null>(null);
  const [user, setUser] = useState(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Avatar interaction system - DISABLED
  const avatarRef = useRef(null);
  const [enableAvatarInteractions, setEnableAvatarInteractions] = useState(false); // DISABLED
  const [enableSQLGestureMapping, setEnableSQLGestureMapping] = useState(false); // DISABLED
  const [enableAnalytics, setEnableAnalytics] = useState(false); // DISABLED
  // Added for query cost estimation feature
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [balanceError, setBalanceError] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isTokenBalanceVisible, setIsTokenBalanceVisible] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false); // Add loading state
  // Add SQL Query Builder state
  const [sqlBuilderOpen, setSqlBuilderOpen] = useState(false);
  // Add audio and speech state
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string>("");
  const [autoPlaySpeech, setAutoPlaySpeech] = useState(false);
  // Environment variables - these are available at build time
  const enableAvatar = process.env.NEXT_PUBLIC_AVATAR_ENABLED === '1' || process.env.NODE_ENV === 'development';
  const enableVoice = process.env.NEXT_PUBLIC_VOICE_ENABLED === '1' || process.env.NODE_ENV === 'development';
  
  // Add avatar mode state with localStorage persistence
  const [avatarMode, setAvatarMode] = useState<'avatar' | 'voice'>('avatar');

  // Add hydration state to prevent layout shift
  const [isHydrated, setIsHydrated] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  
  // Debug logging for production
  useEffect(() => {
    console.log('🔧 Avatar Debug Info:', {
      enableAvatar,
      enableVoice,
      NEXT_PUBLIC_AVATAR_ENABLED: process.env.NEXT_PUBLIC_AVATAR_ENABLED,
      NODE_ENV: process.env.NODE_ENV,
      isHydrated
    });
  }, [enableAvatar, enableVoice, isHydrated]);

  useEffect(() => {
    if (!isActionMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActionMenuOpen]);
  
  // Add display mode state for avatar/logo toggle
  const [displayMode, setDisplayMode] = useState<'avatar' | 'logo'>('avatar');

  // Persist avatar mode changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('avatarMode', avatarMode);
    }
  }, [avatarMode]);

  // Hydration effect to load saved preferences and prevent layout shift
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDisplayMode = localStorage.getItem('displayMode');
      if (savedDisplayMode === 'logo' || savedDisplayMode === 'avatar') {
        setDisplayMode(savedDisplayMode);
      }
      
      // Load saved avatar mode
      const savedAvatarMode = localStorage.getItem('avatarMode');
      if (savedAvatarMode === 'voice' || savedAvatarMode === 'avatar') {
        setAvatarMode(savedAvatarMode);
      }

      setIsHydrated(true);
    }
  }, []);

  // Persist display mode changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && isHydrated) {
      localStorage.setItem('displayMode', displayMode);
    }
  }, [displayMode, isHydrated]);

  // Add sidebar visibility state
  // Check if we're on mobile to default sidebar to closed
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    // Default to closed on mobile devices
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768; // Open on desktop (>=768px), closed on mobile (<768px)
    }
    return true; // Default to open during SSR
  });
  // Add speech timeout for debouncing
  // Add state to track when assistant message is complete and ready for speech
  const [isAssistantMessageComplete, setIsAssistantMessageComplete] = useState(false);
  const [shouldSpeak, setShouldSpeak] = useState(false);
  const [lastSpokenMessageId, setLastSpokenMessageId] = useState<string>("");
  const [currentAssistantMessageId, setCurrentAssistantMessageId] = useState<string>("");

  const getStoredUser = useCallback(() => {
    if (typeof window === "undefined") return null;
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) return null;
    try {
      return JSON.parse(storedUser);
    } catch (error) {
      console.error("Invalid currentUser in localStorage:", error);
      return null;
    }
  }, []);

  // Add state for progressive speech
  const [streamingText, setStreamingText] = useState<string>("");
  const [hasStartedSpeaking, setHasStartedSpeaking] = useState(false);
  const streamingTextRef = useRef<string>("");
  const progressiveSpeechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reasoningLogs, setReasoningLogs] = useState<string[]>([]);
  const [reasoningDraft, setReasoningDraft] = useState("");
  const [isReasoningCollapsed, setIsReasoningCollapsed] = useState(false);
  const [reasoningLogsEnabledForResponse, setReasoningLogsEnabledForResponse] = useState(false);
  const reasoningDraftRef = useRef("");
  const tutorRawResponseRef = useRef("");
  
  // Add state for manual speech playback
  const [isManualSpeech, setIsManualSpeech] = useState(false);

  // State for user typing detection
  const [isUserTyping, setIsUserTyping] = useState(false);
  const userTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Exercise-related state
  const [currentExercise, setCurrentExercise] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [isExerciseMode, setIsExerciseMode] = useState(false);
  const [showSolutionButton, setShowSolutionButton] = useState(false);
  const [pointsAnimation, setPointsAnimation] = useState(null);
  const [exerciseAttempts, setExerciseAttempts] = useState(0);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [exerciseAnswer, setExerciseAnswer] = useState("");

  // Practice-related state
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  const formattedHomeworkContext = useMemo(() => {
    if (!homeworkContext) return null;

    const tableSection = homeworkContext.tables
      .map((table) => {
        const sampleRows = (table.sampleRows ?? [])
          .slice(0, 2)
          .map((row) => JSON.stringify(row))
          .join("\n");

        return `${table.name} (עמודות: ${table.columns.join(", ")})${sampleRows ? `\nדוגמאות נתונים:\n${sampleRows}` : ""}`;
      })
      .join("\n\n");

    const questionSection = homeworkContext.questions
      .map((question) => {
        const base = `${question.index}. ${question.prompt}`;
        const details = [question.instructions, question.points ? `ניקוד: ${question.points}` : null]
          .filter(Boolean)
          .join(" | ");
        return details ? `${base}\n${details}` : base;
      })
      .join("\n\n");

    const studentSection = homeworkContext.studentTableData
      ? Object.entries(homeworkContext.studentTableData)
          .map(([tableName, rows]) => {
            const examples = Array.isArray(rows)
              ? rows.slice(0, 2).map((row) => JSON.stringify(row)).join("\n")
              : "";
            return `${tableName}: ${examples || "(אין נתונים לדוגמא)"}`;
          })
          .join("\n\n")
      : "";

    const parts = [
      `הקשר תרגיל: ${homeworkContext.homeworkTitle}`,
      homeworkContext.backgroundStory ? `רקע: ${homeworkContext.backgroundStory}` : null,
      tableSection ? `מבנה מסד הנתונים:\n${tableSection}` : null,
      questionSection ? `שאלות התרגיל:\n${questionSection}` : null,
      homeworkContext.currentQuestion
        ? `שאלה נוכחית: ${homeworkContext.currentQuestion.index}. ${homeworkContext.currentQuestion.prompt}` +
          (homeworkContext.currentQuestion.instructions ? `\n${homeworkContext.currentQuestion.instructions}` : "")
        : null,
      studentSection ? `נתוני סטודנט ייחודיים:\n${studentSection}` : null,
    ].filter(Boolean);

    return parts.join("\n\n");
  }, [homeworkContext]);

  // Memoized avatar state calculation to prevent multiple renders
  const avatarState = useMemo(() => {
    // Priority order: thinking > listening > speaking > userWriting > idle
    const currentState = isThinking ? 'thinking' 
                        : isRecording ? 'listening' 
                        : (enableAvatar && enableVoice && shouldSpeak && isAssistantMessageComplete) ? 'speaking'
                        : isUserTyping ? 'userWriting'
                        : 'idle';
    console.log('🎭 Avatar state calculation:', {
      isThinking,
      isRecording,
      shouldSpeak,
      autoPlaySpeech,
      isAssistantMessageComplete,
      isUserTyping,
      calculatedState: currentState,
      textLength: lastAssistantMessage?.length || 0
    });
    return currentState;
  }, [
    isThinking,
    isRecording,
    shouldSpeak,
    autoPlaySpeech,
    isAssistantMessageComplete,
    isUserTyping,
    lastAssistantMessage?.length,
    enableAvatar,
    enableVoice
  ]);

  const router = useRouter();

  // Added for query cost estimation: Calculates cost based on input length using GPT-4 pricing
  const calculateCost = (text: string) => { 
  // Rough estimate: 1 token ≈ 4 characters
    const estimatedTokens = Math.ceil(text.length / 4);
    return estimatedTokens
  };

    // Function to toggle the modal
    const toggleModal = () => {
      setShowModal(!showModal);
    };

  // Handle SQL Query Builder
  const handleQueryGenerated = (query: string) => {
    setUserInput(prev => prev + (prev ? '\n' : '') + query);
    setSqlBuilderOpen(false);
  };

  // Handle audio transcription
  const handleAudioTranscription = (transcription: string) => {
    setUserInput(transcription);
    setEstimatedCost(calculateCost(transcription));
  };

  // Handle user typing detection
  const handleUserTyping = () => {
    console.log('✍️ User is typing...');
    
    // Set typing state to true
    setIsUserTyping(true);
    
    // Clear existing timeout
    if (userTypingTimeoutRef.current) {
      clearTimeout(userTypingTimeoutRef.current);
    }
    
    // Set timeout to detect when user stops typing (after 2 seconds of inactivity)
    userTypingTimeoutRef.current = setTimeout(() => {
      console.log('✋ User stopped typing');
      setIsUserTyping(false);
    }, 2000);
  };

  // Exercise-related functions
  const startExercise = async () => {
    // Show disclaimer modal first
    setShowDisclaimerModal(true);
  };

  const handleDisclaimerConfirm = () => {
    setShowDisclaimerModal(false);
    setShowPracticeModal(true);
  };

  const handleDisclaimerCancel = () => {
    setShowDisclaimerModal(false);
  };

  const submitExerciseAnswer = async () => {
    if (!currentExercise || !exerciseAnswer.trim()) return;

    try {
      const storedUser = getStoredUser();
      if (!storedUser?.email) {
        console.warn("No currentUser available for exercise submission.");
        return;
      }
      const response = await fetch(`/api/exercises/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: storedUser.email,
          exerciseId: currentExercise.id,
          answerText: exerciseAnswer
        })
      });

      const result = await response.json();
      
      if (result.correct) {
        // Success - show points animation and close modal
        setUserPoints(result.totalPoints);
        setPointsAnimation(result.pointsAwarded);
        setIsExerciseMode(false);
        setCurrentExercise(null);
        setShowExerciseModal(false);
        setExerciseAnswer("");
        setExerciseAttempts(0);
        setShowSolutionButton(false);
        
        // Hide animation after 3 seconds
        setTimeout(() => setPointsAnimation(null), 3000);
        
        // Show success message in chat without triggering TTS
        appendMessage("assistant", `✅ ${result.feedback}`);
      } else {
        // Incorrect answer - show in modal
        setExerciseAttempts(result.failedAttempts || 1);
        if (result.showSolution) {
          setShowSolutionButton(true);
        }
        // Don't close modal, show feedback within modal
      }
    } catch (error) {
      console.error('Error submitting exercise answer:', error);
    }
  };

  const showSolution = async () => {
    if (!currentExercise) return;

    try {
      const response = await fetch(`/api/exercises/${currentExercise.id}/solution`);
      const result = await response.json();
      
      // Show solution in modal, then close modal and add to chat
      setIsExerciseMode(false);
      setCurrentExercise(null);
      setShowSolutionButton(false);
      setShowExerciseModal(false);
      setExerciseAnswer("");
      
      const solutionMessage = `💡 **פתרון לתרגול**\n\n\`\`\`sql\n${result.solution}\n\`\`\`\n\nתוכל לנסות תרגול חדש!`;
      appendMessage("assistant", solutionMessage);
    } catch (error) {
      console.error('Error getting solution:', error);
    }
  };

  // Load user points on component mount
  useEffect(() => {
    const loadUserPoints = async () => {
      try {
        const storedUser = getStoredUser();
        if (storedUser?.email) {
          const response = await fetch(`/api/user-points?email=${encodeURIComponent(storedUser.email)}`);
          const userPointsData = await response.json();
          setUserPoints(userPointsData.points || 0);
        }
      } catch (error) {
        console.error('Error loading user points:', error);
      }
    };

    loadUserPoints();
  }, [getStoredUser]);

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarVisible(prev => !prev);
  };

  // Debounced speech function - only speaks after text has stopped changing
  // Speech is now handled by the avatar component, no need for separate debounced speech

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);
  const scheduleScrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (!autoScrollRef.current) return;
      if (scrollTimeoutRef.current) return;
      scrollTimeoutRef.current = setTimeout(() => {
        scrollTimeoutRef.current = null;
        scrollToBottom(behavior);
      }, 120);
    },
    [scrollToBottom]
  );
  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 120;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    autoScrollRef.current = distanceFromBottom < threshold;
  }, []);
  useEffect(() => {
    scheduleScrollToBottom("smooth");
  }, [messages, scheduleScrollToBottom]);
  useEffect(() => () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  }, []);

  const addReasoningLog = useCallback((log: string) => {
    const trimmed = log.trim();
    if (!trimmed) return;
    setReasoningLogs((prev) => {
      const lastLog = prev[prev.length - 1];
      if (lastLog === trimmed) return prev;
      return [...prev, trimmed];
    });
  }, []);

  const appendReasoningDelta = useCallback((delta: string) => {
    if (!delta) return;
    reasoningDraftRef.current += delta;
    setReasoningDraft(reasoningDraftRef.current);
  }, []);

  const flushReasoningDraft = useCallback(() => {
    const trimmed = reasoningDraftRef.current.trim();
    if (trimmed) {
      addReasoningLog(trimmed);
    }
    reasoningDraftRef.current = "";
    setReasoningDraft("");
  }, [addReasoningLog]);

  const triggerConversationAnalysis = useCallback(async (sessionId) => {
    try {
      const storedUser = getStoredUser();
      const userId = storedUser?.email;
      if (!userId || !sessionId) return;

      // Check if analysis already exists for this session
      const checkResponse = await fetch(`/api/conversation-summary/student/${userId}?limit=50`);
      const checkData = await checkResponse.json();
      
      if (checkData.success) {
        const existingAnalysis = checkData.data.summaries.find(summary => summary.sessionId === sessionId);
        if (existingAnalysis) {
          console.log('Conversation analysis already exists for session:', sessionId);
          return;
        }
      }

      // Trigger analysis
      const response = await fetch(`/api/chat/sessions/${sessionId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          sessionTitle: 'Chat Session'
        }),
      });

      if (response.ok) {
        console.log('✅ Conversation analysis triggered for session:', sessionId);
      } else {
        console.error('❌ Failed to trigger conversation analysis:', response.statusText);
      }
    } catch (error) {
      console.error('Error triggering conversation analysis:', error);
    }
  }, [getStoredUser]);


  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setCurrentUser(storedUser.name ?? storedUser.email ?? null);
    } else {
      setCurrentUser(null);
    }
    setCurrentBalance(Number(localStorage.getItem("currentBalance")) || 0);

    fetch(`/api/users/coins?status=1`).then(response => response.json())
    .then(data => setIsTokenBalanceVisible(data["status"] === "ON"))

  }, [getStoredUser]);

  // Add this useEffect to load chat sessions when the component mounts
useEffect(() => {
  const loadChatSessions = () => {
    const storedUser = getStoredUser();
    if (!storedUser?.email) return;
    fetch(`/api/chat/sessions?userId=${encodeURIComponent(storedUser.email)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(response => response.json()).then(sessions => {
      setChatSessions(sessions);
    })    
  };

  loadChatSessions();
}, [getStoredUser]);

  // Function to refresh chat sessions from server
  const refreshChatSessions = () => {
    const storedUser = getStoredUser();
    if (!storedUser?.email) return;
    fetch(`/api/chat/sessions?userId=${encodeURIComponent(storedUser.email)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(response => response.json()).then(sessions => {
      setChatSessions(sessions);
    })    
  };

  // Handle window resize for responsive sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      // Auto-close sidebar on mobile, auto-open on desktop
      setSidebarVisible(!isMobile);
    };

    // Set initial state based on current window size
    handleResize();

    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

const updateUserBalance = async (value) => {
  if (!user?.email) return;
  await fetch(UPDATE_BALANCE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      currentBalance: value
    })
  });
  }

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
      return;
    }
    if (embeddedMode) {
      setUser({ email: "homework-student", name: "Student" });
      return;
    }
    setUser(null);
  }, [embeddedMode, getStoredUser]);

  const createSession = useCallback(async (forceNew = false) => {
    if (!forceNew) {
      if (sessionIdRef.current) {
        return sessionIdRef.current;
      }
      if (createSessionPromiseRef.current) {
        return createSessionPromiseRef.current;
      }
    }

    const promise = (async () => {
      const res = await fetch(`/api/responses/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create responses session");
      }

      const nextSessionId = data.sessionId || "";
      sessionIdRef.current = nextSessionId;
      setSessionId(nextSessionId);
      setPreviousResponseId(data.responseId || "");
      return nextSessionId;
    })().finally(() => {
      createSessionPromiseRef.current = null;
    });

    createSessionPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    createSession().catch((error) => {
      console.error("Failed to create responses session:", error);
      setStreamError("לא הצלחנו לפתוח סשן צ'אט חדש. נסו לרענן את הדף.");
    });
  }, [createSession]);

  // Cleanup speech and typing detection on unmount
  useEffect(() => {
    return () => {
      // AVATAR DISABLED: enhancedTTS.stop();
      
      if (userTypingTimeoutRef.current) {
        clearTimeout(userTypingTimeoutRef.current);
      }

      // Trigger conversation analysis for current session when component unmounts
      if (currentChatId) {
        triggerConversationAnalysis(currentChatId);
      }
    };
  }, [currentChatId, triggerConversationAnalysis]);

  // Modified useEffect for progressive speech
  useEffect(() => {
    const messageId = currentAssistantMessageId || (lastAssistantMessage ? lastAssistantMessage.substring(0,50) : "");
    
    console.log('👀 Watching lastAssistantMessage change:', {
      isDone,
      autoPlaySpeech,
      lastAssistantMessageLength: lastAssistantMessage?.length || 0,
      lastAssistantMessage: lastAssistantMessage?.substring(0, 50) + '...',
      shouldSpeak,
      hasStartedSpeaking,
      streamingTextLength: streamingText?.length || 0,
      isManualSpeech
    });

    // Handle manual speech playback (when clicking play button)
    if (isManualSpeech && shouldSpeak && lastAssistantMessage) {
      console.log('🎤 MANUAL: Triggering manual speech playback');
      return; // Let the avatar component handle the speech
    }

    // Progressive speech: Start speaking earlier and also on completion
    const canStartByLength = lastAssistantMessage && lastAssistantMessage.length > 10;
    const canStartOnDone = isDone && lastAssistantMessage && lastAssistantMessage.length > 0;
    if (autoPlaySpeech && (canStartByLength || canStartOnDone) && !hasStartedSpeaking && lastSpokenMessageId !== messageId) {
      console.log('🎤 PROGRESSIVE: Starting speech early with partial text');
      setLastSpokenMessageId(messageId);
      setHasStartedSpeaking(true);
      setShouldSpeak(true);
      setIsAssistantMessageComplete(true);
    }
    
    // Handle completion of streaming
    if (isDone && hasStartedSpeaking) {
      console.log('✅ PROGRESSIVE: Message streaming completed, speech already in progress');
      // We don't need to trigger new speech since it's already started
    }
    
    // Reset for new messages
    if (!lastAssistantMessage || lastAssistantMessage.length === 0) {
      console.log('🔄 PROGRESSIVE: Resetting speech state for new message');
      setHasStartedSpeaking(false);
      setShouldSpeak(false);
    }

  }, [
    currentAssistantMessageId,
    lastAssistantMessage,
    isDone,
    autoPlaySpeech,
    shouldSpeak,
    lastSpokenMessageId,
    hasStartedSpeaking,
    isManualSpeech,
    streamingText?.length
  ]);

  // Avatar interaction handlers
  const handleAvatarInteraction = useCallback((gesture: string, context: any) => {
    console.log('🎭 Avatar interaction:', { gesture, context });
    
    // Track analytics
    // AVATAR DISABLED: if (enableAnalytics && currentUser) {
    //   avatarAnalytics.trackGesture(gesture, context.type, currentUser);
    // }
  }, []);

  const handleInteractionAnalytics = useCallback((analytics: any) => {
    if (enableAnalytics) {
      console.log('📊 Avatar Interaction Analytics:', analytics);
    }
  }, [enableAnalytics]);

  const classifyStreamFailure = (message?: string): StreamFailureKind => {
    const normalized = (message || "").toLowerCase();
    if (normalized.includes("timeout") || normalized.includes("timed out")) {
      return "tool_timeout";
    }
    if (normalized.includes("invalid") && normalized.includes("arg")) {
      return "invalid_function_args";
    }
    return "generic";
  };

  const renderStreamFailureMessage = (kind: StreamFailureKind) => {
    if (kind === "tool_timeout") {
      return "המערכת חרגה מזמן ההמתנה בזמן הפעלת כלי. נסו שוב או נסחו שאלה קצרה יותר.";
    }
    if (kind === "invalid_function_args") {
      return "התרחשה שגיאה בפרמטרים של כלי פנימי. נסו לנסח מחדש את הבקשה.";
    }
    if (kind === "stream_interruption") {
      return "החיבור לזרם התשובה נותק באמצע. נסו לשלוח שוב.";
    }
    return "אירעה שגיאה בעת יצירת התשובה. נסו שוב בעוד רגע.";
  };

  const ensureResponseSession = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current;
    return createSession();
  }, [createSession]);

  const consumeResponseStream = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawCompleted = false;
    let sawDelta = false;
    let createdAssistantMessage = false;
    let tutorMode = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        let event: ResponseStreamEvent | null = null;
        try {
          event = JSON.parse(line) as ResponseStreamEvent;
        } catch {
          continue;
        }

        if (event.type === "response.created") {
          if (event.responseId) setPreviousResponseId(event.responseId);
          continue;
        }

        if (event.type === "response.tutor.mode") {
          tutorMode = event.enabled;
          if (event.enabled) {
            setReasoningLogsEnabledForResponse(true);
            addReasoningLog("מכין תשובה לימודית מסודרת...");
          }
          continue;
        }

        if (event.type === "response.reasoning_summary_text.delta") {
          setReasoningLogsEnabledForResponse(true);
          appendReasoningDelta(event.delta);
          continue;
        }

        if (event.type === "response.reasoning_summary_text.done") {
          setReasoningLogsEnabledForResponse(true);
          flushReasoningDraft();
          continue;
        }

        if (event.type === "response.tool_call.started") {
          flushReasoningDraft();
          addReasoningLog(`מריץ כלי: ${event.name}`);
          continue;
        }

        if (event.type === "response.tool_call.completed") {
          addReasoningLog(`הכלי ${event.name} הסתיים.`);
          continue;
        }

        if (event.type === "response.output_text.delta") {
          if (!createdAssistantMessage) {
            handleTextCreated();
            createdAssistantMessage = true;
            setIsReasoningCollapsed(true);
          }
          sawDelta = true;
          if (tutorMode) {
            tutorRawResponseRef.current += event.delta;
            setLastAssistantMessageText(buildTutorPreviewFromRaw(tutorRawResponseRef.current));
            continue;
          }
          handleTextDelta({ value: event.delta });
          continue;
        }

        if (event.type === "response.completed") {
          sawCompleted = true;
          if (event.responseId) setPreviousResponseId(event.responseId);
          if (!createdAssistantMessage) {
            handleTextCreated();
            createdAssistantMessage = true;
          }
          flushReasoningDraft();
          if (event.tutorResponse) {
            await setLastMessageTutorResponse(event.tutorResponse, true);
            continue;
          }
          if (!sawDelta && event.outputText) {
            await appendToLastMessageProgressively(event.outputText);
          }
          continue;
        }

        if (event.type === "response.error") {
          flushReasoningDraft();
          const failureKind = classifyStreamFailure(event.message);
          const failureText = renderStreamFailureMessage(failureKind);
          setStreamError(failureText);
          appendMessage("assistant", failureText);
          endStreamResponse();
          return;
        }
      }
    }

    if (!sawCompleted) {
      flushReasoningDraft();
      const failureText = renderStreamFailureMessage("stream_interruption");
      setStreamError(failureText);
      appendMessage("assistant", failureText);
    }

    endStreamResponse();
  };

  const sendMessage = async (text) => { 
    setImageProcessing(true);
    setIsReasoningCollapsed(false);
    setReasoningLogsEnabledForResponse(false);
    setReasoningLogs([]);
    reasoningDraftRef.current = "";
    tutorRawResponseRef.current = "";
    setReasoningDraft("");
    
    // Notify parent component about user message for avatar interaction
    if (onUserMessage) {
      onUserMessage(text);
    }
    
    // Handle avatar interaction for user message
    if (enableAvatarInteractions && text.trim()) {
      if (enableSQLGestureMapping) {
        const analysis = analyzeMessage(text);
        const { recommendedGesture, confidence, sqlAnalysis } = analysis;

        console.log('🔍 Message Analysis:', {
          message: text.substring(0, 50) + '...',
          recommendedGesture,
          confidence,
          sqlKeywords: sqlAnalysis.keywords,
          complexity: sqlAnalysis.complexity,
        });

        // Track analytics
        // AVATAR DISABLED: if (enableAnalytics && currentUser) {
        //   avatarAnalytics.trackSQLQuery(
        //     sqlAnalysis.keywords,
        //     text,
        //     currentUser
        //   );
        // }

        // Trigger gesture if confidence is high enough
        if (confidence > 0.6 && avatarRef.current) {
          avatarRef.current.playGesture(recommendedGesture, 2, false, 1000);
          
          console.log(`🎭 Playing gesture: ${recommendedGesture} (confidence: ${confidence.toFixed(2)})`);
        }
      }
    }
    
    const thinkingIntentPattern =
      /\b(think|thinking|reason|reasoning|analyze|analysis|step by step)\b|חשיבה|תחשוב|לחשוב|תהליך חשיבה/iu;
    const hasThinkingIntent = thinkingIntentPattern.test(text);

    // Message text is used as-is (SQL queries are now added directly by SqlQueryBuilder)
    let messageWithTags = text;

    if (formattedHomeworkContext) {
      messageWithTags = `${formattedHomeworkContext}\n\nשאלת הסטודנט: ${text}\n\nהנחיות חשובות:\n- אל תספק תשובה ישירה או קוד SQL מוכן\n- תן רמזים והנחיות שיעזרו לסטודנט למצוא את הפתרון בעצמו\n- שאל שאלות מנחות במקום לתת תשובות\n- עודד חשיבה עצמאית ולמידה\n- הסתמך על ההקשר לעיל וענה בעברית, עם דגשים על SQL כאשר רלוונטי.`;
    }

    // Process image if one is selected
    let imageData = null;
    if (selectedImage) {
      try {
        imageData = await fileToBase64(selectedImage);
      } catch (error) {
        console.error("Error converting image to base64:", error);
        setImageProcessing(false);
        return;
      }
    }

    // if (currentBalance - estimatedCost < 0) {
    //   setBalanceError(true)
    //   setUserInput("")
    //   setTimeout(() => {  // Set timeout to clear error after 3 seconds
    //     setBalanceError(false);
    //   }, 3000);
    // } else {
      updateUserBalance(currentBalance - estimatedCost)
      setCurrentBalance(currentBalance - estimatedCost)
      const storedUser = getStoredUser();
      const userEmail = storedUser?.email;
      let today = new Date().toISOString().slice(0, 10);
    if (!currentChatId) {
      // Trigger conversation analysis for the previous session if it exists
      const previousSessionId = localStorage.getItem('previousSessionId');
      if (previousSessionId) {
        triggerConversationAnalysis(previousSessionId);
      }
      
      if (userEmail) {
        fetch(`/api/chat/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ "title": text.substring(0, 30) + " (" + today + ")", "user": userEmail }),
        }).then(response => response.json()).then(newChat => {
          setCurrentChatId(newChat._id);
          localStorage.setItem('previousSessionId', newChat._id);
          refreshChatSessions(); // Refresh the chat sessions list from server
          // Save the message to the server (save original text without tags)
          fetch(`/api/chat/sessions/${newChat._id}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chatId: newChat._id,
              userId: userEmail,
              message: text, // Save original text without tags
              role: 'user'
            }),
          });
        })
      }
    }

    else {
      if (userEmail) {
        fetch(`/api/chat/sessions/${currentChatId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId: currentChatId,
            userId: userEmail,
            message: text, // Save original text without tags
            role: 'user'
          }),
        });
      }
    }
    
    setStreamError(null);

    // saveToDatabase(text, "user");
    try {
      const activeSessionId = await ensureResponseSession();
      const response = await fetch(
        `/api/responses/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: activeSessionId,
            previousResponseId: previousResponseId || undefined,
            content: messageWithTags, // Send message with tags to AI
            imageData: imageData, // Send image data if available
            homeworkRunner: !!homeworkContext, // Allow all SQL (subqueries, CONCAT, ALL, TOP) in homework
            tutorMode: hasThinkingIntent,
            thinkingMode: hasThinkingIntent,
            stream: true,
          }),
        }
      );
      
      // Check if response is ok and has a body
      if (!response.ok) {
        console.error('❌ Failed to send message:', response.status, response.statusText);
        appendMessage("assistant", "מצטער, הייתה שגיאה בעיבוד ההודעה. נסה שוב.");
        setInputDisabled(false);
        setIsThinking(false);
        setImageProcessing(false);
        return;
      }
      
      if (!response.body) {
        console.error('❌ Response body is null');
        appendMessage("assistant", "מצטער, הייתה שגיאה בתקשורת. נסה לרענן את הדף.");
        setInputDisabled(false);
        setIsThinking(false);
        setImageProcessing(false);
        return;
      }

      await consumeResponseStream(response.body);
    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
      const failureText = renderStreamFailureMessage("stream_interruption");
      setStreamError(failureText);
      appendMessage("assistant", failureText);
      setInputDisabled(false);
      setIsThinking(false);
      setIsDone(true);
    }

    // Reset image after sending
    setSelectedImage(null);
    setImageProcessing(false);

  };

  const keepOneInstance = (arr, key) => {
    const seen = new Set();
    return arr.filter(obj => {
      if (seen.has(obj[key])) {
        return false; // Skip duplicates
      } else {
        seen.add(obj[key]);
        return true; // Keep the first instance
      }
    });
  };

  // Function to trigger conversation analysis
  // Add a function to load messages for a specific chat
const loadChatMessages = (chatId: string) => {
  setLoadingMessages(true); // Set loading to true before fetching
  // Reset speech state when loading existing chat
  setLastAssistantMessage("");
  setLastSpokenMessageId("");
  setShouldSpeak(false);
  setIsAssistantMessageComplete(false);
  
  fetch(`/api/chat/sessions/${chatId}/messages`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(response => response.json()).then(chatMessages => {
    const uniqueItems = keepOneInstance(chatMessages, "text");   
    setMessages(uniqueItems);
    setCurrentChatId(chatId);
    setLoadingMessages(false);
  })  
};

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim() && !selectedImage) return;
    
    // Clear typing state when user submits message
    if (userTypingTimeoutRef.current) {
      clearTimeout(userTypingTimeoutRef.current);
    }
    setIsUserTyping(false);
    console.log('📤 User submitted message, clearing typing state');
    
    // Display message with image info if present
    const displayText = selectedImage 
      ? `${userInput}${userInput ? '\n' : ''}[תמונה מצורפת: ${selectedImage.name}]`
      : userInput;
    
    // Check if we're in exercise mode (but exercises are now handled in modal)
    if (isExerciseMode && currentExercise) {
      // In exercise mode, regular chat is disabled
      return;
    }
    
    sendMessage(userInput);
    // Always show the user message in the UI, regardless of balance
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", text: displayText, hasImage: !!selectedImage },
    ]);
    setUserInput("");
    setInputDisabled(true);
    setIsThinking(true);
    autoScrollRef.current = true;
    scheduleScrollToBottom("smooth");
  };

  /* Stream Event Handlers */

  // textCreated - create new assistant message
  const handleTextCreated = () => {
    setIsDone(false);
    setIsThinking(false); // Stop thinking when assistant starts responding
    setHasStartedSpeaking(false); // Reset for new message
    streamingTextRef.current = "";
    tutorRawResponseRef.current = "";
    setStreamingText("");
    // Create a stable message id for this assistant message
    setCurrentAssistantMessageId(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
    // If voice is enabled and we are currently speaking, stop to avoid overlap with the new message
    // AVATAR DISABLED: if (enableVoice && enhancedTTS.isSpeaking()) {
    //   enhancedTTS.stop();
    // }
    
    // Clear any pending progressive speech
    if (progressiveSpeechTimeoutRef.current) {
      clearTimeout(progressiveSpeechTimeoutRef.current);
      progressiveSpeechTimeoutRef.current = null;
    }
    
    appendMessage("assistant", "");
  };

  // textDelta - append text to last assistant message
  const handleTextDelta = (delta) => {
    if (delta.value != null) {
      const text = delta.value;
      
      // Update streaming text for progressive speech
      streamingTextRef.current += text;
      setStreamingText(streamingTextRef.current);
      
      appendToLastMessage(text);
    }
    if (delta.annotations != null) {
      annotateLastMessage(delta.annotations);
    }
  };

  const appendToLastMessageProgressively = useCallback(
    async (text: string) => {
      if (!text) return;
      const step = text.length > 900 ? 8 : text.length > 450 ? 5 : 3;
      for (let i = 0; i < text.length; i += step) {
        const chunk = text.slice(i, i + step);
        setMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          if (!lastMessage) return prevMessages;
          const updatedLastMessage = {
            ...lastMessage,
            text: lastMessage.text + chunk,
          };
          if (lastMessage.role === 'assistant') {
            setLastAssistantMessage(updatedLastMessage.text);
          }
          return [...prevMessages.slice(0, -1), updatedLastMessage];
        });
        await new Promise((resolve) => setTimeout(resolve, 14));
      }
    },
    []
  );

   // New function to handle message changes
  const handleMessagesChange = useCallback(() => {
    if (!currentChatId) {
      return;
    }

    let msgs = messages.filter(msg => msg.role === "assistant")
    if (msgs.length > 0) {
        const storedUser = getStoredUser();
        if (!storedUser?.email) return;
        // Save the message to the server
        fetch(`/api/chat/sessions/${currentChatId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId: currentChatId,
            userId: storedUser.email,
            message: msgs[msgs.length - 1].text,
            role: 'assistant'
          }),
        }); 
    }
  }, [currentChatId, getStoredUser, messages]);

   // Use effect to watch for changes in messages
   useEffect(() => {
    handleMessagesChange();
  }, [isDone, handleMessagesChange]);


  const endStreamResponse = () => {
    setInputDisabled(false);
    setIsThinking(false);
    setIsDone(true);
    setReasoningLogsEnabledForResponse(false);
    setReasoningDraft("");
    reasoningDraftRef.current = "";
    tutorRawResponseRef.current = "";
    
    // Clear progressive speech timeout when stream ends
    if (progressiveSpeechTimeoutRef.current) {
      clearTimeout(progressiveSpeechTimeoutRef.current);
      progressiveSpeechTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser && !embeddedMode) {
      router.push('/login'); // Redirect to login if no user is found
    }
  }, [router, embeddedMode, getStoredUser]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    setUser(null);
    router.push('/');
  };

  if (!user) {
    return null; // Or you could return a loading indicator here
  }

  /*
    =======================
    === Utility Helpers ===
    =======================
  */

  const buildTutorResponseText = (tutorResponse: SqlTutorResponse) => {
    const mistakesText =
      tutorResponse.commonMistakes?.length > 0
        ? tutorResponse.commonMistakes.map((mistake) => `- ${mistake}`).join("\n")
        : "- —";
    return `**שאילתה**\n\`\`\`sql\n${tutorResponse.query}\n\`\`\`\n\n**הסבר**\n${tutorResponse.explanation}\n\n**טעויות נפוצות**\n${mistakesText}\n\n**אופטימיזציה**\n${tutorResponse.optimization}`;
  };

  const decodeJsonString = (value: string) => {
    try {
      return JSON.parse(`"${value}"`);
    } catch {
      return value.replace(/\\n/g, "\n").replace(/\\"/g, "\"");
    }
  };

  const extractPartialJsonStringField = (raw: string, field: string) => {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`"${escapedField}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`);
    const match = regex.exec(raw);
    return match?.[1] ? decodeJsonString(match[1]) : "";
  };

  const extractPartialMistakes = (raw: string) => {
    const arrayMatch = /"commonMistakes"\s*:\s*\[([\s\S]*?)(?:\]|$)/.exec(raw);
    if (!arrayMatch?.[1]) return [];
    const items: string[] = [];
    const itemRegex = /"((?:\\.|[^"\\])*)"/g;
    let match: RegExpExecArray | null = null;
    while ((match = itemRegex.exec(arrayMatch[1])) !== null) {
      items.push(decodeJsonString(match[1]));
    }
    return items;
  };

  const buildTutorPreviewFromRaw = (raw: string) => {
    const query = extractPartialJsonStringField(raw, "query");
    const explanation = extractPartialJsonStringField(raw, "explanation");
    const optimization = extractPartialJsonStringField(raw, "optimization");
    const commonMistakes = extractPartialMistakes(raw);

    const blocks: string[] = [];
    if (query) {
      blocks.push(`**שאילתה**\n\`\`\`sql\n${query}\n\`\`\``);
    }
    if (explanation) {
      blocks.push(`**הסבר**\n${explanation}`);
    }
    if (commonMistakes.length > 0) {
      blocks.push(`**טעויות נפוצות**\n${commonMistakes.map((mistake) => `- ${mistake}`).join("\n")}`);
    }
    if (optimization) {
      blocks.push(`**אופטימיזציה**\n${optimization}`);
    }

    return blocks.length > 0 ? blocks.join("\n\n") : "מנסח תשובה...";
  };

  const setLastAssistantMessageText = (text: string) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      if (!lastMessage) return prevMessages;
      const updatedLastMessage = {
        ...lastMessage,
        text,
      };
      if (lastMessage.role === "assistant") {
        setLastAssistantMessage(text);
      }
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
  };

  const appendToLastMessage = (text) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      const updatedLastMessage = {
        ...lastMessage,
        text: lastMessage.text + text,
      };
      
      // Update last assistant message for speech synthesis if it's an assistant message
      if (lastMessage.role === 'assistant') {
        setLastAssistantMessage(updatedLastMessage.text);
      }
      
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
  };

  const setLastMessageTutorResponse = async (
    tutorResponse: SqlTutorResponse,
    progressive = false
  ) => {
    const formattedText = buildTutorResponseText(tutorResponse);

    if (progressive) {
      setMessages((prevMessages) => {
        const lastMessage = prevMessages[prevMessages.length - 1];
        if (!lastMessage) {
          return prevMessages;
        }
        const updatedLastMessage = {
          ...lastMessage,
          text: "",
          tutorResponse,
        };

        if (lastMessage.role === "assistant") {
          setLastAssistantMessage("");
        }

        return [...prevMessages.slice(0, -1), updatedLastMessage];
      });

      await appendToLastMessageProgressively(formattedText);

      if (onAssistantResponse) {
        onAssistantResponse(formattedText);
      }
      return;
    }

    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      if (!lastMessage) {
        return prevMessages;
      }
      const updatedLastMessage = {
        ...lastMessage,
        text: formattedText,
        tutorResponse,
      };

      if (lastMessage.role === "assistant") {
        setLastAssistantMessage(formattedText);
        if (onAssistantResponse) {
          onAssistantResponse(formattedText);
        }
      }

      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
  };

  const appendMessage = (role, text, options: Partial<ChatMessage> = {}) => {
    setMessages((prevMessages) => [...prevMessages, { role, text, ...options }]);
    
    // Track last assistant message for speech synthesis
    if (role === 'assistant') {
      setLastAssistantMessage(text);
      
      // Notify parent component about assistant response for avatar interaction
      if (onAssistantResponse) {
        onAssistantResponse(text);
      }
      
      // Handle avatar interaction for assistant response
      if (enableAvatarInteractions) {
        const lowerResponse = text.toLowerCase();
        let gesture = 'ok';
        let priority: 'low' | 'normal' | 'high' = 'normal';

        if (lowerResponse.includes('error') || lowerResponse.includes('failed') || lowerResponse.includes('incorrect')) {
          gesture = 'thumbdown';
          priority = 'high';
        } else if (lowerResponse.includes('correct') || lowerResponse.includes('good') || lowerResponse.includes('success')) {
          gesture = 'thumbup';
          priority = 'high';
        } else if (lowerResponse.includes('explain') || lowerResponse.includes('help')) {
          gesture = 'handup';
          priority = 'normal';
        } else if (lowerResponse.includes('think') || lowerResponse.includes('consider')) {
          gesture = 'thinking';
          priority = 'normal';
        }

        // Trigger gesture if avatar is available
        if (avatarRef.current && gesture !== 'ok') {
          avatarRef.current.playGesture(gesture, 2, false, 1000);
          console.log(`🎭 Assistant response gesture: ${gesture}`);
        }

        // Track analytics
        // AVATAR DISABLED: if (enableAnalytics && currentUser) {
        //   avatarAnalytics.trackGesture(gesture, 'assistant_response', currentUser);
        // }
      }
    }
  };

  const annotateLastMessage = (annotations) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      const updatedLastMessage = {
        ...lastMessage,
      };
      annotations.forEach((annotation) => {
        if (annotation.type === 'file_path') {
          updatedLastMessage.text = updatedLastMessage.text.replaceAll(
            annotation.text,
            `/api/files/${annotation.file_path.file_id}`
          );
        }
      })
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
    
  }

  const handleFeedback = (isLike, index) => {
    const message = messages[index];
    message.feedback = isLike;

    const storedUser = getStoredUser();
    if (!storedUser?.email) return;

    fetch(`/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "chatId": currentChatId,
        "userId": storedUser.email,
        "message": message.text,
        "feedback": message.feedback
      }),
    }); 
  }

  const openNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setStreamError(null);
    setLastAssistantMessage("");
    setLastSpokenMessageId(""); // Reset spoken message tracking
    setShouldSpeak(false);
    setIsAssistantMessageComplete(false);
    setHasStartedSpeaking(false); // Reset progressive speech state
    setStreamingText("");
    streamingTextRef.current = "";
    setReasoningLogsEnabledForResponse(false);
    setReasoningLogs([]);
    setReasoningDraft("");
    reasoningDraftRef.current = "";
    autoScrollRef.current = true;
    setIsReasoningCollapsed(false);
    
    // Clear any pending progressive speech
    if (progressiveSpeechTimeoutRef.current) {
      clearTimeout(progressiveSpeechTimeoutRef.current);
      progressiveSpeechTimeoutRef.current = null;
    }

    sessionIdRef.current = "";
    setSessionId("");
    setPreviousResponseId("");
    createSession(true).catch((error) => {
      console.error("Failed to refresh responses session:", error);
      setStreamError("לא הצלחנו לפתוח סשן חדש. נסו שוב.");
    });
  }

// Embedded mode styles for homework runner sidebar
const embeddedStyles = embeddedMode ? {
  main: { 
    width: '100%', 
    height: '100%', 
    flex: '1 1 0', 
    minHeight: 0, 
    margin: 0, 
    padding: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  container: { 
    width: '100%', 
    flex: '1 1 0', 
    minHeight: 0, 
    height: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  chatContainer: { 
    flex: '1 1 0', 
    minHeight: 0, 
    height: 0,
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    borderRadius: 0,
  },
  messages: { 
    direction: 'rtl' as const,
    flex: '1 1 0', 
    minHeight: 0, 
    height: 0,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
  },
} : {
  main: {},
  container: {},
  chatContainer: {},
  messages: { direction: 'rtl' as const },
};

const shouldShowReasoningPanel =
  reasoningLogsEnabledForResponse && (reasoningLogs.length > 0 || reasoningDraft.length > 0);
const hasStreamingAssistantMessage =
  inputDisabled && messages.length > 0 && messages[messages.length - 1]?.role === "assistant";

const reasoningPanel = shouldShowReasoningPanel ? (
  <div className={styles.reasoningPanel}>
    <button
      type="button"
      className={styles.reasoningToggle}
      onClick={() => setIsReasoningCollapsed((prev) => !prev)}
      aria-expanded={!isReasoningCollapsed}
    >
      <span className={styles.reasoningTitle}>יומן חשיבה</span>
      <ChevronDown
        size={14}
        className={`${styles.reasoningChevron} ${isReasoningCollapsed ? styles.reasoningChevronCollapsed : ""}`}
      />
    </button>
    {!isReasoningCollapsed && (
      <ul className={styles.reasoningList}>
        {reasoningLogs.map((log, index) => (
          <li key={`${log}-${index}`} className={styles.reasoningItem}>
            {log}
          </li>
        ))}
        {reasoningDraft && (
          <li className={`${styles.reasoningItem} ${styles.reasoningItemStreaming}`}>
            {reasoningDraft}
          </li>
        )}
      </ul>
    )}
  </div>
) : null;

return (
  <div 
    className={`${styles.main} ${!sidebarVisible || hideSidebar || minimalMode ? styles.mainFullWidth : ''}`}
    style={embeddedStyles.main}
  >
    {sidebarVisible && !hideSidebar && !minimalMode && (
      <Sidebar 
        chatSessions={chatSessions} 
        onChatSelect={loadChatMessages} 
        handleLogout={handleLogout} 
        onNewChat={openNewChat} 
        currentUser={currentUser}
        onToggleSidebar={toggleSidebar}
      />
    )}
         <div 
           className={`${styles.container} ${!sidebarVisible || hideSidebar || minimalMode ? styles.containerFullWidth : ''}`}
           style={embeddedStyles.container}
         >
      {!sidebarVisible && !hideSidebar && !minimalMode && (
        <button
          className={styles.openSidebarButton}
          onClick={toggleSidebar}
          title="פתח צד"
          aria-label="Open Sidebar"
        >
          ☰
        </button>
      )}
      <div className={styles.chatContainer} style={embeddedStyles.chatContainer}>
        <div
          className={styles.messages}
          style={embeddedStyles.messages}
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
        >
          {loadingMessages ? (
            <div className={styles.loadingIndicator}></div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <React.Fragment key={index}>
                  {inputDisabled &&
                    shouldShowReasoningPanel &&
                    index === messages.length - 1 &&
                    msg.role === "assistant" &&
                    reasoningPanel}
                  <Message
                    role={msg.role}
                    text={msg.text}
                    feedback={msg.feedback}
                    hasImage={msg.hasImage}
                    tutorResponse={msg.tutorResponse}
                    onFeedback={msg.role === 'assistant' ? (isLike) => handleFeedback(isLike, index) : undefined}
                    autoPlaySpeech={msg.role === 'assistant' ? (enableVoice && autoPlaySpeech) : undefined}
                    onPlayMessage={msg.role === 'assistant' ? () => {
                      console.log('🎤 Playing individual message:', {
                        messageText: msg.text.substring(0, 50) + '...',
                        enableVoice,
                        avatarMode,
                        currentAvatarState: avatarState,
                        lastAssistantMessage: lastAssistantMessage?.substring(0, 30) + '...'
                      });
                      if (!enableVoice) {
                        console.log('❌ Voice is not enabled');
                        return;
                      }
                      // Stop any current speech
                      // AVATAR DISABLED: enhancedTTS.stop();
                      // Reset speech states first
                      setShouldSpeak(false);
                      setIsAssistantMessageComplete(false);
                      setHasStartedSpeaking(false);
                      
                      // Use setTimeout to ensure state changes are processed
                      setTimeout(() => {
                        // Set the text to the avatar for speaking
                        setLastAssistantMessage(msg.text);
                        // Set a new manual id and mark as spoken to avoid auto trigger
                        const manualId = `manual-${Date.now()}`;
                        setCurrentAssistantMessageId(manualId);
                        setLastSpokenMessageId(manualId);
                        setShouldSpeak(true);
                        setIsAssistantMessageComplete(true);
                        setHasStartedSpeaking(true);
                        setIsManualSpeech(true);  // Mark as manual speech
                        // Clear thinking state
                        setIsThinking(false);
                        console.log('🎤 Set speech state for avatar:', {
                          shouldSpeak: true,
                          isAssistantMessageComplete: true,
                          text: msg.text.substring(0, 50) + '...'
                        });
                      }, 100);
                    } : undefined}
                  />
                </React.Fragment>
              ))}
              {inputDisabled && (
                <div className={styles.assistantMessage}>
                  {!hasStreamingAssistantMessage && reasoningPanel}
                  <div className={styles.typingIndicator}>
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form
          onSubmit={handleSubmit}
          style={{direction:"rtl"}}
          className={`${styles.inputForm} ${styles.clearfix}`}
        >
          <div className={`${styles.inputContainer} ${isExerciseMode ? styles.exerciseMode : ''}`}>
            {/* Added for query cost estimation: Shows estimated cost while typing */}
            {userInput && isTokenBalanceVisible && (
              <div className={styles.costPopup}>
                עלות השאילתה: ₪{estimatedCost.toFixed(2)}
              </div>
            )}
            {streamError && (
              <div className={styles.streamErrorBanner}>
                {streamError}
              </div>
            )}
            

            <textarea
              className={styles.input}
              value={userInput}
              onChange={(e) => {
                if (streamError) setStreamError(null);
                setUserInput(e.target.value);
                setEstimatedCost(calculateCost(e.target.value));
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
                
                // Detect user typing for avatar state
                handleUserTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.shiftKey) {
                  // Allow default behavior for Shift+Enter (line break)
                  return;
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                isExerciseMode 
                  ? "הקלד את תשובת ה-SQL שלך כאן..." 
                  : "הקלד כאן..."
              }
              style={{
                paddingTop: '16px',
                paddingRight: '20px',
                paddingBottom: '16px',
                paddingLeft: '50px'
              }}
            />
            
            {/* Send Button */}
            <button
              type="submit"
              className={styles.sendButton}
              disabled={inputDisabled || imageProcessing || (!userInput.trim() && !selectedImage)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18V6M9 12l6-6 6 6" transform="rotate(90 12 12)" />
              </svg>
            </button>

            {/* Action Buttons Row */}
            {!minimalMode && (
            <div className={styles.actionButtons} ref={actionMenuRef}>
              {/* Audio Recorder - hidden for clean version */}
              {/* {enableVoice && (
                <AudioRecorder
                  onTranscription={handleAudioTranscription}
                  disabled={inputDisabled || imageProcessing}
                  onRecordingStateChange={setIsRecording}
                />
              )} */}

              <button
                type="button"
                className={`${styles.actionButton} ${styles.actionMenuButton} ${isActionMenuOpen ? styles.actionButtonActive : ''}`}
                onClick={() => setIsActionMenuOpen((prev) => !prev)}
                disabled={inputDisabled || imageProcessing}
                title="פתח אפשרויות"
                aria-haspopup="true"
                aria-expanded={isActionMenuOpen}
              >
                <Plus className={styles.actionMenuIcon} size={16} strokeWidth={2.2} />
                {selectedImage && <span className={styles.attachmentDot}></span>}
              </button>

              {isActionMenuOpen && (
                <div className={styles.actionMenu} role="menu">
                  <button
                    type="button"
                    className={styles.actionMenuItem}
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      startExercise();
                    }}
                    disabled={inputDisabled}
                    title="קבל תרגול SQL חדש"
                    role="menuitem"
                  >
                    <Sparkles className={styles.actionMenuItemIcon} size={16} strokeWidth={2} />
                    <span className={styles.actionMenuItemText}>תרגול SQL</span>
                  </button>

                  <button
                    type="button"
                    className={styles.actionMenuItem}
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      document.getElementById('imageInput')?.click();
                    }}
                    disabled={inputDisabled || imageProcessing}
                    title="Attach image"
                    role="menuitem"
                  >
                    <ImagePlus className={styles.actionMenuItemIcon} size={16} strokeWidth={2} />
                    <span className={styles.actionMenuItemText}>הוספת תמונה</span>
                  </button>

                  <button
                    type="button"
                    className={styles.actionMenuItem}
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      setSqlBuilderOpen(true);
                    }}
                    title="בנה שאילתת SQL"
                    role="menuitem"
                  >
                    <Braces className={styles.actionMenuItemIcon} size={16} strokeWidth={2} />
                    <span className={styles.actionMenuItemText}>בונה SQL</span>
                  </button>

                  <button
                    type="button"
                    className={styles.actionMenuItem}
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      router.push('/visualizer');
                    }}
                    title="המחשת שאילתה"
                    role="menuitem"
                  >
                    <BarChart3 className={styles.actionMenuItemIcon} size={16} strokeWidth={2} />
                    <span className={styles.actionMenuItemText}>המחשת שאילתה</span>
                  </button>
                </div>
              )}
            </div>
            )}



            {/* Hidden file input */}
            <input
              id="imageInput"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedImage(file);
              }}
              style={{ display: 'none' }}
              disabled={inputDisabled || imageProcessing}
            />

            {/* Image Preview */}
            {selectedImage && (
              <div className={styles.imagePreview}>
                <img 
                  src={URL.createObjectURL(selectedImage)} 
                  alt="Preview" 
                  className={styles.previewImage}
                />
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className={styles.removeImageButton}
                  disabled={inputDisabled || imageProcessing}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
      {/* <button
                type="button"
                className={styles.toggleButton}
                onClick={toggleModal}
              >
                עורך שאילתות
              </button> */}
    </div>
    {/* {balanceError && (
  <div className={styles.balanceError}>
    No enough tokens
  </div>
)} */}
    
    {/* Right Column - Avatar Section */}
    {!hideAvatar && !minimalMode && (
      <div className={styles.rightColumn}>
        {!isHydrated ? (
          <div 
            className={styles.avatarHydrationPlaceholder}
            role="status"
            aria-label="טוען אווטאר"
            aria-live="polite"
          ></div>
        ) : (
          <div className={styles.avatarSection}>
            {displayMode === 'avatar' && enableAvatar ? (
              <>
                {avatarMode === 'avatar' ? (
                  <MichaelAvatarDirect
                    text={lastAssistantMessage}
                    state={avatarState}
                    size="medium"
                    progressiveMode={enableVoice && !isDone}
                    isStreaming={enableVoice && !isDone}
                    onSpeakingStart={() => {
                      console.log('🎤 Michael started speaking');
                      if (enableVoice) setShouldSpeak(true);
                    }}
                    onSpeakingEnd={() => {
                      console.log('🎤 Michael finished speaking');
                      if (enableVoice) setShouldSpeak(false);
                      setIsAssistantMessageComplete(false);
                      setHasStartedSpeaking(false);
                      setIsManualSpeech(false);
                    }}
                  />
                ) : (
                  <VoiceModeCircle
                    state={avatarState}
                    size="medium"
                    text={lastAssistantMessage}
                    onSpeakingStart={() => {
                      console.log('🎤 Voice circle started speaking');
                      if (enableVoice) setShouldSpeak(true);
                    }}
                    onSpeakingEnd={() => {
                      console.log('🎤 Voice circle finished speaking');
                      if (enableVoice) setShouldSpeak(false);
                      setIsAssistantMessageComplete(false);
                      setHasStartedSpeaking(false);
                      setIsManualSpeech(false);
                    }}
                  />
                )}
              </>
            ) : (
              <StaticLogoMode
                size="medium"
                state={avatarState}
                userName={currentUser}
              />
            )}
            
            {/* Toggle Buttons Container */}
            <div className={styles.toggleButtonsContainer}>
              {/* Display Mode Toggle Button */}
              <div className={styles.displayModeToggle}>
                <button 
                  className={`${styles.displayToggleButton} ${displayMode === 'logo' ? styles.logoModeActive : styles.avatarModeActive}`}
                  onClick={() => setDisplayMode(displayMode === 'avatar' ? 'logo' : 'avatar')}
                  title={displayMode === 'avatar' ? 'עבור למצב לוגו' : 'עבור למצב אווטאר'}
                  aria-label={displayMode === 'avatar' ? 'Switch to logo mode' : 'Switch to avatar mode'}
                >
                  {displayMode === 'avatar' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <path d="M21 15l-5-5L5 21"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            {/* User info below the avatar */}
            <div className={styles.userInfo}>
              <div className={styles.nickname}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span>היי {currentUser}</span>
                </div>
                {isTokenBalanceVisible && (
                  <div>
                    יתרה נוכחית: ₪{currentBalance}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )}

    {/* Exercise Modal */}
    <Modal isOpen={showExerciseModal} onClose={() => {
      setShowExerciseModal(false);
      setIsExerciseMode(false);
      setCurrentExercise(null);
      setExerciseAnswer("");
      setShowSolutionButton(false);
    }}>
      <div className={styles.exerciseModal}>
        <button
          className={styles.exerciseCloseButton}
          onClick={() => {
            setShowExerciseModal(false);
            setIsExerciseMode(false);
            setCurrentExercise(null);
            setExerciseAnswer("");
            setShowSolutionButton(false);
          }}
          title="סגור תרגול"
        >
          ×
        </button>
        <div className={styles.exerciseHeader}>
          <h2>🎓 תרגול SQL</h2>
          {userPoints > 0 && (
            <div className={styles.pointsIndicator}>
              {userPoints} נקודות
            </div>
          )}
        </div>
        
        {currentExercise && (
          <>
            <div className={styles.exerciseContent}>
              <div className={styles.exerciseDifficulty}>
                דרגת קושי: {currentExercise.difficulty === 'easy' ? 'קל' : currentExercise.difficulty === 'medium' ? 'בינוני' : 'קשה'} 
                ({currentExercise.points} נקודות)
              </div>
              
              <div className={styles.exerciseQuestion}>
                {currentExercise.question}
              </div>
              
              <div className={styles.exerciseSqlEditor}>
                <textarea
                  className={styles.exerciseTextarea}
                  value={exerciseAnswer}
                  onChange={(e) => setExerciseAnswer(e.target.value)}
                  placeholder="הקלד את שאילתת ה-SQL שלך כאן..."
                  rows={8}
                  style={{
                    fontFamily: 'Courier New, monospace',
                    fontSize: '14px',
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    padding: '10px',
                    background: 'transparent',
                    color: '#374151'
                  }}
                />
              </div>
              
              {/* SQL Helper Buttons */}
              <div className={styles.sqlHelperButtons}>
                <button
                  type="button"
                  className={styles.sqlHelperButton}
                  onClick={() => setExerciseAnswer(prev => prev + '\nSELECT * FROM ')}
                >
                  SELECT
                </button>
                <button
                  type="button"
                  className={styles.sqlHelperButton}
                  onClick={() => setExerciseAnswer(prev => prev + '\nWHERE ')}
                >
                  WHERE
                </button>
                <button
                  type="button"
                  className={styles.sqlHelperButton}
                  onClick={() => setExerciseAnswer(prev => prev + '\nGROUP BY ')}
                >
                  GROUP BY
                </button>
                <button
                  type="button"
                  className={styles.sqlHelperButton}
                  onClick={() => setExerciseAnswer(prev => prev + '\nORDER BY ')}
                >
                  ORDER BY
                </button>
                <button
                  type="button"
                  className={styles.sqlHelperButton}
                  onClick={() => setExerciseAnswer(prev => prev + '\nJOIN ')}
                >
                  JOIN
                </button>
              </div>
              
              <div className={styles.exerciseActions}>
                <button
                  className={styles.submitExerciseButton}
                  onClick={submitExerciseAnswer}
                  disabled={!exerciseAnswer.trim()}
                >
                  שלח תשובה
                </button>
                
                {showSolutionButton && (
                  <button
                    className={styles.showSolutionButton}
                    onClick={showSolution}
                  >
                    הצג פתרון
                  </button>
                )}
              </div>
              
              {exerciseAttempts > 0 && (
                <div className={styles.exerciseFeedback}>
                  כמעט! נסה לבדוק אם שכחת משהו בשאילתה.
                  {exerciseAttempts >= 2 && " אתה יכול לראות את הפתרון בכפתור למעלה."}
                </div>
              )}
            </div>
          </>
        )}
        {!currentExercise && (
          <div className={styles.exerciseContent} style={{ textAlign: 'center', padding: '24px', width: '100%' }}>
            בקרוב ...
          </div>
        )}
      </div>
    </Modal>

    <Modal isOpen={showModal} onClose={toggleModal}>
        <SQLQueryEditorComponent toggleModal={toggleModal} />
      </Modal>

    {/* Points Animation */}
    {pointsAnimation && (
      <div className={styles.pointsAnimation}>
        +{pointsAnimation} 🎉
      </div>
    )}

    {/* Disclaimer Modal */}
    {showDisclaimerModal && (
      <div className={styles.modalOverlay}>
        <div className={styles.disclaimerModal}>
          <div className={styles.disclaimerContent}>
            <div className={styles.disclaimerIcon}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 className={styles.disclaimerTitle}>שימו לב</h3>
            <p className={styles.disclaimerText}>
              מייקל יכול ליצור שאלות ותשובות שלא נכללות בחומר הנלמד
            </p>
            <div className={styles.disclaimerActions}>
              <button
                className={styles.disclaimerCancelButton}
                onClick={handleDisclaimerCancel}
              >
                ביטול
              </button>
              <button
                className={styles.disclaimerConfirmButton}
                onClick={handleDisclaimerConfirm}
              >
                אני מסכים, התחל תרגול
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Practice Modal */}
    <PracticeModal
      isOpen={showPracticeModal}
      onClose={() => setShowPracticeModal(false)}
      userId={user?.email || 'anonymous'}
    />

    {/* SQL Query Builder Modal */}
    <SqlQueryBuilder
      isOpen={sqlBuilderOpen}
      onClose={() => setSqlBuilderOpen(false)}
      onQueryGenerated={handleQueryGenerated}
    />
  </div>
);
};

export default Chat;
