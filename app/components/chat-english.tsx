"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import styles from "./chat.module.css";
import "./mobile-optimizations.css";
import { AssistantStream } from "openai/lib/AssistantStream";
import Markdown from "react-markdown";
// @ts-expect-error - no types for this yet
import { AssistantStreamEvent } from "openai/resources/beta/assistants/assistants";
import { RequiredActionFunctionToolCall } from "openai/resources/beta/threads/runs/runs";
import { ThumbsUp, ThumbsDown, ClipboardCopy } from 'lucide-react';
import Link from 'next/link';
import SidebarEnglish from './sidebar-english';
import { useRouter } from 'next/navigation';
import Modal from "./modal";
import SQLQueryEditorComponent from "./query-vizualizer";
import ImageUpload from "./image-upload";
import { fileToBase64 } from "../utils/parseImage";
// import AudioRecorder from "./audio-recorder"; // Clean version: hide audio recorder button
// AVATAR TEMPORARILY DISABLED - Commented out to prevent crashes
// import MichaelAvatarDirect from "./MichaelAvatarDirect";
// import VoiceModeCircle from "./VoiceModeCircle";
// import StaticLogoMode from "./StaticLogoMode";
// import { AvatarIcon, MicIcon } from "./AvatarToggleIcons";
// import { enhancedTTS } from "@/app/utils/enhanced-tts";
// import AvatarInteractionManager from "./AvatarInteractionManager";
import { analyzeMessage } from "../utils/sql-query-analyzer";
// import { avatarAnalytics } from "../utils/avatar-analytics";
import OpenAI from "openai";
import PracticeModal from "./PracticeModal";
import SqlQueryBuilder from "./SqlQueryBuilder/SqlQueryBuilder";

export const maxDuration = 50;

// Replace external base with internal routes
const SAVE = "/api/chat/save"; // not used directly; message saving goes via chat sessions endpoint
const UPDATE_BALANCE = "/api/users/balance";

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
  feedback: "like" | "dislike" | null;
  onFeedback?: (feedback: "like" | "dislike" | null) => void;
  hasImage?: boolean;
};

// Add these types
type ChatSession = {
  _id: string;
  title: string;
  lastMessageTimestamp: number;
};

const UserMessage = ({ text }: { text: string }) => {
  return <div className={styles.userMessage}>{text}</div>;
};
const AssistantMessage = ({ text, feedback, onFeedback, autoPlaySpeech, onPlayMessage }: { text: string; feedback: "like" | "dislike" | null; onFeedback?: (feedback: "like" | "dislike" | null) => void; autoPlaySpeech?: boolean; onPlayMessage?: () => void }) => {
  const [activeFeedback, setActiveFeedback] = useState(feedback);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showPlayTooltip, setShowPlayTooltip] = useState(false);  // Separate state for play button tooltip
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [copied, setCopied] = useState(false);  // Tooltip state
  const [copiedText, setCopiedText] =  useState("Copy Query")
  const [playTooltipText, setPlayTooltipText] = useState("Play this message");


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
      setPlayTooltipText("Playing...");
      setTimeout(() => {
        setPlayTooltipText("Play this message");
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
                setCopiedText("Copied Successfully")
              }}
              title="Copy SQL"
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
        setCopiedText("Copied Successfully");
        setTimeout(() => {
          setCopiedText("Copy Query");
        }, 3000);
      })
      .catch((error) => {
        console.error("Failed to copy:", error);
      });
};
  return (
    <div className={styles.assistantMessage}>
      <div className={styles.messageContent}>
        <Markdown components={renderers}>{text}</Markdown>
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
          onClick={() => copyQueryToClipboard(text)} // Keep this for general copying
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

const Message = ({ role, text, feedback, onFeedback, hasImage, autoPlaySpeech, onPlayMessage }: MessageProps & { autoPlaySpeech?: boolean; onPlayMessage?: () => void }) => {
  switch (role) {
    case "user":
      return <UserMessage text={text} />;
    case "assistant":
      return <AssistantMessage text={text} feedback={feedback} onFeedback={onFeedback} autoPlaySpeech={autoPlaySpeech} onPlayMessage={onPlayMessage} />;
    case "code":
      return <CodeMessage text={text} />;
    default:
      return null;
  }
};

type ChatProps = {
  functionCallHandler?: (
    toolCall: RequiredActionFunctionToolCall
  ) => Promise<string>;
  chatId: string;
  onUserMessage?: (message: string) => void;
  onAssistantResponse?: (response: string) => void;
};

const ChatEnglish = ({
  functionCallHandler = () => Promise.resolve(""), // default to return empty string
  chatId: initialChatId,
  onUserMessage,
  onAssistantResponse
}: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<MessageProps[]>([
    {
      role: "user",
      text: "Hi Michael! What are sub-queries?",
      feedback: null,
      hasImage: false
    },
    {
      role: "assistant",
      text: "Great question! Sub-queries are queries nested inside another query. They're incredibly useful for complex data retrieval. Here are the main types:\n\n## **Types of Sub-queries:**\n\n### 1. **Scalar Sub-query**\nReturns a single value:\n```sql\nSELECT name, salary\nFROM employees\nWHERE salary > (SELECT AVG(salary) FROM employees);\n```\n\n### 2. **Row Sub-query**\nReturns multiple columns but one row:\n```sql\nSELECT *\nFROM products\nWHERE (category_id, price) = (SELECT category_id, MAX(price) FROM products WHERE category_id = 1);\n```\n\n### 3. **Table Sub-query**\nReturns multiple rows and columns:\n```sql\nSELECT *\nFROM orders\nWHERE customer_id IN (SELECT customer_id FROM customers WHERE city = 'New York');\n```\n\n## **Common Use Cases:**\n- Finding records above/below average\n- Filtering based on related table data\n- Creating dynamic comparisons\n- Building complex reports\n\n**Pro tip:** You can use sub-queries in SELECT, WHERE, FROM, and HAVING clauses!\n\nWould you like me to show you some practical examples with specific scenarios?",
      feedback: null
    }
  ]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [threadId, setThreadId] = useState("");
  const [user, setUser] = useState(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Avatar interaction system
  const avatarRef = useRef(null);
  const [enableAvatarInteractions, setEnableAvatarInteractions] = useState(false); // DISABLED
  const [enableSQLGestureMapping, setEnableSQLGestureMapping] = useState(false); // DISABLED
  const [enableAnalytics, setEnableAnalytics] = useState(false); // DISABLED
  // Added for query cost estimation feature
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [balanceError, setBalanceError] = useState(false);
  const [isTokenBalanceVisible, setIsTokenBalanceVisible] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false); // Add loading state
  // Add SQL Query Builder state
  const [sqlBuilderOpen, setSqlBuilderOpen] = useState(false);
  // Add audio and speech state
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string>("");
  const [autoPlaySpeech, setAutoPlaySpeech] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  // Environment variables - these are available at build time
  const enableAvatar = process.env.NEXT_PUBLIC_AVATAR_ENABLED === '1' || process.env.NODE_ENV === 'development';
  const enableVoice = process.env.NEXT_PUBLIC_VOICE_ENABLED === '1' || process.env.NODE_ENV === 'development';
  
  // Add avatar mode state with localStorage persistence
  const [avatarMode, setAvatarMode] = useState<'avatar' | 'voice'>('avatar');

  // Add hydration state to prevent layout shift
  const [isHydrated, setIsHydrated] = useState(false);
  
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

  // Add state for progressive speech
  const [streamingText, setStreamingText] = useState<string>("");
  const [hasStartedSpeaking, setHasStartedSpeaking] = useState(false);
  const streamingTextRef = useRef<string>("");
  const progressiveSpeechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
      const user = JSON.parse(localStorage.getItem("currentUser"));
      const response = await fetch(`/api/exercises/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.email,
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
      
      const solutionMessage = `💡 **Practice Solution**\n\n\`\`\`sql\n${result.solution}\n\`\`\`\n\nYou can try a new practice!`;
      appendMessage("assistant", solutionMessage);
    } catch (error) {
      console.error('Error getting solution:', error);
    }
  };

  // Load user points on component mount
  useEffect(() => {
    const loadUserPoints = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("currentUser"));
        if (user) {
          const response = await fetch(`/api/user-points?email=${encodeURIComponent(user.email)}`);
          const userPointsData = await response.json();
          setUserPoints(userPointsData.points || 0);
        }
      } catch (error) {
        console.error('Error loading user points:', error);
      }
    };

    loadUserPoints();
  }, []);

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarVisible(prev => !prev);
  };

  // Debounced speech function - only speaks after text has stopped changing
  // Speech is now handled by the avatar component, no need for separate debounced speech

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const triggerConversationAnalysis = useCallback(async (sessionId) => {
    try {
      const userId = JSON.parse(localStorage.getItem("currentUser"))?.email;
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
  }, []);


  useEffect(() => {
    let cUser = JSON.parse(localStorage.getItem("currentUser"));
    setCurrentUser(cUser["name"]);
    setCurrentBalance(Number(localStorage.getItem("currentBalance")));

    fetch(`/api/users/coins?status=1`).then(response => response.json())
    .then(data => setIsTokenBalanceVisible(data["status"] === "ON"))

  }, []);

  // Add this useEffect to load chat sessions when the component mounts
useEffect(() => {
  const loadChatSessions = () => {
    let cUser = JSON.parse(localStorage.getItem("currentUser"))
    fetch(`/api/chat/sessions?userId=${encodeURIComponent(cUser["email"])}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(response => response.json()).then(sessions => {
      setChatSessions(sessions);
    })    
  };

  loadChatSessions();
}, []);

  // Function to refresh chat sessions from server
  const refreshChatSessions = () => {
    let cUser = JSON.parse(localStorage.getItem("currentUser"))
    fetch(`/api/chat/sessions?userId=${encodeURIComponent(cUser["email"])}`, {
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
    const storedUser = localStorage.getItem("currentUser");
    setUser(JSON.parse(storedUser));
  }, []);

  // create a new threadID when chat component created
  useEffect(() => {
    const createThread = async () => {
      const res = await fetch(`/api/assistants/threads`, {
        method: "POST",
      });
      const data = await res.json();
      setThreadId(data.threadId);
    };
    createThread();
  }, []);

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

  const sendMessage = async (text) => { 
    setImageProcessing(true);
    
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
    
    // Message text is used as-is (SQL queries are now added directly by SqlQueryBuilder)
    let messageWithTags = text;

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
      let today = new Date().toISOString().slice(0, 10);
    if (!currentChatId) {
      // Trigger conversation analysis for the previous session if it exists
      const previousSessionId = localStorage.getItem('previousSessionId');
      if (previousSessionId) {
        triggerConversationAnalysis(previousSessionId);
      }
      
      fetch(`/api/chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ "title": text.substring(0, 30) + " (" + today + ")", "user": JSON.parse(localStorage.getItem("currentUser"))["email"]}),
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
            userId: JSON.parse(localStorage.getItem("currentUser"))["email"],
            message: text, // Save original text without tags
            role: 'user'
          }),
        });
      })
    }

    else {
      fetch(`/api/chat/sessions/${currentChatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: currentChatId,
          userId: JSON.parse(localStorage.getItem("currentUser"))["email"],
          message: text, // Save original text without tags
          role: 'user'
        }),
      });
    }
    
    // saveToDatabase(text, "user");
    const response = await fetch(
      `/api/assistants/threads/${threadId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content: messageWithTags, // Send message with tags to AI
          imageData: imageData, // Send image data if available
        }),
      }
    );
    const stream = AssistantStream.fromReadableStream(response.body);
    handleReadableStream(stream);

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

  const submitActionResult = async (runId, toolCallOutputs) => {
    const response = await fetch(
      `/api/assistants/threads/${threadId}/actions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          runId: runId,
          toolCallOutputs: toolCallOutputs,
        }),
      }
    );
    const stream = AssistantStream.fromReadableStream(response.body);
    handleReadableStream(stream);
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
      ? `${userInput}${userInput ? '\n' : ''}[Image attached: ${selectedImage.name}]`
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
      { role: "user", text: displayText, hasImage: !!selectedImage, feedback: null },
    ]);
    setUserInput("");
    setInputDisabled(true);
    setIsThinking(true);
    scrollToBottom();
  };

  /* Stream Event Handlers */

  // textCreated - create new assistant message
  const handleTextCreated = () => {
    setIsDone(false);
    setIsThinking(false); // Stop thinking when assistant starts responding
    setHasStartedSpeaking(false); // Reset for new message
    streamingTextRef.current = "";
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

  // imageFileDone - show image in chat
  const handleImageFileDone = (image) => {
    appendToLastMessage(`\n![${image.file_id}](/api/files/${image.file_id})\n`);
  }

  // toolCallCreated - log new tool call
  const toolCallCreated = (toolCall) => {
    if (toolCall.type != "code_interpreter") return;
    appendMessage("code", "");
  };

  // toolCallDelta - log delta and snapshot for the tool call
  const toolCallDelta = (delta, snapshot) => {
    if (delta.type != "code_interpreter") return;
    if (!delta.code_interpreter.input) return;
    appendToLastMessage(delta.code_interpreter.input);
  };

  // handleRequiresAction - handle function call
  const handleRequiresAction = async (
    event: AssistantStreamEvent.ThreadRunRequiresAction
  ) => {
    const runId = event.data.id;
    const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
    // loop over tool calls and call function handler
    const toolCallOutputs = await Promise.all(
      toolCalls.map(async (toolCall) => {
        const result = await functionCallHandler(toolCall);
        return { output: result, tool_call_id: toolCall.id };
      })
    );
    setInputDisabled(true);
    setIsThinking(true); // Set thinking when processing tool calls
    submitActionResult(runId, toolCallOutputs);
  };

  // handleRunCompleted - re-enable the input form
  const handleRunCompleted = () => {
    setInputDisabled(false);
    setIsThinking(false); // Stop thinking when run is completed
  };

   // New function to handle message changes
   const handleMessagesChange = useCallback(() => {
    if (!currentChatId) {
      return;
    }

    let msgs = messages.filter(msg => msg.role === "assistant")
    if (msgs.length > 0) {
        // Save the message to the server
        fetch(`/api/chat/sessions/${currentChatId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId: currentChatId,
            userId: JSON.parse(localStorage.getItem("currentUser"))["email"],
            message: msgs[msgs.length - 1].text,
            role: 'assistant'
          }),
        }); 
    }
  }, [currentChatId, messages]);

   // Use effect to watch for changes in messages
   useEffect(() => {
    handleMessagesChange();
  }, [isDone, handleMessagesChange]);


  const endStreamResponse = () => {
    setInputDisabled(false);
    setIsThinking(false);
    setIsDone(true);
    
    // Clear progressive speech timeout when stream ends
    if (progressiveSpeechTimeoutRef.current) {
      clearTimeout(progressiveSpeechTimeoutRef.current);
      progressiveSpeechTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      router.push('/login'); // Redirect to login if no user is found
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    setUser(null);
    router.push('/');
  };

  if (!user) {
    return null; // Or you could return a loading indicator here
  }

  const handleReadableStream = (stream: AssistantStream) => {
    // messages
    stream.on("textCreated", handleTextCreated);
    stream.on("textDelta", handleTextDelta);

    stream.on("end", endStreamResponse);

    // image
    stream.on("imageFileDone", handleImageFileDone);

    // code interpreter
    stream.on("toolCallCreated", toolCallCreated);
    stream.on("toolCallDelta", toolCallDelta);

    // events without helpers yet (e.g. requires_action and run.done)
    stream.on("event", (event) => {
      if (event.event === "thread.run.requires_action")
        handleRequiresAction(event);
      if (event.event === "thread.run.completed") handleRunCompleted();
    });
  };

  /*
    =======================
    === Utility Helpers ===
    =======================
  */

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

  const appendMessage = (role, text) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { role, text, feedback: null, hasImage: false },
    ]);
    
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

    fetch(`/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "chatId": currentChatId,
        "userId": JSON.parse(localStorage.getItem("currentUser"))["email"],
        "message": message.text,
        "feedback": message.feedback
      }),
    }); 
  }

  const openNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setLastAssistantMessage("");
    setLastSpokenMessageId(""); // Reset spoken message tracking
    setShouldSpeak(false);
    setIsAssistantMessageComplete(false);
    setHasStartedSpeaking(false); // Reset progressive speech state
    setStreamingText("");
    streamingTextRef.current = "";
    
    // Clear any pending progressive speech
    if (progressiveSpeechTimeoutRef.current) {
      clearTimeout(progressiveSpeechTimeoutRef.current);
      progressiveSpeechTimeoutRef.current = null;
    }
  }

return (
  <div className={`${styles.main} ${!sidebarVisible ? styles.mainFullWidth : ''}`}>
    {sidebarVisible && (
      <SidebarEnglish 
        chatSessions={chatSessions} 
        onChatSelect={loadChatMessages} 
        handleLogout={handleLogout} 
        onNewChat={openNewChat} 
        currentUser={currentUser}
        onToggleSidebar={toggleSidebar}
      />
    )}
         <div className={`${styles.container} ${!sidebarVisible ? styles.containerFullWidth : ''}`}>
      {!sidebarVisible && (
        <button
          className={styles.openSidebarButton}
          onClick={toggleSidebar}
          title="Open Sidebar"
          aria-label="Open Sidebar"
        >
          ☰
        </button>
      )}
      <div className={styles.chatContainer}>
        <div className={styles.messages} style={{direction:"ltr"}}>
          {loadingMessages ? (
            <div className={styles.loadingIndicator}></div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <Message
                  key={index}
                  role={msg.role}
                  text={msg.text}
                  feedback={msg.feedback}
                  hasImage={msg.hasImage}
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
              ))}
              {inputDisabled && (
                <div className={styles.assistantMessage}>
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
          style={{direction:"ltr"}}
          className={`${styles.inputForm} ${styles.clearfix}`}
        >
          <div className={`${styles.inputContainer} ${isExerciseMode ? styles.exerciseMode : ''}`}>
            {/* Added for query cost estimation: Shows estimated cost while typing */}
            {userInput && isTokenBalanceVisible && (
              <div className={styles.costPopup}>
                Query cost: ${estimatedCost.toFixed(2)}
              </div>
            )}
            

            <textarea
              className={styles.input}
              value={userInput}
              onChange={(e) => {
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
                  ? "Type your SQL answer here..." 
                  : "Type here..."
              }
              style={{
                paddingTop: '16px',
                paddingLeft: '20px',
                paddingBottom: '16px',
                paddingRight: '50px'
              }}
            />
            
            {/* Send Button - Removed for demo */}

            {/* Action Buttons Row */}
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
                title="Open options"
                aria-haspopup="true"
                aria-expanded={isActionMenuOpen}
              >
                <span className={styles.actionMenuIcon}>➕️</span>
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
                    title="Get new SQL practice"
                    role="menuitem"
                  >
                    <span className={styles.actionMenuItemIcon}>⭐️</span>
                    <span className={styles.actionMenuItemText}>SQL Practice</span>
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
                    <span className={styles.actionMenuItemIcon}>📎</span>
                    <span className={styles.actionMenuItemText}>Attach image</span>
                  </button>

                  <button
                    type="button"
                    className={styles.actionMenuItem}
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      setSqlBuilderOpen(true);
                    }}
                    title="Build SQL query"
                    role="menuitem"
                  >
                    <span className={styles.actionMenuItemIcon}>🧩</span>
                    <span className={styles.actionMenuItemText}>SQL Builder</span>
                  </button>

                  <button
                    type="button"
                    className={styles.actionMenuItem}
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      router.push('/visualizer');
                    }}
                    title="Visualize query"
                    role="menuitem"
                  >
                    <span className={styles.actionMenuItemIcon}>📊</span>
                    <span className={styles.actionMenuItemText}>Visualize query</span>
                  </button>
                </div>
              )}
            </div>



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
                Query Editor
              </button> */}
    </div>
    {/* {balanceError && (
  <div className={styles.balanceError}>
    No enough tokens
  </div>
)} */}
    
    {/* AVATAR TEMPORARILY DISABLED - Commented out to prevent crashes */}
    {/* Avatar section completely removed to fix build errors */}
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
          title="Close practice"
        >
          ×
        </button>
        <div className={styles.exerciseHeader}>
          <h2>🎓 SQL Practice</h2>
          {userPoints > 0 && (
            <div className={styles.pointsIndicator}>
              {userPoints} points
            </div>
          )}
        </div>
        
        {currentExercise && (
          <>
            <div className={styles.exerciseContent}>
              <div className={styles.exerciseDifficulty}>
                Difficulty level: {currentExercise.difficulty === 'easy' ? 'Easy' : currentExercise.difficulty === 'medium' ? 'Medium' : 'Hard'} 
                ({currentExercise.points} points)
              </div>
              
              <div className={styles.exerciseQuestion}>
                {currentExercise.question}
              </div>
              
              <div className={styles.exerciseSqlEditor}>
                <textarea
                  className={styles.exerciseTextarea}
                  value={exerciseAnswer}
                  onChange={(e) => setExerciseAnswer(e.target.value)}
                  placeholder="Type your SQL query here..."
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
                  Submit Answer
                </button>
                
                {showSolutionButton && (
                  <button
                    className={styles.showSolutionButton}
                    onClick={showSolution}
                  >
                    Show Solution
                  </button>
                )}
              </div>
              
              {exerciseAttempts > 0 && (
                <div className={styles.exerciseFeedback}>
                  Almost! Try checking if you missed something in the query.
                  {exerciseAttempts >= 2 && " You can see the solution in the button above."}
                </div>
              )}
            </div>
          </>
        )}
        {!currentExercise && (
          <div className={styles.exerciseContent} style={{ textAlign: 'center', padding: '24px', width: '100%' }}>
            Coming soon...
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
            <h3 className={styles.disclaimerTitle}>Please Note</h3>
            <p className={styles.disclaimerText}>
              Michael can generate questions and answers that are not included in the studied material
            </p>
            <div className={styles.disclaimerActions}>
              <button
                className={styles.disclaimerCancelButton}
                onClick={handleDisclaimerCancel}
              >
                Cancel
              </button>
              <button
                className={styles.disclaimerConfirmButton}
                onClick={handleDisclaimerConfirm}
              >
                I agree, start practice
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

export default ChatEnglish;
