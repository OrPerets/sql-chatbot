"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from "react";
import styles from "./chat.module.css";
import "./mobile-optimizations.css";
import Markdown from "react-markdown";
import { ThumbsUp, ThumbsDown, ClipboardCopy, Plus, Sparkles, ImagePlus, Braces, BarChart3, ChevronDown, BrainCircuit, ArrowUp } from 'lucide-react';
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
import { enhancedTTS, type TTSOptions } from "@/app/utils/enhanced-tts";
// import AvatarInteractionManager from "./AvatarInteractionManager";
import { analyzeMessage } from "../utils/sql-query-analyzer";
// import { avatarAnalytics } from "../utils/avatar-analytics";
import PracticeModal from "./PracticeModal";
import type {
  RelationalAlgebraTutorResponse,
  ResponseCitation,
  ResponseStreamEvent,
  ResponseTurnMetadata,
  SqlTutorResponse,
  TutorResponse,
  TutorSubjectMode,
} from "@/lib/openai/contracts";
import { isVoiceFeatureEnabled } from "@/lib/openai/voice-config";
import {
  buildGesturePlan,
  DEFAULT_AVATAR_RENDER_CONFIG,
  inferSpeechIntent,
  initialSpeechControllerState,
  speechControllerReducer,
  type AvatarMode,
  type GesturePlan,
  type SpeechIntent,
  type SpeechUtterance,
} from "../utils/avatar-speech-controller";

export const maxDuration = 50;

const isDev = process.env.NODE_ENV === "development";
const logDebug = (...args: unknown[]) => {
  if (isDev) {
    console.log(...args);
  }
};

// Replace external base with internal routes
const SAVE = "/api/chat/save"; // not used directly; message saving goes via chat sessions endpoint
const UPDATE_BALANCE = "/api/users/balance";

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
  feedback?: "like" | "dislike" | null;
  onFeedback?: (feedback: "like" | "dislike" | null) => void;
  hasImage?: boolean;
  tutorResponse?: TutorResponse | null;
  conversationVariant?: "default" | "professional";
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
  tutorResponse?: TutorResponse | null;
  structuredContent?: Record<string, unknown> | null;
  citations?: ResponseCitation[];
  metadata?: ResponseTurnMetadata | null;
};

// Add these types
type ChatSession = {
  _id: string;
  title: string;
  lastMessageTimestamp: number;
  openaiState?: {
    sessionId?: string | null;
    lastResponseId?: string | null;
    canonicalStateStrategy: "previous_response_id";
    store?: boolean;
    truncation?: string | null;
    promptCacheKey?: string | null;
    safetyIdentifier?: string | null;
    updatedAt: string | Date;
  };
};

type HomeworkChatContext = {
  homeworkSetId?: string;
  studentId?: string;
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

type CoinsConfigClientResponse = {
  status?: "ON" | "OFF";
  modules?: {
    mainChat?: boolean;
    homeworkHints?: boolean;
    sqlPractice?: boolean;
  };
  costs?: {
    mainChatMessage?: number;
    sqlPracticeOpen?: number;
    homeworkHintOpen?: number;
  };
};

type InsufficientCoinsClientBody = {
  error?: string;
  message?: string;
  balance?: number;
  required?: number;
};

const UserMessage = ({
  text,
  conversationVariant = "default",
}: {
  text: string;
  conversationVariant?: "default" | "professional";
}) => {
  return (
    <div className={`${styles.messageRow} ${styles.userMessageRow} ${conversationVariant === "professional" ? styles.messageRowProfessional : ""}`}>
      <div className={`${styles.userMessage} ${conversationVariant === "professional" ? styles.userMessageProfessional : ""}`}>{text}</div>
    </div>
  );
};

const isRelationalAlgebraTutorResponse = (
  value: TutorResponse | null | undefined
): value is RelationalAlgebraTutorResponse =>
  Boolean(
    value &&
      typeof value === "object" &&
      "steps" in value &&
      Array.isArray((value as RelationalAlgebraTutorResponse).steps)
  );

const AssistantMessage = ({
  text,
  feedback = null,
  onFeedback,
  tutorResponse,
  autoPlaySpeech,
  onPlayMessage,
  conversationVariant = "default",
}: {
  text: string;
  feedback: "like" | "dislike" | null;
  onFeedback?: (feedback: "like" | "dislike" | null) => void;
  tutorResponse?: TutorResponse | null;
  autoPlaySpeech?: boolean;
  onPlayMessage?: () => void;
  conversationVariant?: "default" | "professional";
}) => {
  const isProfessional = conversationVariant === "professional";
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
    logDebug('🔊 handlePlayMessage called', {
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

  const renderRelationalAlgebraTutorResponse = (response: RelationalAlgebraTutorResponse) => {
    const mistakes =
      response.commonMistakes?.length > 0
        ? response.commonMistakes.map((mistake) => `- ${mistake}`).join("\n")
        : "—";
    const examples =
      response.examples?.length > 0
        ? response.examples
            .map(
              (example) =>
                `**${example.concept}**\nSQL: \`${example.sqlExample}\`\nRA: \`${example.relationalAlgebraExample}\`\n${example.note}`
            )
            .join("\n\n")
        : "—";

    return (
      <div className={styles.tutorResponse}>
        {renderTutorSection("סיכום", response.summary || "—")}
        {renderTutorSection("ביטוי אלגברת יחסים", `\`\`\`\n${response.relationalAlgebraExpression}\n\`\`\``)}
        <div className={styles.tutorSection}>
          <h4 className={styles.tutorSectionTitle}>שלבים</h4>
          <div className={styles.raSteps}>
            {response.steps.map((step, index) => (
              <div key={`${step.operator}-${index}`} className={styles.raStepCard}>
                <div className={styles.raStepHeader}>
                  <span className={styles.raStepIndex}>{index + 1}</span>
                  <div>
                    <div className={styles.raStepTitle}>{step.title}</div>
                    <div className={styles.raStepMeta}>
                      <span className={styles.raStepSymbol}>{step.symbol}</span>
                      <span>{step.operator}</span>
                    </div>
                  </div>
                </div>
                <pre className={styles.raStepExpression}>{step.expression}</pre>
                <Markdown components={renderers}>{step.explanation}</Markdown>
                {step.sqlEquivalent ? (
                  <div className={styles.raStepSqlEquivalent}>SQL: {step.sqlEquivalent}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        {renderTutorSection("טעויות נפוצות", mistakes)}
        {renderTutorSection("דוגמאות רלוונטיות", examples)}
        {renderTutorSection("הערת תחום", response.scopeNote || "—")}
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
    ? isRelationalAlgebraTutorResponse(tutorResponse)
      ? `\`\`\`\n${tutorResponse.relationalAlgebraExpression}\n\`\`\``
      : `\`\`\`sql\n${tutorResponse.query}\n\`\`\``
    : text;

  return (
    <div className={`${styles.messageRow} ${styles.assistantMessageRow} ${isProfessional ? styles.messageRowProfessional : ""}`}>
      <div className={`${styles.assistantMessage} ${isProfessional ? styles.assistantMessageProfessional : ""}`}>
        <div className={styles.messageContent}>
          {tutorResponse ? (
            isRelationalAlgebraTutorResponse(tutorResponse) ? (
              renderRelationalAlgebraTutorResponse(tutorResponse)
            ) : (
              renderTutorResponse(tutorResponse)
            )
          ) : (
            <Markdown components={renderers}>{compactText}</Markdown>
          )}
        </div>
        <div className={styles.feedbackButtons}>
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
            onClick={() => copyQueryToClipboard(copyTextSource)}
            className={`${styles.feedbackButton} ${styles.copyButton}`}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <ClipboardCopy />
            {showTooltip && (
              <div className={styles.tooltip}>{copiedText}</div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
const CodeMessage = ({
  text,
  conversationVariant = "default",
}: {
  text: string;
  conversationVariant?: "default" | "professional";
}) => {
  const isProfessional = conversationVariant === "professional";

  return (
    <div className={`${styles.messageRow} ${styles.assistantMessageRow} ${isProfessional ? styles.messageRowProfessional : ""}`}>
      <div className={`${styles.codeMessage} ${isProfessional ? styles.codeMessageProfessional : ""}`}>
        {text.split("\n").map((line, index) => (
          <div key={index}>
            <span>{`${index + 1}. `}</span>
            {line}
          </div>
        ))}
      </div>
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
  conversationVariant = "default",
}: MessageProps & { autoPlaySpeech?: boolean; onPlayMessage?: () => void }) => {
  switch (role) {
    case "user":
      return <UserMessage text={text} conversationVariant={conversationVariant} />;
    case "assistant":
      return (
        <AssistantMessage
          text={text}
          feedback={feedback}
          onFeedback={onFeedback}
          tutorResponse={tutorResponse}
          autoPlaySpeech={autoPlaySpeech}
          onPlayMessage={onPlayMessage}
          conversationVariant={conversationVariant}
        />
      );
    case "code":
      return <CodeMessage text={text} conversationVariant={conversationVariant} />;
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
  enableRelationalAlgebraMode?: boolean;
  initialSubjectMode?: TutorSubjectMode;
  conversationVariant?: "default" | "professional";
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
  enableRelationalAlgebraMode = false,
  initialSubjectMode = "sql",
  conversationVariant = "default",
}: ChatProps) => {
  void functionCallHandler;
  const isProfessionalConversation = conversationVariant === "professional";
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [subjectMode, setSubjectMode] = useState<TutorSubjectMode>(initialSubjectMode);
  const [sessionId, setSessionId] = useState("");
  const [previousResponseId, setPreviousResponseId] = useState("");
  const sessionIdRef = useRef("");
  const createSessionPromiseRef = useRef<Promise<string> | null>(null);
  const currentChatIdRef = useRef<string | null>(initialChatId);
  const createChatPromiseRef = useRef<Promise<string | null> | null>(null);
  const [user, setUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(initialChatId);
  const [isDone, setIsDone] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Avatar interaction system - DISABLED
  const avatarRef = useRef(null);
  const [enableAvatarInteractions, setEnableAvatarInteractions] = useState(false); // DISABLED
  const [enableSQLGestureMapping, setEnableSQLGestureMapping] = useState(false); // DISABLED
  const [enableAnalytics, setEnableAnalytics] = useState(false); // DISABLED
  const [mainChatMessageCost, setMainChatMessageCost] = useState(1);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [balanceError, setBalanceError] = useState(false);
  const [balanceErrorMessage, setBalanceErrorMessage] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isTokenBalanceVisible, setIsTokenBalanceVisible] = useState(false);
  const [isSqlPracticeEnabled, setIsSqlPracticeEnabled] = useState(false);
  const [practiceOpenCost, setPracticeOpenCost] = useState(1);
  const [loadingMessages, setLoadingMessages] = useState(false); // Add loading state
  const [sqlTutorModalOpen, setSqlTutorModalOpen] = useState(false);
  const [sqlTutorOperation, setSqlTutorOperation] = useState<"create" | "insert">("create");
  const [sqlTutorTableName, setSqlTutorTableName] = useState("");
  const [sqlTutorColumns, setSqlTutorColumns] = useState("");
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string>("");
  const autoPlaySpeech = false;
  // Environment variables - these are available at build time
  const enableAvatar = process.env.NEXT_PUBLIC_AVATAR_ENABLED === '1' || process.env.NODE_ENV === 'development';
  const enableVoice = isVoiceFeatureEnabled();
  
  // Add avatar mode state with localStorage persistence
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('avatar3d');

  // Add hydration state to prevent layout shift
  const [isHydrated, setIsHydrated] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const [isThinkingModeEnabled, setIsThinkingModeEnabled] = useState(true);

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
      if (savedAvatarMode === 'voiceCircle' || savedAvatarMode === 'avatar3d' || savedAvatarMode === 'none') {
        setAvatarMode(savedAvatarMode);
      } else if (savedAvatarMode === 'voice') {
        setAvatarMode('voiceCircle');
      } else if (savedAvatarMode === 'avatar') {
        setAvatarMode('avatar3d');
      }

      const savedThinkingMode = localStorage.getItem('thinkingModeEnabled');
      if (savedThinkingMode === 'true' || savedThinkingMode === 'false') {
        setIsThinkingModeEnabled(savedThinkingMode === 'true');
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

  useEffect(() => {
    if (typeof window !== 'undefined' && isHydrated) {
      localStorage.setItem('thinkingModeEnabled', String(isThinkingModeEnabled));
    }
  }, [isHydrated, isThinkingModeEnabled]);

  useEffect(() => {
    if (isThinkingModeEnabled) {
      return;
    }
    setReasoningLogs([]);
    setReasoningDraft("");
    reasoningDraftRef.current = "";
    setIsReasoningCollapsed(false);
  }, [isThinkingModeEnabled]);

  // Add sidebar visibility state
  // Check if we're on mobile to default sidebar to closed
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    // Default to closed on mobile devices
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768; // Open on desktop (>=768px), closed on mobile (<768px)
    }
    return true; // Default to open during SSR
  });
  const [speechController, speechDispatch] = useReducer(
    speechControllerReducer,
    initialSpeechControllerState
  );

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

  const [currentAssistantMessageId, setCurrentAssistantMessageId] = useState<string>("");
  const streamingTextRef = useRef<string>("");
  const progressiveSpeechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechControllerRef = useRef(initialSpeechControllerState);
  const lastSpeechPlaybackKeyRef = useRef<string>("");
  const activeTutorSubjectModeRef = useRef<TutorSubjectMode>(subjectMode);
  const [reasoningLogs, setReasoningLogs] = useState<string[]>([]);
  const [reasoningDraft, setReasoningDraft] = useState("");
  const [isReasoningCollapsed, setIsReasoningCollapsed] = useState(false);
  const reasoningDraftRef = useRef("");
  const tutorRawResponseRef = useRef("");
  
  // State for user typing detection
  const [isUserTyping, setIsUserTyping] = useState(false);
  const userTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const balanceErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const [openingPractice, setOpeningPractice] = useState(false);

  useEffect(() => {
    activeTutorSubjectModeRef.current = subjectMode;
  }, [subjectMode]);

  const activeAvatarMode = useMemo<AvatarMode>(() => {
    if (!enableAvatar || displayMode !== 'avatar') {
      return 'none';
    }
    return avatarMode;
  }, [avatarMode, displayMode, enableAvatar]);

  const displayUserName = useMemo(() => {
    if (typeof currentUser !== "string") {
      return "משתמש";
    }

    const trimmedValue = currentUser.trim();
    if (!trimmedValue) {
      return "משתמש";
    }

    const [namePart] = trimmedValue.split("@");
    return namePart || trimmedValue;
  }, [currentUser]);

  const userInitial = displayUserName.charAt(0).toUpperCase();

  useEffect(() => {
    speechControllerRef.current = speechController;
  }, [speechController]);

  useEffect(() => {
    speechDispatch({ type: 'SET_AVATAR_MODE', mode: activeAvatarMode });
  }, [activeAvatarMode]);

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

  const avatarState = useMemo(() => {
    const currentState = isThinking ? 'thinking' 
                        : isRecording ? 'listening' 
                        : (enableVoice && activeAvatarMode !== 'none' && (speechController.status === 'speaking' || speechController.status === 'preparing')) ? 'speaking'
                        : isUserTyping ? 'userWriting'
                        : 'idle';
    return currentState;
  }, [
    activeAvatarMode,
    enableVoice,
    isThinking,
    isRecording,
    isUserTyping,
    speechController.status,
  ]);

  const router = useRouter();

    // Function to toggle the modal
    const toggleModal = () => {
      setShowModal(!showModal);
    };

  const resetSqlTutorForm = () => {
    setSqlTutorOperation("create");
    setSqlTutorTableName("");
    setSqlTutorColumns("");
  };

  const closeSqlTutorModal = () => {
    setSqlTutorModalOpen(false);
    resetSqlTutorForm();
  };

  const buildSqlTutorRequest = () => {
    const tableName = sqlTutorTableName.trim();
    const normalizedColumns = sqlTutorColumns
      .split(/\n|,/)
      .map((col) => col.trim())
      .filter(Boolean)
      .join(", ");

    if (!tableName || !normalizedColumns) return "";

    if (sqlTutorOperation === "create") {
      return [
        "Michael, provide only SQL (no explanation).",
        "I need a CREATE TABLE statement.",
        `Table name: ${tableName}`,
        `Columns: ${normalizedColumns}`,
        "If a column type is missing, choose a sensible SQL type. Do not use CHECK constraints."
      ].join("\n");
    }

    return [
      "Michael, provide only SQL (no explanation).",
      "I need an INSERT statement.",
      `Table name: ${tableName}`,
      `Columns: ${normalizedColumns}`,
      "Use one realistic sample row of values matching the columns. Do not use CHECK constraints."
    ].join("\n");
  };

  const createSpeechUtterance = useCallback(
    (
      utteranceId: string,
      utteranceText: string,
      stage: SpeechUtterance['stage'],
      overrides: Partial<SpeechIntent> = {},
      manual = false
    ): SpeechUtterance => {
      const intent = inferSpeechIntent(utteranceText, overrides);
      const gesturePlan = buildGesturePlan(utteranceText, intent, stage);

      return {
        id: utteranceId,
        text: utteranceText,
        intent,
        stage,
        manual,
        gesturePlan,
      };
    },
    []
  );

  const enqueueUtterance = useCallback((utterance: SpeechUtterance) => {
    speechDispatch({ type: 'ENQUEUE_UTTERANCE', utterance });
  }, []);

  const setGesturePlanForUtterance = useCallback((utteranceId: string, gesturePlan: GesturePlan) => {
    speechDispatch({ type: 'SET_GESTURE_PLAN', utteranceId, gesturePlan });
  }, []);

  const cancelCurrent = useCallback((reason: 'user_input' | 'manual_cancel' | 'mode_switch' | 'flush' | 'error') => {
    enhancedTTS.stop(140);
    speechDispatch({ type: 'CANCEL_CURRENT', reason });
  }, []);

  const flushAll = useCallback((reason: 'user_input' | 'manual_cancel' | 'mode_switch' | 'flush' | 'error' = 'flush') => {
    enhancedTTS.stop(140);
    speechDispatch({ type: 'FLUSH_ALL', reason });
    lastSpeechPlaybackKeyRef.current = '';
  }, []);

  useEffect(() => {
    if (activeAvatarMode === 'none') {
      flushAll('mode_switch');
    }
  }, [activeAvatarMode, flushAll]);

  const buildTTSOptionsForUtterance = useCallback(
    (utterance: SpeechUtterance): TTSOptions => ({
      voice: 'onyx',
      volume: 0.9,
      useOpenAI: true,
      characterStyle: 'university_ta',
      enhanceProsody: true,
      humanize: true,
      naturalPauses: true,
      progressiveMode: utterance.intent.source === 'stream',
      speechIntent: utterance.intent,
    }),
    []
  );

  // Handle audio transcription
  const handleAudioTranscription = (transcription: string) => {
    setUserInput(transcription);
  };

  // Handle user typing detection
  const handleUserTyping = () => {
    if ((speechControllerRef.current.status === 'speaking' || speechControllerRef.current.status === 'preparing') && enableVoice) {
      flushAll('user_input');
    }

    setIsUserTyping(true);
    
    if (userTypingTimeoutRef.current) {
      clearTimeout(userTypingTimeoutRef.current);
    }
    
    userTypingTimeoutRef.current = setTimeout(() => {
      setIsUserTyping(false);
    }, 2000);
  };

  // Exercise-related functions
  const startExercise = async () => {
    if (!isSqlPracticeEnabled || openingPractice) {
      return;
    }

    // Show disclaimer modal first
    setShowDisclaimerModal(true);
  };

  const handleDisclaimerConfirm = async () => {
    const storedUser = getStoredUser();
    const userId = storedUser?.id ?? storedUser?.email ?? null;

    if (!userId) {
      showBalanceErrorNotice("לא ניתן לפתוח את תרגול ה-SQL כרגע.");
      setShowDisclaimerModal(false);
      return;
    }

    setOpeningPractice(true);
    setShowDisclaimerModal(false);
    clearBalanceErrorNotice();

    try {
      const response = await fetch("/api/practice/coins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId),
        },
        body: JSON.stringify({
          userId,
          entryPoint: "chat",
        }),
      });

      const payload = await response.json().catch(() => null);

      if (response.status === 402) {
        const balance = Number(payload?.balance);
        const required = Number(payload?.required);

        if (Number.isFinite(balance)) {
          setCurrentBalanceFromServer(balance);
        }

        showBalanceErrorNotice(
          Number.isFinite(balance) && Number.isFinite(required)
            ? `אין מספיק מטבעות. יתרה: ${balance}, נדרש: ${required}.`
            : "אין מספיק מטבעות"
        );
        return;
      }

      if (!response.ok) {
        showBalanceErrorNotice(payload?.error || "לא ניתן לפתוח את תרגול ה-SQL כרגע.");
        return;
      }

      const nextBalance = normalizeBalanceValue(payload);
      if (nextBalance !== null) {
        setCurrentBalanceFromServer(nextBalance);
      } else if (storedUser?.email) {
        await refreshBalanceFromServer(storedUser.email);
      }

      setShowPracticeModal(true);
    } catch (error) {
      console.error("Failed to open SQL practice:", error);
      showBalanceErrorNotice("לא ניתן לפתוח את תרגול ה-SQL כרגע.");
    } finally {
      setOpeningPractice(false);
    }
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

  const setCurrentBalanceFromServer = useCallback((value: number) => {
    const normalized = Number.isFinite(value) ? value : 0;
    setCurrentBalance(normalized);
    if (typeof window !== "undefined") {
      localStorage.setItem("currentBalance", String(normalized));
    }
  }, []);

  const clearBalanceErrorNotice = useCallback(() => {
    setBalanceError(false);
    setBalanceErrorMessage(null);
    if (balanceErrorTimeoutRef.current) {
      clearTimeout(balanceErrorTimeoutRef.current);
      balanceErrorTimeoutRef.current = null;
    }
  }, []);

  const showBalanceErrorNotice = useCallback((message: string) => {
    setBalanceError(true);
    setBalanceErrorMessage(message);
    if (balanceErrorTimeoutRef.current) {
      clearTimeout(balanceErrorTimeoutRef.current);
    }
    balanceErrorTimeoutRef.current = setTimeout(() => {
      setBalanceError(false);
      setBalanceErrorMessage(null);
      balanceErrorTimeoutRef.current = null;
    }, 4000);
  }, []);

  const normalizeBalanceValue = useCallback((payload: any): number | null => {
    if (Array.isArray(payload)) {
      const coins = Number(payload[0]?.coins);
      return Number.isFinite(coins) ? coins : 0;
    }
    if (payload && typeof payload === "object") {
      const candidates = [payload.coins, payload.balance, payload.currentBalance];
      for (const candidate of candidates) {
        const value = Number(candidate);
        if (Number.isFinite(value)) {
          return value;
        }
      }
    }
    return null;
  }, []);

  const refreshCoinsStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/users/coins?status=1`, { cache: "no-store" });
      if (!response.ok) return null;
      const data: CoinsConfigClientResponse = await response.json();
      const mainChatEnabled = data?.modules?.mainChat === true || data?.status === "ON";
      const sqlPracticeEnabled = data?.modules?.sqlPractice === true;
      const configuredMainChatCost = Number(data?.costs?.mainChatMessage);
      const configuredPracticeCost = Number(data?.costs?.sqlPracticeOpen);

      setIsTokenBalanceVisible(mainChatEnabled);
      setIsSqlPracticeEnabled(sqlPracticeEnabled);
      setMainChatMessageCost(
        Number.isFinite(configuredMainChatCost) && configuredMainChatCost >= 0
          ? configuredMainChatCost
          : 1
      );
      setPracticeOpenCost(Number.isFinite(configuredPracticeCost) && configuredPracticeCost > 0 ? configuredPracticeCost : 1);

      return mainChatEnabled;
    } catch (error) {
      console.error("Failed to refresh coins status:", error);
      return null;
    }
  }, []);

  const refreshBalanceFromServer = useCallback(
    async (emailOverride?: string | null) => {
      const email = emailOverride ?? getStoredUser()?.email ?? null;
      if (!email) return;

      try {
        const response = await fetch(`${UPDATE_BALANCE}?email=${encodeURIComponent(email)}`);
        if (!response.ok) return;
        const data = await response.json();
        const nextBalance = normalizeBalanceValue(data);
        if (nextBalance !== null) {
          setCurrentBalanceFromServer(nextBalance);
        }
      } catch (error) {
        console.error("Failed to refresh balance:", error);
      }
    },
    [getStoredUser, normalizeBalanceValue, setCurrentBalanceFromServer]
  );

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
  const previousScrollTopRef = useRef(0);
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);
  const scheduleScrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (!autoScrollRef.current) return;
      if (scrollTimeoutRef.current) return;
      scrollTimeoutRef.current = setTimeout(() => {
        scrollTimeoutRef.current = null;
        const container = messagesContainerRef.current;
        if (!container) return;
        const threshold = 120;
        const distanceFromBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom >= threshold) {
          autoScrollRef.current = false;
          return;
        }
        scrollToBottom(behavior);
      }, 120);
    },
    [scrollToBottom]
  );
  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const didScrollUp = container.scrollTop < previousScrollTopRef.current;
    previousScrollTopRef.current = container.scrollTop;
    if (didScrollUp) {
      autoScrollRef.current = false;
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      return;
    }
    const threshold = 120;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    autoScrollRef.current = distanceFromBottom < threshold;
    if (!autoScrollRef.current && scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, []);
  const handleMessagesWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) {
      autoScrollRef.current = false;
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    }
  }, []);
  useEffect(() => {
    scheduleScrollToBottom("smooth");
  }, [messages, scheduleScrollToBottom]);
  useEffect(() => () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  }, []);

  const normalizeReasoningText = useCallback((rawText: string) => {
    let text = rawText.trim();
    if (!text) return "";

    if (text.startsWith("{") || text.startsWith("[")) {
      const hasClosedJson = text.endsWith("}") || text.endsWith("]");
      if (!hasClosedJson) return "מעדכן את ההתקדמות...";
    }

    if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (typeof parsed === "string") {
          text = parsed.trim();
        } else if (Array.isArray(parsed)) {
          const firstItem = parsed.find((item) => typeof item === "string");
          text = typeof firstItem === "string" ? firstItem.trim() : "מעדכן את ההתקדמות...";
        } else if (parsed && typeof parsed === "object") {
          const parsedRecord = parsed as Record<string, unknown>;
          const candidate =
            (typeof parsedRecord.summary === "string" && parsedRecord.summary) ||
            (typeof parsedRecord.message === "string" && parsedRecord.message) ||
            (typeof parsedRecord.step === "string" && parsedRecord.step) ||
            (typeof parsedRecord.reasoning === "string" && parsedRecord.reasoning) ||
            (typeof parsedRecord.text === "string" && parsedRecord.text);
          text = (candidate ?? "מעדכן את ההתקדמות...").trim();
        }
      } catch {
        text = "מעדכן את ההתקדמות...";
      }
    }

    const normalized = text
      .replace(/^\s*[-*]\s*/g, "")
      .replace(/tool call/giu, "שלב עיבוד")
      .replace(/calling tool/giu, "אוסף מידע רלוונטי")
      .replace(/using tool/giu, "נעזר במידע רלוונטי")
      .replace(/function call/giu, "שלב בדיקה")
      .replace(/checking schema|schema check/giu, "בודק את מבנה הנתונים כדי לדייק את הפתרון")
      .replace(/running query|execute query/giu, "בודק את השאילתה כדי לוודא תוצאה נכונה")
      .replace(/course week|curriculum context/giu, "מוודא שההסבר מתאים לחומר שנלמד")
      .replace(/tool completed|tool call completed/giu, "המידע נקלט, ממשיך בתשובה")
      .replace(/analy(?:s|z)ing (your )?request/giu, "מנתח את הבקשה")
      .replace(/thinking|reasoning/giu, "מחשב את הדרך הטובה ביותר לענות")
      .replace(/generating (the )?response/giu, "מנסח תשובה")
      .replace(/finalizing|polishing/giu, "מסיים ומלטש את התשובה")
      .replace(/^\s*step\s*\d*[:.-]?\s*/giu, "שלב: ")
      .trim();

    if (/[A-Za-z]/.test(normalized) && !/[\u0590-\u05FF]/.test(normalized)) {
      const english = normalized.toLowerCase();

      if (english.includes("explaining sql query structure")) {
        return "מפרק את מבנה השאילתה: טבלאות, קשרים וסוגי JOIN מתאימים.";
      }

      if (english.includes("identifying common sql mistakes")) {
        return "מאתר טעויות SQL נפוצות כדי לעזור לך להימנע מהן.";
      }

      if (english.includes("preparing a step-by-step explanation")) {
        return "מארגן הסבר מסודר שלב-אחר-שלב שיהיה קל ליישם.";
      }

      if (english.includes("inner join") || english.includes("left join") || english.includes("join")) {
        return "בודק איזה JOIN יתן את התוצאה הנכונה בהתאם לקשרים בין הטבלאות.";
      }

      if (english.includes("where") && english.includes("on")) {
        return "מדייק את תנאי הסינון כדי שהתוצאה תהיה נכונה וברורה.";
      }

      if (english.includes("performance") || english.includes("index")) {
        return "בודק גם ביצועים כדי להציע ניסוח יעיל יותר לשאילתה.";
      }

      if (english.includes("test") || english.includes("dataset") || english.includes("duplicate")) {
        return "מריץ בדיקה לוגית על הדוגמה כדי לוודא שאין כפילויות או חריגות.";
      }

      return "מעבד את הבקשה ומרכיב עבורך הסבר ברור.";
    }

    return normalized || "מעדכן את ההתקדמות...";
  }, []);

  const getToolProgressLog = useCallback((toolName: string, phase: "started" | "completed") => {
    const key = (toolName || "").trim().toLowerCase();
    const toolCopy: Record<string, { started: string; completed: string }> = {
      get_course_week_context: {
        started: "בודק את ההקשר של החומר שנלמד כדי לבנות תשובה מתאימה.",
        completed: "ההקשר הלימודי ברור, ממשיך לפתרון המדויק עבורך.",
      },
      get_database_schema: {
        started: "בודק את מבנה הטבלאות והעמודות כדי לדייק את השאילתה.",
        completed: "מבנה הנתונים ברור, משלב את זה בהסבר פשוט עבורך.",
      },
      execute_sql_query: {
        started: "מריץ בדיקה מהירה על השאילתה כדי לוודא שהתוצאה נכונה.",
        completed: "הבדיקה הסתיימה, משלב את הממצאים בתשובה הסופית.",
      },
      analyze_query_performance: {
        started: "בודק יעילות וביצועים כדי להציע גרסה טובה יותר לשאילתה.",
        completed: "ניתוח הביצועים מוכן, מוסיף המלצות שיפור ברורות.",
      },
    };

    const fallback =
      phase === "started"
        ? "אוסף מידע רלוונטי כדי לדייק עבורך את התשובה."
        : "המידע נאסף, מסכם לך אותו בצורה ברורה.";

    return toolCopy[key]?.[phase] || fallback;
  }, []);

  const addReasoningLog = useCallback((log: string) => {
    const trimmed = normalizeReasoningText(log);
    if (!trimmed) return;
    setReasoningLogs((prev) => {
      const lastLog = prev[prev.length - 1];
      if (lastLog === trimmed) return prev;
      return [...prev, trimmed];
    });
  }, [normalizeReasoningText]);

  const appendReasoningDelta = useCallback((delta: string) => {
    if (!delta) return;
    reasoningDraftRef.current += delta;
    setReasoningDraft(normalizeReasoningText(reasoningDraftRef.current));
  }, [normalizeReasoningText]);

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
      const checkResponse = await fetch(`/api/conversation-summary/student/${userId}?limit=50`, {
        headers: {
          'x-user-id': userId,
        },
      });
      const checkData = await checkResponse.json();
      
      if (checkData.success) {
        const existingAnalysis = checkData.data.summaries.find(summary => summary.sessionId === sessionId);
        if (existingAnalysis) {
          logDebug('Conversation analysis already exists for session:', sessionId);
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
        logDebug('✅ Conversation analysis triggered for session:', sessionId);
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

    (async () => {
      const statusIsOn = await refreshCoinsStatus();
      if (statusIsOn && storedUser?.email) {
        await refreshBalanceFromServer(storedUser.email);
      }
    })();
  }, [getStoredUser, refreshBalanceFromServer, refreshCoinsStatus]);

  useEffect(() => {
    if (!isTokenBalanceVisible) {
      return;
    }

    const activeEmail = user?.email ?? getStoredUser()?.email;
    if (!activeEmail) {
      return;
    }

    const pollCoinsState = async () => {
      const statusIsOn = await refreshCoinsStatus();
      if (statusIsOn) {
        await refreshBalanceFromServer(activeEmail);
      }
    };

    const intervalId = window.setInterval(() => {
      void pollCoinsState();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [getStoredUser, isTokenBalanceVisible, refreshBalanceFromServer, refreshCoinsStatus, user?.email]);

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

  useEffect(() => {
    return () => {
      if (balanceErrorTimeoutRef.current) {
        clearTimeout(balanceErrorTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
      setAuthResolved(true);
      return;
    }
    if (embeddedMode) {
      setUser({ email: "homework-student", name: "Student" });
      setAuthResolved(true);
      return;
    }
    setUser(null);
    setAuthResolved(true);
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

  const persistChatMessage = useCallback(
    async (
      chatId: string,
      payload: {
        userId?: string;
        message: string;
        role: "user" | "assistant";
        citations?: ResponseCitation[];
        metadata?: ResponseTurnMetadata | null;
        structuredContent?: Record<string, unknown> | null;
      }
    ) => {
      await fetch(`/api/chat/sessions/${chatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId,
          userId: payload.userId,
          message: payload.message,
          role: payload.role,
          citations: payload.citations,
          metadata: payload.metadata,
          structuredContent: payload.structuredContent,
        }),
      });
    },
    []
  );

  const ensureChatThread = async (firstUserText: string, userEmail?: string | null) => {
    if (!userEmail) {
      return null;
    }

    if (currentChatIdRef.current) {
      return currentChatIdRef.current;
    }

    if (createChatPromiseRef.current) {
      return createChatPromiseRef.current;
    }

    const today = new Date().toISOString().slice(0, 10);
    const promise = (async () => {
      const response = await fetch(`/api/chat/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `${firstUserText.substring(0, 30)} (${today})`,
          user: userEmail,
          openaiSessionId: sessionIdRef.current || undefined,
        }),
      });
      const newChat = await response.json();
      if (!response.ok) {
        throw new Error(newChat?.error || "Failed to create chat session");
      }

      const nextChatId = newChat._id as string;
      currentChatIdRef.current = nextChatId;
      setCurrentChatId(nextChatId);
      localStorage.setItem("previousSessionId", nextChatId);
      refreshChatSessions();
      return nextChatId;
    })().finally(() => {
      createChatPromiseRef.current = null;
    });

    createChatPromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    createSession().catch((error) => {
      console.error("Failed to create responses session:", error);
      setStreamError("לא הצלחנו לפתוח סשן צ'אט חדש. נסו לרענן את הדף.");
    });
  }, [createSession]);

  // Cleanup speech and typing detection on unmount
  useEffect(() => {
    return () => {
      enhancedTTS.stop();

      if (userTypingTimeoutRef.current) {
        clearTimeout(userTypingTimeoutRef.current);
      }

      if (progressiveSpeechTimeoutRef.current) {
        clearTimeout(progressiveSpeechTimeoutRef.current);
      }

      if (speechDebounceTimeoutRef.current) {
        clearTimeout(speechDebounceTimeoutRef.current);
      }

      // Trigger conversation analysis for current session when component unmounts
      if (currentChatId) {
        triggerConversationAnalysis(currentChatId);
      }
    };
  }, [currentChatId, triggerConversationAnalysis]);

  useEffect(() => {
    if (!enableVoice || !autoPlaySpeech || activeAvatarMode === 'none') {
      return;
    }

    if (!currentAssistantMessageId || !lastAssistantMessage.trim()) {
      return;
    }

    if (speechControllerRef.current.interruptionReason === 'user_input') {
      return;
    }

    const stage: SpeechUtterance['stage'] = isDone ? 'final' : 'streaming';
    const minimumLength = stage === 'streaming' ? 24 : 1;
    if (lastAssistantMessage.trim().length < minimumLength) {
      return;
    }

    if (speechDebounceTimeoutRef.current) {
      clearTimeout(speechDebounceTimeoutRef.current);
    }

    speechDebounceTimeoutRef.current = setTimeout(() => {
      const utterance = createSpeechUtterance(
        currentAssistantMessageId,
        lastAssistantMessage,
        stage,
        { source: 'stream' }
      );
      enqueueUtterance(utterance);
      setGesturePlanForUtterance(utterance.id, utterance.gesturePlan!);
    }, stage === 'streaming' ? 220 : 50);

    return () => {
      if (speechDebounceTimeoutRef.current) {
        clearTimeout(speechDebounceTimeoutRef.current);
      }
    };
  }, [
    activeAvatarMode,
    autoPlaySpeech,
    createSpeechUtterance,
    currentAssistantMessageId,
    enableVoice,
    enqueueUtterance,
    isDone,
    lastAssistantMessage,
    setGesturePlanForUtterance,
  ]);

  useEffect(() => {
    const currentUtterance = speechController.currentUtterance;
    if (!enableVoice || !currentUtterance) {
      return;
    }

    const playbackKey = `${currentUtterance.id}:${currentUtterance.text}:${currentUtterance.stage}`;

    const completeIfCurrent = () => {
      const latestState = speechControllerRef.current;
      if (latestState.currentUtterance?.id !== currentUtterance.id) {
        return;
      }
      if (!latestState.assistantStreaming && latestState.currentUtterance.stage === 'final') {
        speechDispatch({ type: 'COMPLETE_CURRENT', utteranceId: currentUtterance.id });
      }
    };

    const failIfCurrent = (error: Error) => {
      const latestState = speechControllerRef.current;
      if (latestState.currentUtterance?.id !== currentUtterance.id) {
        return;
      }
      speechDispatch({
        type: 'FAIL_CURRENT',
        utteranceId: currentUtterance.id,
        message: error.message,
      });
    };

    if (speechController.status === 'queued') {
      speechDispatch({ type: 'PREPARE_CURRENT', utteranceId: currentUtterance.id });
      return;
    }

    if (speechController.status === 'preparing') {
      if (lastSpeechPlaybackKeyRef.current === playbackKey) {
        return;
      }
      lastSpeechPlaybackKeyRef.current = playbackKey;

      const ttsOptions = buildTTSOptionsForUtterance(currentUtterance);
      void enhancedTTS.speak(currentUtterance.text, {
        ...ttsOptions,
        onStart: () => {
          speechDispatch({ type: 'START_CURRENT', utteranceId: currentUtterance.id });
        },
        onEnd: completeIfCurrent,
        onError: failIfCurrent,
      });
      return;
    }

    if (speechController.status === 'speaking' && currentUtterance.intent.source === 'stream') {
      if (lastSpeechPlaybackKeyRef.current === playbackKey) {
        return;
      }

      lastSpeechPlaybackKeyRef.current = playbackKey;
      const ttsOptions = buildTTSOptionsForUtterance(currentUtterance);
      void enhancedTTS.speak(currentUtterance.text, {
        ...ttsOptions,
        progressiveMode: true,
        onEnd: completeIfCurrent,
        onError: failIfCurrent,
      });
    }
  }, [
    buildTTSOptionsForUtterance,
    enableVoice,
    speechController.currentUtterance,
    speechController.status,
  ]);

  useEffect(() => {
    if (speechController.status === 'error') {
      cancelCurrent('error');
    }
  }, [cancelCurrent, speechController.status]);

  // Avatar interaction handlers
  const handleAvatarInteraction = useCallback((gesture: string, context: any) => {
    logDebug('🎭 Avatar interaction:', { gesture, context });
    
    // Track analytics
    // AVATAR DISABLED: if (enableAnalytics && currentUser) {
    //   avatarAnalytics.trackGesture(gesture, context.type, currentUser);
    // }
  }, []);

  const handleInteractionAnalytics = useCallback((analytics: any) => {
    if (enableAnalytics) {
      logDebug('📊 Avatar Interaction Analytics:', analytics);
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
          activeTutorSubjectModeRef.current = event.subjectMode || "sql";
          if (event.enabled) {
            addReasoningLog(
              activeTutorSubjectModeRef.current === "relational_algebra"
                ? "מכין הסבר מסודר באלגברת יחסים..."
                : "מכין הסבר ברור ומסודר לפי הבקשה שלך..."
            );
          }
          continue;
        }

        if (event.type === "response.reasoning_summary_text.delta") {
          if (isThinkingModeEnabled) {
            appendReasoningDelta(event.delta);
          }
          continue;
        }

        if (event.type === "response.reasoning_summary_text.done") {
          if (isThinkingModeEnabled) {
            if (reasoningDraftRef.current.trim()) {
              flushReasoningDraft();
            } else if (event.text) {
              addReasoningLog(event.text);
            }
          }
          continue;
        }

        if (event.type === "response.tool_call.started") {
          if (isThinkingModeEnabled) {
            flushReasoningDraft();
            addReasoningLog(getToolProgressLog(event.name, "started"));
          }
          continue;
        }

        if (event.type === "response.tool_call.completed") {
          if (isThinkingModeEnabled) {
            addReasoningLog(getToolProgressLog(event.name, "completed"));
          }
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
            setLastAssistantMessageText(
              activeTutorSubjectModeRef.current === "relational_algebra"
                ? buildRelationalAlgebraPreviewFromRaw(tutorRawResponseRef.current)
                : buildTutorPreviewFromRaw(tutorRawResponseRef.current)
            );
            continue;
          }
          handleTextDelta({ value: event.delta });
          continue;
        }

        if (event.type === "response.completed") {
          sawCompleted = true;
          if (event.responseId) setPreviousResponseId(event.responseId);
          if (event.metadata?.sessionId) {
            sessionIdRef.current = event.metadata.sessionId;
            setSessionId(event.metadata.sessionId);
          }
          if (!createdAssistantMessage) {
            handleTextCreated();
            createdAssistantMessage = true;
          }
          flushReasoningDraft();
          setIsReasoningCollapsed(true);

          const activeChatId = currentChatIdRef.current;
          const storedUser = getStoredUser();

          if (event.tutorResponse) {
            await setLastMessageTutorResponse(event.tutorResponse, true);
            if (activeChatId) {
              await persistChatMessage(activeChatId, {
                userId: storedUser?.email,
                role: "assistant",
                message: buildTutorResponseText(event.tutorResponse),
                citations: event.citations,
                metadata: event.metadata || null,
                structuredContent: { tutorResponse: event.tutorResponse },
              });
            }
            continue;
          }

          if (event.outputText) {
            if (!sawDelta) {
              await appendToLastMessageProgressively(event.outputText);
            } else {
              setLastAssistantMessageText(event.outputText);
            }
          }

          if (activeChatId) {
            await persistChatMessage(activeChatId, {
              userId: storedUser?.email,
              role: "assistant",
              message: event.outputText || "",
              citations: event.citations,
              metadata: event.metadata || null,
            });
          }
          continue;
        }

        if (event.type === "response.error") {
          flushReasoningDraft();
          const failureKind = classifyStreamFailure(event.message);
          const failureText = renderStreamFailureMessage(failureKind);
          setStreamError(failureText);
          appendMessage("assistant", failureText);
          await persistAssistantFailure(failureText, event.message);
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
      await persistAssistantFailure(failureText, "stream_interruption");
    }

    endStreamResponse();
  };

  const sendMessage = async (text, image: File | null = selectedImage) => { 
    setImageProcessing(true);
    clearBalanceErrorNotice();
    setIsReasoningCollapsed(false);
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

        logDebug('🔍 Message Analysis:', {
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
          
          logDebug(`🎭 Playing gesture: ${recommendedGesture} (confidence: ${confidence.toFixed(2)})`);
        }
      }
    }
    
    // Message text is used as-is.
    let messageWithTags = text;

    if (formattedHomeworkContext) {
      messageWithTags = `${formattedHomeworkContext}\n\nשאלת הסטודנט: ${text}\n\nהנחיות חשובות:\n- אל תספק תשובה ישירה או קוד SQL מוכן\n- תן רמזים והנחיות שיעזרו לסטודנט למצוא את הפתרון בעצמו\n- שאל שאלות מנחות במקום לתת תשובות\n- עודד חשיבה עצמאית ולמידה\n- הסתמך על ההקשר לעיל וענה בעברית, עם דגשים על SQL כאשר רלוונטי.`;
    }

    // Process image if one is selected
    let imageData = null;
    if (image) {
      try {
        imageData = await fileToBase64(image);
      } catch (error) {
        console.error("Error converting image to base64:", error);
        setImageProcessing(false);
        return;
      }
    }

    const storedUser = getStoredUser();
    const userEmail = storedUser?.email;
    const studentId = storedUser?.id || userEmail;
    let activeChatId = currentChatIdRef.current;

    if (!activeChatId) {
      const previousSessionId = localStorage.getItem('previousSessionId');
      if (previousSessionId) {
        triggerConversationAnalysis(previousSessionId);
      }
      activeChatId = await ensureChatThread(text, userEmail);
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
            chatId: activeChatId || undefined,
            previousResponseId: previousResponseId || undefined,
            content: messageWithTags, // Send message with tags to AI
            imageData: imageData, // Send image data if available
            userEmail: userEmail ?? undefined,
            homeworkRunner: !!homeworkContext, // Allow all SQL (subqueries, CONCAT, ALL, TOP) in homework
            thinkingMode: isThinkingModeEnabled,
            stream: true,
            metadata: {
              student_id: homeworkContext?.studentId || studentId || "",
              ...(subjectMode === "relational_algebra"
                ? {
                    subject_mode: "relational_algebra",
                    tutor_mode: "true",
                  }
                : {}),
              ...(homeworkContext
                ? {
                    homework_set_id: homeworkContext.homeworkSetId || "",
                    question_id: homeworkContext.currentQuestion?.id || "",
                  }
                : {}),
            },
          }),
        }
      );

      if (response.status === 402) {
        let insufficientBody: InsufficientCoinsClientBody | null = null;
        try {
          insufficientBody = await response.json();
        } catch (error) {
          console.error("Failed to parse 402 response body:", error);
        }

        if (insufficientBody?.error === "INSUFFICIENT_COINS") {
          const balance = Number(insufficientBody.balance);
          const required = Number(insufficientBody.required);

          if (Number.isFinite(balance)) {
            setCurrentBalanceFromServer(balance);
          }

          const hebrewMessage =
            Number.isFinite(balance) && Number.isFinite(required)
              ? `אין מספיק מטבעות. יתרה: ${balance}, נדרש: ${required}.`
              : "אין מספיק מטבעות. נסה שוב אחרי שתתעדכן היתרה.";

          showBalanceErrorNotice(hebrewMessage);
          setInputDisabled(false);
          setIsThinking(false);
          setImageProcessing(false);
          return;
        }
      }

      // Check if response is ok and has a body
      if (!response.ok) {
        console.error('❌ Failed to send message:', response.status, response.statusText);
        const failureText = "מצטער, הייתה שגיאה בעיבוד ההודעה. נסה שוב.";
        appendMessage("assistant", failureText);
        await persistAssistantFailure(failureText, `http_${response.status}`);
        setInputDisabled(false);
        setIsThinking(false);
        setImageProcessing(false);
        return;
      }

      if (activeChatId && userEmail) {
        void persistChatMessage(activeChatId, {
          userId: userEmail,
          message: text,
          role: "user",
        });
      }
      
      if (!response.body) {
        console.error('❌ Response body is null');
        const failureText = "מצטער, הייתה שגיאה בתקשורת. נסה לרענן את הדף.";
        appendMessage("assistant", failureText);
        await persistAssistantFailure(failureText, "missing_response_body");
        setInputDisabled(false);
        setIsThinking(false);
        setImageProcessing(false);
        return;
      }

      if (userEmail) {
        void refreshBalanceFromServer(userEmail);
      }

      await consumeResponseStream(response.body);
    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
      const failureText = renderStreamFailureMessage("stream_interruption");
      setStreamError(failureText);
      appendMessage("assistant", failureText);
      await persistAssistantFailure(
        failureText,
        error instanceof Error ? error.message : "stream_interruption"
      );
      setInputDisabled(false);
      setIsThinking(false);
      setIsDone(true);
    }

    // Reset image after sending
    setSelectedImage(null);
    setImageProcessing(false);

  };

  const submitMessage = (messageText: string, displayText?: string, image: File | null = null) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    flushAll('user_input');
    speechDispatch({ type: 'SET_STREAMING', streaming: false });
    if (userTypingTimeoutRef.current) {
      clearTimeout(userTypingTimeoutRef.current);
    }
    setIsUserTyping(false);

    sendMessage(trimmed, image);
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", text: displayText ?? trimmed, hasImage: !!image },
    ]);
    setUserInput("");
    setInputDisabled(true);
    setIsThinking(true);
    autoScrollRef.current = true;
    scheduleScrollToBottom("smooth");
  };

  const handleSqlTutorRequest = () => {
    const prompt = buildSqlTutorRequest();
    if (!prompt || inputDisabled || imageProcessing) return;
    closeSqlTutorModal();
    submitMessage(prompt);
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
  flushAll('flush');
  speechDispatch({ type: 'SET_STREAMING', streaming: false });
  setLastAssistantMessage("");
  setCurrentAssistantMessageId("");
  
  fetch(`/api/chat/sessions/${chatId}/messages`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(response => response.json()).then(chatMessages => {
    const hydratedMessages = chatMessages.map((message: ChatMessage) => {
      const tutorResponse =
        message.structuredContent &&
        typeof message.structuredContent === "object" &&
        "tutorResponse" in message.structuredContent
          ? (message.structuredContent.tutorResponse as TutorResponse | null)
          : null;

      return {
        ...message,
        tutorResponse,
      };
    });
    const uniqueItems = keepOneInstance(hydratedMessages, "text");
    const selectedSession = chatSessions.find((session) => session._id === chatId);
    const latestAssistantMessage = [...hydratedMessages]
      .reverse()
      .find((message) => message.role === "assistant");
    const restoredSessionId =
      selectedSession?.openaiState?.sessionId ||
      latestAssistantMessage?.metadata?.sessionId ||
      "";
    const restoredPreviousResponseId =
      selectedSession?.openaiState?.lastResponseId ||
      latestAssistantMessage?.metadata?.responseId ||
      "";

    setMessages(uniqueItems);
    setCurrentChatId(chatId);
    currentChatIdRef.current = chatId;
    sessionIdRef.current = restoredSessionId;
    setSessionId(restoredSessionId);
    setPreviousResponseId(restoredPreviousResponseId);
    setLoadingMessages(false);
  })  
};

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim() && !selectedImage) return;
    
    // Display message with image info if present
    const displayText = selectedImage 
      ? `${userInput}${userInput ? '\n' : ''}[תמונה מצורפת: ${selectedImage.name}]`
      : userInput;
    
    // Check if we're in exercise mode (but exercises are now handled in modal)
    if (isExerciseMode && currentExercise) {
      // In exercise mode, regular chat is disabled
      return;
    }
    
    submitMessage(userInput, displayText, selectedImage);
  };

  /* Stream Event Handlers */

  // textCreated - create new assistant message
  const handleTextCreated = () => {
    setIsDone(false);
    setIsThinking(false); // Stop thinking when assistant starts responding
    speechDispatch({ type: 'SET_STREAMING', streaming: true });
    flushAll('flush');
    streamingTextRef.current = "";
    tutorRawResponseRef.current = "";
    // Create a stable message id for this assistant message
    setCurrentAssistantMessageId(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
    
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
      
      streamingTextRef.current += text;
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

  const endStreamResponse = () => {
    setInputDisabled(false);
    setIsThinking(false);
    setIsDone(true);
    speechDispatch({ type: 'SET_STREAMING', streaming: false });
    setReasoningDraft("");
    reasoningDraftRef.current = "";
    tutorRawResponseRef.current = "";
    
    // Clear progressive speech timeout when stream ends
    if (progressiveSpeechTimeoutRef.current) {
      clearTimeout(progressiveSpeechTimeoutRef.current);
      progressiveSpeechTimeoutRef.current = null;
    }
  };

  const persistAssistantFailure = useCallback(
    async (message: string, failureReason: string, responseId?: string | null) => {
      const activeChatId = currentChatIdRef.current;
      const storedUser = getStoredUser();

      if (!activeChatId) {
        return;
      }

      await persistChatMessage(activeChatId, {
        userId: storedUser?.email,
        role: "assistant",
        message,
        metadata: {
          canonicalStateStrategy: "previous_response_id",
          sessionId: sessionIdRef.current || null,
          responseId: responseId || null,
          previousResponseId: previousResponseId || null,
          failureReason,
        },
      });
    },
    [getStoredUser, persistChatMessage, previousResponseId]
  );

  useEffect(() => {
    if (!authResolved) {
      return;
    }
    const storedUser = getStoredUser();
    if (!storedUser && !embeddedMode) {
      router.replace('/'); // Redirect to login entry if no user is found
    }
  }, [authResolved, router, embeddedMode, getStoredUser]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    setUser(null);
    router.push('/');
  };

  if (!authResolved) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className={styles.loadingIndicator}></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  /*
    =======================
    === Utility Helpers ===
    =======================
  */

  const buildTutorResponseText = (tutorResponse: TutorResponse) => {
    if (isRelationalAlgebraTutorResponse(tutorResponse)) {
      const mistakesText =
        tutorResponse.commonMistakes?.length > 0
          ? tutorResponse.commonMistakes.map((mistake) => `- ${mistake}`).join("\n")
          : "- —";
      const stepsText =
        tutorResponse.steps?.length > 0
          ? tutorResponse.steps
              .map(
                (step, index) =>
                  `${index + 1}. ${step.title}\n${step.expression}\n${step.explanation}${
                    step.sqlEquivalent ? `\nSQL: ${step.sqlEquivalent}` : ""
                  }`
              )
              .join("\n\n")
          : "- —";
      return `**סיכום**\n${tutorResponse.summary}\n\n**ביטוי אלגברת יחסים**\n\`\`\`\n${tutorResponse.relationalAlgebraExpression}\n\`\`\`\n\n**שלבים**\n${stepsText}\n\n**טעויות נפוצות**\n${mistakesText}\n\n**הערת תחום**\n${tutorResponse.scopeNote}`;
    }

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

  const buildRelationalAlgebraPreviewFromRaw = (raw: string) => {
    const summary = extractPartialJsonStringField(raw, "summary");
    const expression = extractPartialJsonStringField(raw, "relationalAlgebraExpression");
    const scopeNote = extractPartialJsonStringField(raw, "scopeNote");

    const blocks: string[] = [];
    if (summary) {
      blocks.push(`**סיכום**\n${summary}`);
    }
    if (expression) {
      blocks.push(`**ביטוי אלגברת יחסים**\n\`\`\`\n${expression}\n\`\`\``);
    }
    if (scopeNote) {
      blocks.push(`**הערת תחום**\n${scopeNote}`);
    }

    return blocks.length > 0 ? blocks.join("\n\n") : "מנסח הסבר באלגברת יחסים...";
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
    tutorResponse: TutorResponse,
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
          logDebug(`🎭 Assistant response gesture: ${gesture}`);
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
    flushAll('flush');
    speechDispatch({ type: 'SET_STREAMING', streaming: false });
    setLastAssistantMessage("");
    streamingTextRef.current = "";
    setCurrentAssistantMessageId("");
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
    currentChatIdRef.current = null;
    setSessionId("");
    setPreviousResponseId("");
    createChatPromiseRef.current = null;
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
  isThinkingModeEnabled && (reasoningLogs.length > 0 || reasoningDraft.length > 0);
const hasStreamingAssistantMessage =
  inputDisabled && messages.length > 0 && messages[messages.length - 1]?.role === "assistant";

const reasoningPanel = shouldShowReasoningPanel ? (
  <div className={`${styles.reasoningPanel} ${isReasoningCollapsed ? styles.reasoningPanelCollapsed : ""}`}>
    <button
      type="button"
      className={styles.reasoningToggle}
      onClick={() => setIsReasoningCollapsed((prev) => !prev)}
      aria-expanded={!isReasoningCollapsed}
    >
      <span className={styles.reasoningTitle}>דרכי פעולה</span>
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


// const onboardingPanel = shouldShowOnboarding ? (
//   <div className={styles.onboardingPanel}>
//     <div className={styles.onboardingTitle}>התאמה ראשונית עם מייקל</div>
//     <p className={styles.onboardingText}>
//       בחר 4 העדפות קצרות כדי שמייקל יתאים את ההסברים מעכשיו.
//     </p>
//     <div className={styles.preferenceGrid}>
//       <label className={styles.preferenceField}>
//         <span>מצב למידה</span>
//         <select value={studyMode} onChange={(event) => setStudyMode(event.target.value as TutorStudyMode)}>
//           <option value="learn">Learn</option>
//           <option value="debug_sql">Debug my SQL</option>
//           <option value="homework">Solve homework carefully</option>
//           <option value="exam_prep">Exam prep</option>
//         </select>
//       </label>
//       <label className={styles.preferenceField}>
//         <span>עומק תשובה</span>
//         <select value={answerLength} onChange={(event) => setAnswerLength(event.target.value as TutorAnswerLength)}>
//           <option value="short">short answer</option>
//           <option value="step_by_step">step-by-step</option>
//         </select>
//       </label>
//       <label className={styles.preferenceField}>
//         <span>רמת הסבר</span>
//         <select value={knowledgeLevel} onChange={(event) => setKnowledgeLevel(event.target.value as TutorKnowledgeLevel)}>
//           <option value="beginner">beginner</option>
//           <option value="advanced">advanced</option>
//         </select>
//       </label>
//       <label className={styles.preferenceField}>
//         <span>שפת הסבר</span>
//         <select value={responseLanguage} onChange={(event) => setResponseLanguage(event.target.value as TutorResponseLanguage)}>
//           <option value="he">עברית</option>
//           <option value="en">English</option>
//         </select>
//       </label>
//     </div>
//     <div className={styles.preferenceActions}>
//       <button type="button" className={styles.primaryInlineButton} onClick={() => setOnboardingComplete(true)}>
//         שמור התאמה
//       </button>
//       <button type="button" className={styles.secondaryInlineButton} onClick={() => setOnboardingComplete(true)}>
//         דלג לעכשיו
//       </button>
//     </div>
//   </div>
// ) : null;

// const resumeBanner = resumeSession ? (
//   <div className={styles.resumeBanner}>
//     <div>
//       <div className={styles.resumeTitle}>המשך מאיפה שעצרת</div>
//       <p className={styles.resumeText}>{resumeSession.title}</p>
//     </div>
//     <button
//       type="button"
//       className={styles.primaryInlineButton}
//       onClick={() => loadChatMessages(resumeSession._id)}
//     >
//       חזור לשיחה
//     </button>
//   </div>
// ) : null;

  if (!authResolved) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className={styles.loadingIndicator}></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

return (
  <div 
    className={`${styles.main} ${isProfessionalConversation ? styles.mainProfessional : ''} ${!sidebarVisible || hideSidebar || minimalMode ? styles.mainFullWidth : ''}`}
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
      <div className={`${styles.chatContainer} ${isProfessionalConversation ? styles.chatContainerProfessional : ''}`} style={embeddedStyles.chatContainer}>
        <div
          className={`${styles.messages} ${isProfessionalConversation ? styles.messagesProfessional : ''}`}
          style={embeddedStyles.messages}
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          onWheel={handleMessagesWheel}
        >
          {loadingMessages ? (
            <div className={styles.loadingIndicator}></div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <React.Fragment key={index}>
                  {shouldShowReasoningPanel &&
                    index === messages.length - 1 &&
                    msg.role === "assistant" &&
                    reasoningPanel}
                  <Message
                    role={msg.role}
                    text={msg.text}
                    feedback={msg.feedback}
                    hasImage={msg.hasImage}
                    tutorResponse={msg.tutorResponse}
                    conversationVariant={conversationVariant}
                    onFeedback={msg.role === 'assistant' ? (isLike) => handleFeedback(isLike, index) : undefined}
                    autoPlaySpeech={msg.role === 'assistant' ? (enableVoice && autoPlaySpeech) : undefined}
                    onPlayMessage={msg.role === 'assistant' ? () => {
                      if (!enableVoice) {
                        return;
                      }
                      flushAll('manual_cancel');
                      const manualId = `manual-${Date.now()}`;
                      const utterance = createSpeechUtterance(
                        manualId,
                        msg.text,
                        'final',
                        { source: 'manual' },
                        true
                      );
                      enqueueUtterance(utterance);
                      setGesturePlanForUtterance(utterance.id, utterance.gesturePlan!);
                      setLastAssistantMessage(msg.text);
                      setCurrentAssistantMessageId(manualId);
                      setIsThinking(false);
                    } : undefined}
                  />
                </React.Fragment>
              ))}
              {inputDisabled && (
                <div className={styles.assistantMessage}>
                  {!hasStreamingAssistantMessage && reasoningPanel}
                  <div className={styles.typingIndicator}>
                    <div className={styles.typingDot}></div>
                    <div className={styles.typingDot}></div>
                    <div className={styles.typingDot}></div>
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
          className={`${styles.inputForm} ${styles.clearfix} ${isProfessionalConversation ? styles.inputFormProfessional : ''}`}
        >
          <div className={`${styles.inputContainer} ${isProfessionalConversation ? styles.inputContainerProfessional : ''} ${isExerciseMode ? styles.exerciseMode : ''}`}>
            {userInput && isTokenBalanceVisible && (
              <div className={styles.costPopup}>
                עלות הודעה: {mainChatMessageCost} מטבע{mainChatMessageCost === 1 ? "" : "ות"}
              </div>
            )}
            {streamError && (
              <div className={styles.streamErrorBanner}>
                {streamError}
              </div>
            )}

            {enableRelationalAlgebraMode && subjectMode === "relational_algebra" && (
              <div className={styles.subjectModeBanner}>
                מצב אלגברת יחסים פעיל. 
              </div>
            )}

            <textarea
              className={`${styles.input} ${isProfessionalConversation ? styles.inputProfessional : ''}`}
              name="chatMessage"
              value={userInput}
              onChange={(e) => {
                if (streamError) setStreamError(null);
                setUserInput(e.target.value);
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
                  ? "הקלד את תשובת ה-SQL שלך כאן…" 
                  : enableRelationalAlgebraMode && subjectMode === "relational_algebra"
                    ? "שאל על אלגברת יחסים, המרה מ-SQL, או פירוק לביטוי RA…"
                    : "הקלד כאן…"
              }
              aria-label={isExerciseMode ? "תשובת SQL" : "הודעה לצ'אט"}
              autoComplete="off"
              spellCheck={false}
              style={{
                paddingTop: isProfessionalConversation ? '18px' : '16px',
                paddingRight: isProfessionalConversation ? '22px' : '20px',
                paddingBottom: isProfessionalConversation ? '18px' : '16px',
                paddingLeft: isProfessionalConversation ? '64px' : '50px'
              }}
            />
            
            {/* Send Button */}
            <button
              type="submit"
              className={`${styles.sendButton} ${isProfessionalConversation ? styles.sendButtonProfessional : ''}`}
              disabled={inputDisabled || imageProcessing || (!userInput.trim() && !selectedImage)}
              aria-label="שלח הודעה"
            >
              <ArrowUp size={17} strokeWidth={2.35} aria-hidden="true" />
            </button>

            {/* Action Buttons Row */}
            {!minimalMode && (
            <div className={`${styles.actionButtons} ${isProfessionalConversation ? styles.actionButtonsProfessional : ''}`} ref={actionMenuRef}>
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
                aria-label="פתח תפריט פעולות"
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
                      setIsThinkingModeEnabled((previous) => !previous);
                    }}
                    disabled={inputDisabled || imageProcessing}
                    title={isThinkingModeEnabled ? "כיבוי מצב חשיבה" : "הפעלת מצב חשיבה"}
                    role="menuitemcheckbox"
                    aria-checked={isThinkingModeEnabled}
                  >
                    
                    <div className={styles.actionMenuItemBody}>
                    <BrainCircuit className={styles.actionMenuItemIcon} size={10} strokeWidth={2} />
                      <span className={styles.actionMenuItemTitle}>מצב חשיבה</span>
                      <span className={styles.actionMenuItemDescription}>
                        {isThinkingModeEnabled ? "תשובות עם תהליך חשיבה" : "תשובות מהירות יותר"}
                      </span>
                      <span
                      className={`${styles.actionMenuItemBadge} ${
                        isThinkingModeEnabled ? styles.actionMenuItemBadgeActive : styles.actionMenuItemBadgeInactive
                      }`}
                    >
                      {isThinkingModeEnabled ? "פועל" : "כבוי"}
                    </span>
                    </div>
                   
                  </button>

                  {enableRelationalAlgebraMode && (
                    <button
                      type="button"
                      className={styles.actionMenuItem}
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setSubjectMode((previous) =>
                          previous === "relational_algebra" ? "sql" : "relational_algebra"
                        );
                      }}
                      disabled={inputDisabled || imageProcessing}
                      title="הפעלת מצב אלגברת יחסים"
                      role="menuitemcheckbox"
                      aria-checked={subjectMode === "relational_algebra"}
                    >
                      <div className={styles.actionMenuItemBody}>
                        <span className={styles.actionMenuItemIconText}>π</span>
                        <span className={styles.actionMenuItemTitle}>אלגברת יחסים</span>
                        <span className={styles.actionMenuItemDescription}>
                          {subjectMode === "relational_algebra"
                            ? "מייקל יסביר בעזרת σ, π, ⋈"
                            : "מעבר להכוונה באלגברת יחסים"}
                        </span>
                        <span
                          className={`${styles.actionMenuItemBadge} ${
                            subjectMode === "relational_algebra"
                              ? styles.actionMenuItemBadgeActive
                              : styles.actionMenuItemBadgeInactive
                          }`}
                        >
                          {subjectMode === "relational_algebra" ? "פועל" : "כבוי"}
                        </span>
                      </div>
                    </button>
                  )}

                  {isSqlPracticeEnabled && (
                    <button
                      type="button"
                      className={styles.actionMenuItem}
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        void startExercise();
                      }}
                      disabled={inputDisabled || openingPractice}
                      title="קבל תרגול SQL חדש"
                      role="menuitem"
                    >
                      <div className={styles.actionMenuItemBody}>
                        <Sparkles className={styles.actionMenuItemIcon} size={16} strokeWidth={2} />
                        <span className={styles.actionMenuItemTitle}>תרגול SQL</span>
                        <span className={styles.actionMenuItemDescription}>תרגול חדש לבדיקה עצמית</span>
                        <span
                          className={`${styles.actionMenuItemBadge} ${styles.actionMenuItemBadgePlaceholder}`}
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  )}

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
                    <div className={styles.actionMenuItemBody}>
                      <ImagePlus className={styles.actionMenuItemIcon} size={16} strokeWidth={2} />
                      <span className={styles.actionMenuItemTitle}>הוספת תמונה</span>
                      <span className={styles.actionMenuItemDescription}>צירוף צילום מסך או תרשים</span>
                      <span
                        className={`${styles.actionMenuItemBadge} ${styles.actionMenuItemBadgePlaceholder}`}
                        aria-hidden="true"
                      />
                    </div>
                  </button>

                  <button
                    type="button"
                    className={styles.actionMenuItem}
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      setSqlTutorModalOpen(true);
                    }}
                    title="קבל שאילתת CREATE/INSERT ממייקל"
                    role="menuitem"
                  >
                    <div className={styles.actionMenuItemBody}>
                      <Braces className={styles.actionMenuItemIcon} size={16} strokeWidth={2} />
                      <span className={styles.actionMenuItemTitle}>
                        <span dir="rtl">מייקל:</span>{" "}
                        <span className={styles.actionMenuItemInlineLtr} dir="ltr">CREATE/INSERT</span>
                      </span>
                      <span className={styles.actionMenuItemDescription}>יצירת סכמת טבלאות או נתוני דוגמה</span>
                      <span
                        className={`${styles.actionMenuItemBadge} ${styles.actionMenuItemBadgePlaceholder}`}
                        aria-hidden="true"
                      />
                    </div>
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
                    <div className={styles.actionMenuItemBody}>
                      <BarChart3 className={styles.actionMenuItemIcon} size={16} strokeWidth={2} />
                      <span className={styles.actionMenuItemTitle}>המחשת שאילתה</span>
                      <span className={styles.actionMenuItemDescription}>תרשים ויזואלי של תוצאות השאילתה</span>
                      <span
                        className={`${styles.actionMenuItemBadge} ${styles.actionMenuItemBadgePlaceholder}`}
                        aria-hidden="true"
                      />
                    </div>
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
    {balanceError && balanceErrorMessage && (
      <div className={styles.balanceError} role="alert" dir="rtl">
        {balanceErrorMessage}
      </div>
    )}
    
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
            <div className={styles.profileSummary}>
              <div className={styles.profileIdentity}>
                <div className={styles.profileMonogram}>{userInitial}</div>
                <div className={styles.profileText}>
                  <span className={styles.profileEyebrow}>חשבון פעיל</span>
                  <span className={styles.profileName}>{displayUserName}</span>
                </div>
              </div>
              {isTokenBalanceVisible && (
                <div className={styles.balancePill}>
                  <span className={styles.balanceLabel}>יתרה</span>
                  <span className={styles.balanceValue}>
                    {currentBalance} מטבע{currentBalance === 1 ? "" : "ות"}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.avatarVisualShell}>
              {displayMode === 'avatar' && enableAvatar ? (
                <>
                  {activeAvatarMode === 'avatar3d' ? (
                    <MichaelAvatarDirect
                      text={lastAssistantMessage}
                      state={avatarState}
                      size="medium"
                      progressiveMode={speechController.assistantStreaming}
                      isStreaming={speechController.assistantStreaming}
                      speechStatus={speechController.status}
                      gesturePlan={speechController.currentUtterance?.gesturePlan ?? null}
                      renderConfig={DEFAULT_AVATAR_RENDER_CONFIG}
                      utteranceId={speechController.currentUtterance?.id ?? null}
                    />
                  ) : (
                    <VoiceModeCircle
                      state={avatarState}
                      size="medium"
                      text={lastAssistantMessage}
                      speechStatus={speechController.status}
                      gesturePlan={speechController.currentUtterance?.gesturePlan ?? null}
                      renderConfig={DEFAULT_AVATAR_RENDER_CONFIG}
                      onPrimaryAction={() => {
                        if (!enableVoice || activeAvatarMode === 'none') {
                          return;
                        }
                        if (speechController.status === 'speaking' || speechController.status === 'preparing') {
                          cancelCurrent('manual_cancel');
                          return;
                        }
                        const messageToReplay = lastAssistantMessage || speechController.currentUtterance?.text;
                        if (!messageToReplay) {
                          return;
                        }
                        flushAll('manual_cancel');
                        const manualId = `manual-${Date.now()}`;
                        const utterance = createSpeechUtterance(
                          manualId,
                          messageToReplay,
                          'final',
                          { source: 'manual' },
                          true
                        );
                        enqueueUtterance(utterance);
                        setGesturePlanForUtterance(utterance.id, utterance.gesturePlan!);
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
            </div>

            <div className={styles.toggleButtonsContainer}>
              <div className={styles.displayModeToggle}>
                <button 
                  className={`${styles.displayToggleButton} ${displayMode === 'logo' ? styles.logoModeActive : styles.avatarModeActive}`}
                  onClick={() => setDisplayMode(displayMode === 'avatar' ? 'logo' : 'avatar')}
                  title={displayMode === 'avatar' ? 'עבור למצב לוגו' : 'עבור למצב אווטאר'}
                  aria-label={displayMode === 'avatar' ? 'Switch to logo mode' : 'Switch to avatar mode'}
                >
                  {displayMode === 'avatar' ? (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
                      </svg>
                      <span className={styles.controlButtonLabel}>אווטאר</span>
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <span className={styles.controlButtonLabel}>לוגו</span>
                    </>
                  )}
                </button>
              </div>
              {displayMode === 'avatar' && enableAvatar && (
                <div className={styles.avatarModeToggle}>
                  <button
                    className={`${styles.modeToggleButton} ${activeAvatarMode === 'avatar3d' ? styles.avatarActive : styles.voiceActive}`}
                    onClick={() => setAvatarMode((previous) => previous === 'avatar3d' ? 'voiceCircle' : 'avatar3d')}
                    title={activeAvatarMode === 'avatar3d' ? 'עבור למצב קול' : 'עבור למצב אווטאר תלת-ממדי'}
                    aria-label={activeAvatarMode === 'avatar3d' ? 'Switch to voice circle' : 'Switch to 3D avatar'}
                  >
                    {activeAvatarMode === 'avatar3d' ? (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                        <span className={styles.controlButtonLabel}>קול</span>
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span className={styles.controlButtonLabel}>תלת־ממד</span>
                      </>
                    )}
                  </button>
                </div>
              )}
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
                    הצג חלופה לפתרון
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
            <p className={styles.disclaimerText}>
              פתיחת תרגול SQL תחייב {practiceOpenCost} מטבע{practiceOpenCost === 1 ? "" : "ות"}.
            </p>
            <div className={styles.disclaimerActions}>
              <button
                className={styles.disclaimerCancelButton}
                onClick={handleDisclaimerCancel}
                disabled={openingPractice}
              >
                ביטול
              </button>
              <button
                className={styles.disclaimerConfirmButton}
                onClick={handleDisclaimerConfirm}
                disabled={openingPractice}
              >
                {openingPractice ? "פותח תרגול..." : "אני מסכים, התחל תרגול"}
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
      userId={user?.email || getStoredUser()?.email || 'anonymous'}
      openCost={practiceOpenCost}
    />

    <Modal isOpen={sqlTutorModalOpen} onClose={closeSqlTutorModal}>
      <div className={styles.sqlTutorModal}>
        <h3 className={styles.sqlTutorTitle}>מייקל: צור שאילתת SQL</h3>
        <p className={styles.sqlTutorDescription}>
          מלא שם טבלה ועמודות, ומייקל יחזיר שאילתת SQL מוכנה.
        </p>

        <div className={styles.sqlTutorOperation}>
          <button
            type="button"
            className={`${styles.sqlTutorOperationButton} ${sqlTutorOperation === "create" ? styles.sqlTutorOperationButtonActive : ""}`}
            onClick={() => setSqlTutorOperation("create")}
          >
            CREATE TABLE
          </button>
          <button
            type="button"
            className={`${styles.sqlTutorOperationButton} ${sqlTutorOperation === "insert" ? styles.sqlTutorOperationButtonActive : ""}`}
            onClick={() => setSqlTutorOperation("insert")}
          >
            INSERT
          </button>
        </div>

        <input
          type="text"
          className={styles.sqlTutorInput}
          value={sqlTutorTableName}
          onChange={(e) => setSqlTutorTableName(e.target.value)}
          placeholder="Table name (e.g. students)"
        />

        <textarea
          className={styles.sqlTutorTextarea}
          value={sqlTutorColumns}
          onChange={(e) => setSqlTutorColumns(e.target.value)}
          placeholder="Columns (comma or line-separated), e.g. id INT, full_name VARCHAR(100), grade INT"
          rows={5}
        />

        <div className={styles.sqlTutorActions}>
          <button
            type="button"
            className={styles.sqlTutorCancelButton}
            onClick={closeSqlTutorModal}
          >
            ביטול
          </button>
          <button
            type="button"
            className={styles.sqlTutorSubmitButton}
            onClick={handleSqlTutorRequest}
            disabled={!sqlTutorTableName.trim() || !sqlTutorColumns.trim() || inputDisabled || imageProcessing}
          >
            שלח למייקל
          </button>
        </div>
      </div>
    </Modal>
  </div>
);
};

export default Chat;
