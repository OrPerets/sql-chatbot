'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Chat from './chat';
import AvatarInteractionManager from './AvatarInteractionManager';
import { MichaelAvatarDirectRef } from './MichaelAvatarDirect';
import { analyzeMessage, extractSQLKeywords } from '../utils/sql-query-analyzer';
import { avatarAnalytics } from '../utils/avatar-analytics';

interface EnhancedChatWithAvatarProps {
  chatId?: string | null;
  enableAvatarInteractions?: boolean;
  enableSQLGestureMapping?: boolean;
  enableAnalytics?: boolean;
}

const EnhancedChatWithAvatar: React.FC<EnhancedChatWithAvatarProps> = ({
  chatId = null,
  enableAvatarInteractions = true,
  enableSQLGestureMapping = true,
  enableAnalytics = true,
}) => {
  const avatarRef = useRef<MichaelAvatarDirectRef>(null);
  const interactionManagerRef = useRef<any>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string>('');
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string>('');
  const [isProcessingMessage, setIsProcessingMessage] = useState(false);

  // Get current user from localStorage
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      try {
        const userObj = JSON.parse(user);
        setCurrentUser(userObj.email || userObj.name || 'anonymous');
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
        setCurrentUser('anonymous');
      }
    }
  }, []);

  // Track user message for gesture analysis
  const handleUserMessage = useCallback((message: string) => {
    if (!message || !enableAvatarInteractions) return;

    setLastUserMessage(message);
    setIsProcessingMessage(true);

    // Analyze message for SQL content and appropriate gestures
    if (enableSQLGestureMapping && message.trim()) {
      const analysis = analyzeMessage(message);
      const { recommendedGesture, confidence, sqlAnalysis } = analysis;

      console.log('🔍 Message Analysis:', {
        message: message.substring(0, 50) + '...',
        recommendedGesture,
        confidence,
        sqlKeywords: sqlAnalysis.keywords,
        complexity: sqlAnalysis.complexity,
      });

      // Track analytics
      if (enableAnalytics && currentUser) {
        avatarAnalytics.trackSQLQuery(
          sqlAnalysis.keywords,
          message,
          currentUser
        );
      }

      // Trigger gesture if confidence is high enough
      if (confidence > 0.6 && avatarRef.current) {
        // Use queue system for better gesture management
        const priority = sqlAnalysis.complexity === 'complex' ? 'high' : 'normal';
        avatarRef.current.queueGesture(recommendedGesture, 2, false, 1000, priority);
        
        console.log(`🎭 Queued gesture: ${recommendedGesture} (confidence: ${confidence.toFixed(2)}, priority: ${priority})`);
      }
    }

    setIsProcessingMessage(false);
  }, [enableAvatarInteractions, enableSQLGestureMapping, enableAnalytics, currentUser]);

  // Handle assistant response for contextual gestures
  const handleAssistantResponse = useCallback((response: string) => {
    if (!response || !enableAvatarInteractions) return;

    setLastAssistantMessage(response);

    // Analyze assistant response for success/error indicators
    const lowerResponse = response.toLowerCase();
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
      avatarRef.current.queueGesture(gesture, 2, false, 1000, priority);
      console.log(`🎭 Assistant response gesture: ${gesture} (priority: ${priority})`);
    }

    // Track analytics
    if (enableAnalytics && currentUser) {
      avatarAnalytics.trackGesture(gesture, 'assistant_response', currentUser);
    }
  }, [enableAvatarInteractions, enableAnalytics, currentUser]);

  // Handle avatar interaction events
  const handleAvatarInteraction = useCallback((gesture: string, context: any) => {
    console.log('🎭 Avatar interaction:', { gesture, context });

    // Track analytics
    if (enableAnalytics && currentUser) {
      avatarAnalytics.trackGesture(gesture, context.type, currentUser);
    }

    // Add contextual feedback based on interaction type
    if (context.type === 'click' || context.type === 'touch') {
      // User clicked/touched avatar - could trigger helpful response
      console.log('👆 User interacted with avatar');
    } else if (context.type === 'hover') {
      // User hovered over avatar - subtle interaction
      console.log('👀 User hovered over avatar');
    } else if (context.type === 'sql_query') {
      // SQL-related gesture was triggered
      console.log('📊 SQL-related gesture triggered:', context.sqlKeywords);
    }
  }, [enableAnalytics, currentUser]);

  // Handle interaction analytics
  const handleInteractionAnalytics = useCallback((analytics: any) => {
    if (enableAnalytics) {
      console.log('📊 Avatar Interaction Analytics:', analytics);
      // Could send to server or store in local analytics
    }
  }, [enableAnalytics]);

  // Monitor messages for gesture triggers
  useEffect(() => {
    // This effect will be triggered when messages change
    // The actual message monitoring will be done through the Chat component's props
  }, []);

  // Get user's interaction profile for personalized gestures
  const getUserInteractionProfile = useCallback(() => {
    if (!currentUser || !enableAnalytics) return null;
    return avatarAnalytics.getUserProfile(currentUser);
  }, [currentUser, enableAnalytics]);

  // Get recommended gesture based on user profile
  const getRecommendedGesture = useCallback((context?: string) => {
    if (!currentUser || !enableAnalytics) return 'ok';
    return avatarAnalytics.getRecommendedGesture(currentUser, context);
  }, [currentUser, enableAnalytics]);

  return (
    <div className="enhanced-chat-with-avatar">
      <Chat 
        chatId={chatId}
        onUserMessage={handleUserMessage}
        onAssistantResponse={handleAssistantResponse}
        functionCallHandler={async (toolCall) => {
          try {
            const name = toolCall.function.name;
            let params: any = {};
            try {
              params = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
            } catch (e) {
              console.warn('Failed to parse tool call arguments, using empty object');
              params = {};
            }

            const isCourseContext = name === 'get_course_week_context' || name === 'list_course_week_summaries';
            const isSQL = name === 'execute_sql_query' || name === 'get_database_schema' || name === 'analyze_query_performance';

            const endpoint = isCourseContext
              ? '/api/assistants/functions/course-context'
              : isSQL
                ? '/api/assistants/functions/sql'
                : null;

            if (!endpoint) {
              return JSON.stringify({ error: `Unknown function: ${name}` });
            }

            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ functionName: name, parameters: params }),
            });
            // The backend returns JSON; the Assistants API expects a string output
            const text = await res.text();
            return text;
          } catch (err: any) {
            console.error('functionCallHandler error:', err);
            return JSON.stringify({ error: err?.message || 'Function call failed' });
          }
        }}
      />
      
      {/* Avatar interaction debug info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 1000,
          maxWidth: '300px',
        }}>
          <div><strong>Avatar Interaction Debug</strong></div>
          <div>User: {currentUser || 'Not logged in'}</div>
          <div>Processing: {isProcessingMessage ? 'Yes' : 'No'}</div>
          <div>Last User Message: {lastUserMessage.substring(0, 30)}...</div>
          <div>Last Assistant: {lastAssistantMessage.substring(0, 30)}...</div>
          {enableAnalytics && currentUser && (
            <div>
              <div>Profile: {getUserInteractionProfile()?.preferences.interactionStyle || 'unknown'}</div>
              <div>Recommended: {getRecommendedGesture()}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedChatWithAvatar;
