"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./chat.module.css";
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

export const maxDuration = 50;

const SERVER_BASE = config.serverUrl;

const SAVE = SERVER_BASE + "/save"
const UPDATE_BALANCE = SERVER_BASE + "/updateBalance"  // New endpoint for feedback

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
  feedback: "like" | "dislike" | null;
  onFeedback?: (feedback: "like" | "dislike" | null) => void;
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
const AssistantMessage = ({ text, feedback, onFeedback }: { text: string; feedback: "like" | "dislike" | null; onFeedback?: (feedback: "like" | "dislike" | null) => void }) => {
  const [activeFeedback, setActiveFeedback] = useState(feedback);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [copied, setCopied] = useState(false);  // Tooltip state
  const [copiedText, setCopiedText] =  useState("העתק שאילתה")


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

const Message = ({ role, text, feedback, onFeedback }: MessageProps) => {
  switch (role) {
    case "user":
      return <UserMessage text={text} />;
    case "assistant":
      return <AssistantMessage text={text} feedback={feedback} onFeedback={onFeedback} />;
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

  const sendMessage = async (text) => { 
    // Add SQL tags based on mode
    let messageWithTags = text;
    if (sqlMode === 'create') {
      messageWithTags = `<create_table>${text}`;
    } else if (sqlMode === 'insert') {
      messageWithTags = `<insert_values>${text}`;
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
        }),
      }
    );
    const stream = AssistantStream.fromReadableStream(response.body);
    handleReadableStream(stream);

    // Reset SQL mode after sending
    setSqlMode('none');

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
    if (!userInput.trim()) return;
    sendMessage(userInput);
    // Always show the user message in the UI, regardless of balance
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", text: userInput },
    ]);
    setUserInput("");
    setInputDisabled(true);
    scrollToBottom();
  };

  /* Stream Event Handlers */

  // textCreated - create new assistant message
  const handleTextCreated = () => {
    setIsDone(false)
    appendMessage("assistant", "");
  };

  // textDelta - append text to last assistant message
  const handleTextDelta = (delta) => {
    if (delta.value != null) {
      appendToLastMessage(delta.value);
    };
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
    submitActionResult(runId, toolCallOutputs);
  };

  // handleRunCompleted - re-enable the input form
  const handleRunCompleted = () => {
    setInputDisabled(false);
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
    setIsDone(true)
  }

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
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
  };

  const appendMessage = (role, text) => {
    setMessages((prevMessages) => [...prevMessages, { role, text }]);
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
  }

return (
  <div className={styles.main}>
    
    <Sidebar chatSessions={chatSessions} onChatSelect={loadChatMessages} handleLogout={handleLogout} onNewChat={openNewChat} currentUser={currentUser}/>
    <div className={styles.container}>
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
                  onFeedback={msg.role === 'assistant' ? (isLike) => handleFeedback(isLike, index) : undefined}
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
          <div className={styles.inputContainer}>
            {/* Added for query cost estimation: Shows estimated cost while typing */}
            {userInput && isTokenBalanceVisible && (
              <div className={styles.costPopup}>
                עלות השאילתה: ₪{estimatedCost.toFixed(2)}
              </div>
            )}
            
            {/* SQL Mode Button */}
            <button
              type="button"
              onClick={toggleSqlMode}
              className={styles.sqlModeButton}
              style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                padding: '6px 12px',
                backgroundColor: getSqlModeColor(),
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                zIndex: 1000,
                transition: 'background-color 0.2s ease'
              }}
              title="לחץ כדי לעבור בין מצבי CREATE TABLE ו-INSERT VALUES"
            >
              {getSqlModeLabel()}
            </button>

            {/* SQL Mode Indicator in textarea */}
            {sqlMode !== 'none' && (
              <div style={{
                position: 'absolute',
                top: '15px',
                right: '20px',
                color: getSqlModeColor(),
                fontSize: '12px',
                fontWeight: 'bold',
                zIndex: 999,
                pointerEvents: 'none'
              }}>
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
              placeholder={sqlMode !== 'none' ? `מצב ${getSqlModeLabel()} פעיל - הקלד את השאילתה שלך...` : "הקלד כאן..."}
              style={{
                height: sqlMode !== 'none' ? "80px" : "55px", // Increase height when SQL mode is active
                minHeight: sqlMode !== 'none' ? "80px" : "55px", // Increase minimum height as well
                resize: "none",
                overflowY: "hidden",
                paddingTop: sqlMode !== 'none' ? '35px' : '15px', // Add top padding when SQL mode is active
                paddingRight: sqlMode !== 'none' ? '220px' : '20px' // Add right padding for the indicator
              }}
            />
          </div>
          <button // Button is now *outside* the inputContainer
            type="submit"
            className={styles.button}
            disabled={inputDisabled}
            style={{
              width: "40px",
              height: "40px", // Fixed height (adjust as needed)
              // marginTop: "0.5%",
              // Consider adding other positioning styles as necessary, e.g.,
              position: "relative", // Or "relative" depending on your layout
              bottom: 10, // Example position
              left: "50px",
              right: "10px",  // Example position
            }}
          >
            	<svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 4 28 25"
    fill="none"
    stroke="white"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={styles.arrowIcon}
  >
    <path d="M15 30V9M8 12l7-7 7 7" />
    </svg>
    
          </button>
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
        <img className="logo" src="/bot.png" alt="Mik Logo" style={{width: "100px", height: "100px"}}/>
        {/* Moved user info below the avatar */}
        <div className={styles.userInfo}>
          <div className={styles.nickname}>
            היי {currentUser}
            {isTokenBalanceVisible && (
            <div>
              יתרה נוכחית: ₪{currentBalance}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
    <Modal isOpen={showModal} onClose={toggleModal}>
        <SQLQueryEditorComponent toggleModal={toggleModal} />
      </Modal>
  </div>
);
};

export default Chat;
