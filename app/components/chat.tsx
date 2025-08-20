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
import Sidebar from './sidebar';
import { useRouter } from 'next/navigation';
import config from "../config";
import Modal from "./modal";
import SQLQueryEditorComponent from "./query-vizualizer";
import ImageUpload from "./image-upload";
import { fileToBase64 } from "../utils/parseImage";
import AudioRecorder from "./audio-recorder";
import MichaelAvatarDirect from "./MichaelAvatarDirect";
import { simpleTTS } from "../utils/simpleTTS";
import { enhancedTTS } from "@/app/utils/enhanced-tts";
import OpenAI from "openai";

export const maxDuration = 50;

const SERVER_BASE = config.serverUrl;

const SAVE = SERVER_BASE + "/save"
const UPDATE_BALANCE = SERVER_BASE + "/updateBalance"  // New endpoint for feedback

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
  const [copiedText, setCopiedText] =  useState("העתק שאילתה")
  const [playTooltipText, setPlayTooltipText] = useState("השמע הודעה זו");


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
      autoPlaySpeech
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
  code: ({ node, inline, className, children, ...props }) => {
    if (className === "language-sql") {
      const code = Array.isArray(children) ? children.join("") : children;

      return (
        <div className={styles.sqlCodeContainer}> {/* Container for code and button */}
          <pre className={styles.sqlCode}><code className={styles.sqlCode} onClick={() => {
            copyToClipboard(code)
            setCopiedText("הועתק בהצלחה")
          }}>{code}</code></pre>
          
          {copied && <div className={styles.tooltip}>{copiedText}</div>}
        </div>
      );
    }
    return <code className={className} {...props}>{children}</code>;
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
        setCopiedText("הועתק בהצלחה");
        setTimeout(() => {
          setCopiedText("העתק שאילתה");
        }, 3000);
      })
      .catch((error) => {
        console.error("Failed to copy:", error);
      });
};
  return (
    <div className={styles.assistantMessage}>
      <Markdown>{text}</Markdown>
      {/* <Markdown components={renderers} >{text}</Markdown> */}
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
};

const Chat = ({
  functionCallHandler = () => Promise.resolve(""), // default to return empty string
  chatId: initialChatId
}: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [threadId, setThreadId] = useState("");
  const [user, setUser] = useState(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [currentUser, setCurrectUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  // Added for query cost estimation feature
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [balanceError, setBalanceError] = useState(false);
  const [isTokenBalanceVisible, setIsTokenBalanceVisible] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false); // Add loading state
  // Add SQL mode state
  const [sqlMode, setSqlMode] = useState<'none' | 'create' | 'insert'>('none');
  // Add audio and speech state
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string>("");
  const [autoPlaySpeech, setAutoPlaySpeech] = useState(false);
  const enableAvatar = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_AVATAR_ENABLED === '1';
  const enableVoice = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_VOICE_ENABLED === '1';
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
  }, [isThinking, isRecording, shouldSpeak, isAssistantMessageComplete, isUserTyping, lastAssistantMessage?.length, enableAvatar, enableVoice]);

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

  // Function to cycle through SQL modes
  const toggleSqlMode = () => {
    setSqlMode(prev => {
      switch (prev) {
        case 'none': return 'create';
        case 'create': return 'insert';
        case 'insert': return 'none';
        default: return 'none';
      }
    });
  };

  // Get SQL mode label for button
  const getSqlModeLabel = () => {
    switch (sqlMode) {
      case 'create': return 'CREATE TABLE';
      case 'insert': return 'INSERT VALUES';
      default: return 'CREATE / INSERT';
    }
  };

  // Get SQL mode color for button
  const getSqlModeColor = () => {
    switch (sqlMode) {
      case 'create': return '#4CAF50'; // Green
      case 'insert': return '#2196F3'; // Blue
      default: return '#757575'; // Gray
    }
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
    try {
      const user = JSON.parse(localStorage.getItem("currentUser"));
      const response = await fetch(`${SERVER_BASE}/getRandomExercise/${user.email}`);
      const exercise = await response.json();
      
      setCurrentExercise(exercise);
      setIsExerciseMode(true);
      setShowSolutionButton(false);
      setExerciseAttempts(0);
      setExerciseAnswer("");
      setShowExerciseModal(true);
      

    } catch (error) {
      console.error('Error starting exercise:', error);
      appendMessage("assistant", "❌ שגיאה בטעינת התרגול. נסה שוב מאוחר יותר.");
    }
  };

  const submitExerciseAnswer = async () => {
    if (!currentExercise || !exerciseAnswer.trim()) return;

    try {
      const user = JSON.parse(localStorage.getItem("currentUser"));
      const response = await fetch(`${SERVER_BASE}/submitExerciseAnswer`, {
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
      const response = await fetch(`${SERVER_BASE}/getExerciseSolution/${currentExercise.id}`);
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
        const user = JSON.parse(localStorage.getItem("currentUser"));
        if (user) {
          const response = await fetch(`${SERVER_BASE}/getUserPoints/${user.email}`);
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


  useEffect(() => {
    let cUser = JSON.parse(localStorage.getItem("currentUser"));
    setCurrectUser(cUser["name"]);
    setCurrentBalance(Number(localStorage.getItem("currentBalance")));

    fetch(`${SERVER_BASE}/getCoinsStatus`).then(response => response.json())
    .then(data => setIsTokenBalanceVisible(data["status"] === "ON"))

  }, []);

  // Add this useEffect to load chat sessions when the component mounts
useEffect(() => {
  const loadChatSessions = () => {
    let cUser = JSON.parse(localStorage.getItem("currentUser"))
    fetch(`${SERVER_BASE}/chat-sessions/${cUser["email"]}`, {
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
  const response = await fetch(UPDATE_BALANCE, {
    method: 'POST',
    mode: 'cors',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      "email": user.email,
      "currentBalance": value
    })
  });
  if (response.ok) {
  } else {
  }
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
      simpleTTS.stop();
      
      // Clear typing detection timeout
      if (userTypingTimeoutRef.current) {
        clearTimeout(userTypingTimeoutRef.current);
      }
    };
  }, []);

  // Modified useEffect for progressive speech
  useEffect(() => {
    const messageId = lastAssistantMessage?.substring(0, 50) || "";
    
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

    // Progressive speech: Start speaking when we have enough content (instead of waiting for completion)
    if (autoPlaySpeech && lastAssistantMessage && lastAssistantMessage.length > 50 && !hasStartedSpeaking && lastSpokenMessageId !== messageId) {
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

  }, [lastAssistantMessage, isDone, autoPlaySpeech, shouldSpeak, lastSpokenMessageId, hasStartedSpeaking, isManualSpeech]);

  const sendMessage = async (text) => { 
    setImageProcessing(true);
    
    // Add SQL tags based on mode
    let messageWithTags = text;
    if (sqlMode === 'create') {
      messageWithTags = `<create_table>${text}`;
    } else if (sqlMode === 'insert') {
      messageWithTags = `<insert_values>${text}`;
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
      let today = new Date().toISOString().slice(0, 10);
    if (!currentChatId) {
      fetch(`${SERVER_BASE}/chat-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ "title": text.substring(0, 30) + " (" + today + ")", "user": JSON.parse(localStorage.getItem("currentUser"))["email"]}),
      }).then(response => response.json()).then(newChat => {
        setCurrentChatId(newChat.id);
        setChatSessions([...chatSessions, newChat]);
        // Save the message to the server (save original text without tags)
        fetch(`${SERVER_BASE}/chat-sessions/${newChat.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId: newChat.id,
            userId: JSON.parse(localStorage.getItem("currentUser"))["email"],
            message: text, // Save original text without tags
            role: 'user'
          }),
        });
      })
    }

    else {
      fetch(`${SERVER_BASE}/chat-sessions/${currentChatId}/messages`, {
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

    // Reset SQL mode and image after sending
    setSqlMode('none');
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
  
  fetch(`${SERVER_BASE}/chat-sessions/${chatId}/messages`, {
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
    let msgs = messages.filter(msg => msg.role === "assistant")
    if (msgs.length > 0) {
        // Save the message to the server
        fetch(`${SERVER_BASE}/chat-sessions/${currentChatId}/messages`, {
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
  }, [isDone]);

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
    setMessages((prevMessages) => [...prevMessages, { role, text }]);
    
    // Track last assistant message for speech synthesis
    if (role === 'assistant') {
      setLastAssistantMessage(text);
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

    fetch(`${SERVER_BASE}/saveFeedback`, {
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
  <div className={styles.main}>
    {sidebarVisible && (
      <Sidebar 
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
          title="פתח צד"
          aria-label="Open Sidebar"
        >
          ☰
        </button>
      )}
      <div className={styles.chatContainer}>
        <div className={styles.messages} style={{direction:"rtl"}}>
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
                    console.log('🎤 Playing individual message:', msg.text.substring(0, 50) + '...');
                    if (!enableVoice) return;
                    // Stop any current speech
                    enhancedTTS.stop();
                    // Reset speech states first
                    setShouldSpeak(false);
                    setIsAssistantMessageComplete(false);
                    setHasStartedSpeaking(false);
                    
                    // Use setTimeout to ensure state changes are processed
                    setTimeout(() => {
                      // Set the text to the avatar for speaking
                      setLastAssistantMessage(msg.text);
                      setShouldSpeak(true);
                      setIsAssistantMessageComplete(true);
                      setHasStartedSpeaking(true);
                      setIsManualSpeech(true);  // Mark as manual speech
                      // Clear thinking state
                      setIsThinking(false);
                      // Force avatar to speaking state by temporarily setting a speaking message ID
                      setLastSpokenMessageId(Date.now().toString());  // Use unique ID to force re-trigger
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
            
            {/* SQL Mode Indicator in textarea */}
            {sqlMode !== 'none' && (
              <div className={styles.sqlModeIndicator}>
                מצב {sqlMode === 'create' ? 'CREATE TABLE' : 'INSERT VALUES'} פעיל
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
                  ? "הקלד את תשובת ה-SQL שלך כאן..." 
                  : sqlMode !== 'none' 
                    ? `מצב ${getSqlModeLabel()} פעיל - הקלד את השאילתה שלך...` 
                    : "הקלד כאן..."
              }
              style={{
                paddingTop: sqlMode !== 'none' ? '35px' : '16px',
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
            <div className={styles.actionButtons}>
              {/* Audio Recorder */}
              {enableVoice && (
                <AudioRecorder
                  onTranscription={handleAudioTranscription}
                  disabled={inputDisabled || imageProcessing}
                  onRecordingStateChange={setIsRecording}
                />
              )}


              {/* Exercise Button */}
              <button
                type="button"
                className={`${styles.actionButton} ${styles.exerciseActionButton} ${isExerciseMode ? styles.actionButtonActive : ''}`}
                onClick={startExercise}
                disabled={inputDisabled}
                title="קבל תרגול SQL חדש"
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
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                {/* <span className={styles.actionButtonText}>תרגול</span> */}
              </button>

              {/* Attachment Button */}
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => document.getElementById('imageInput')?.click()}
                disabled={inputDisabled || imageProcessing}
                title="Attach image"
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
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"/>
                </svg>
                {selectedImage && <span className={styles.attachmentDot}></span>}
              </button>

              {/* CREATE/INSERT Mode Button */}
              <button
                type="button"
                className={`${styles.actionButton} ${sqlMode !== 'none' ? styles.actionButtonActive : ''}`}
                onClick={toggleSqlMode}
                title="לחץ כדי לעבור בין מצבי CREATE TABLE ו-INSERT VALUES"
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
                  <path d="M12 3v18M3 12h18"/>
                </svg>
                <span className={styles.actionButtonText}>
                  {sqlMode === 'create' ? 'CREATE' : sqlMode === 'insert' ? 'INSERT' : 'SQL'}
                </span>
              </button>

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
                עורך שאילתות
              </button> */}
    </div>
    {/* {balanceError && (
  <div className={styles.balanceError}>
    No enough tokens
  </div>
)} */}
    
    <div className={styles.rightColumn}>
      <div className={styles.avatarSection}>
        {enableAvatar ? (
        <MichaelAvatarDirect
          text={lastAssistantMessage}
          state={avatarState}
          size="medium"
          progressiveMode={enableVoice}
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
            setIsManualSpeech(false);  // Reset manual speech flag
          }}
        />
        ) : null}
        
        {/* User info below the avatar */}
        <div className={styles.userInfo}>
          <div className={styles.nickname}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', }}>
              <span>היי {currentUser}</span>
              <button
                className={`${styles.audioToggle} ${autoPlaySpeech ? styles.audioToggleOn : styles.audioToggleOff}`}
                onClick={() => enableVoice && setAutoPlaySpeech(!autoPlaySpeech)}
                title={autoPlaySpeech ? "השבת קול אוטומטי" : "הפעל קול אוטומטי"}
              >
                {autoPlaySpeech ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="23" y1="9" x2="17" y2="15"></line>
                    <line x1="17" y1="9" x2="23" y2="15"></line>
                  </svg>
                )}
              </button>

            </div>
            {isTokenBalanceVisible && (
            <div>
              יתרה נוכחית: ₪{currentBalance}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
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
  </div>
);
};

export default Chat;
