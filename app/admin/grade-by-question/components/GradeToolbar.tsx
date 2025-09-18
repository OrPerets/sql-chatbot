"use client";

import React, { memo, useState, useCallback } from 'react';
import { MessageSquare, Plus, Trash2, Edit3, Save } from 'lucide-react';
import { useGradeByQuestion, CommentBankEntry } from '../contexts/GradeByQuestionContext';
import styles from '../page.module.css';

// Utility functions for comment handling
const encodePointsInFeedback = (feedback: string, reducedPoints: number): string => {
  if (reducedPoints > 0) {
    return `${feedback}\n[REDUCE_POINTS:${reducedPoints}]`;
  }
  return feedback;
};

const decodePointsFromFeedback = (feedback: string): { feedback: string, reducedPoints: number } => {
  const pointsMatch = feedback.match(/\[REDUCE_POINTS:(\d+(\.\d+)?)\]/);
  if (pointsMatch) {
    const reducedPoints = parseFloat(pointsMatch[1]);
    const cleanFeedback = feedback.replace(/\[REDUCE_POINTS:\d+(\.\d+)?\]/, '').trim();
    return { feedback: cleanFeedback, reducedPoints };
  }
  return { feedback, reducedPoints: 0 };
};

const getCommentReducedPoints = (comment: CommentBankEntry): number => {
  if (comment.reduced_points !== undefined) {
    return comment.reduced_points;
  }
  const { reducedPoints } = decodePointsFromFeedback(comment.feedback);
  return reducedPoints;
};

const getCommentDisplayFeedback = (comment: CommentBankEntry): string => {
  const { feedback } = decodePointsFromFeedback(comment.feedback);
  return feedback;
};

// Add New Comment Component
const AddNewComment = memo(() => {
  const { state, fetchCommentBank, showMessage } = useGradeByQuestion();
  const [newComment, setNewComment] = useState({ 
    text: '', 
    reduced_points: 0, 
    tag: '' as 'positive' | 'negative' | '' 
  });

  const addCommentToBank = useCallback(async () => {
    if (!newComment.text || !state.selectedQuestion) return;

    const encodedFeedback = encodePointsInFeedback(newComment.text, newComment.reduced_points);

    const commentData = {
      questionId: state.selectedQuestion.question.id,
      questionText: state.selectedQuestion.question.question,
      difficulty: state.selectedQuestion.question.difficulty,
      score: state.currentGrade,
      maxScore: state.selectedQuestion.question.points,
      feedback: encodedFeedback,
      reduced_points: newComment.reduced_points,
      tag: newComment.tag || undefined,
      gradedBy: 'admin'
    };

    try {
      const response = await fetch('/api/admin/comment-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });

      if (!response.ok) throw new Error('Failed to save comment');
      
      await fetchCommentBank(state.selectedQuestion.question.id);
      setNewComment({ text: '', reduced_points: 0, tag: '' });
      
      showMessage('הערה נוספה לבנק ההערות', 'success');
    } catch (err) {
      console.error('Error adding comment:', err);
      showMessage('שגיאה בהוספת הערה', 'error');
    }
  }, [newComment, state.selectedQuestion, state.currentGrade, fetchCommentBank, showMessage]);

  if (!state.selectedQuestion) return null;

  return (
    <div className={styles.addCommentSection}>
      <h4>הוסף הערה חדשה</h4>
      <textarea
        value={newComment.text}
        onChange={(e) => setNewComment({...newComment, text: e.target.value})}
        placeholder="הקלד הערה..."
        className={styles.newCommentInput}
        rows={3}
      />
      <div className={styles.commentOptions}>
        <div className={styles.pointsInput}>
          <label>נקודות לקיזוז:</label>
          <input
            type="number"
            min="0"
            max={state.selectedQuestion.question.points}
            value={newComment.reduced_points}
            onChange={(e) => setNewComment({...newComment, reduced_points: Number(e.target.value)})}
            className={styles.pointsField}
          />
        </div>
        <div className={styles.tagSelect}>
          <label>תג:</label>
          <select
            value={newComment.tag}
            onChange={(e) => setNewComment({...newComment, tag: e.target.value as 'positive' | 'negative' | ''})}
            className={styles.tagField}
          >
            <option value="">ללא תג</option>
            <option value="positive">✅ חיובי</option>
            <option value="negative">❌ שלילי</option>
          </select>
        </div>
      </div>
      <button 
        onClick={addCommentToBank}
        disabled={!newComment.text.trim()}
        className={styles.addCommentBtn}
      >
        <Plus size={16} />
        הוסף לבנק
      </button>
    </div>
  );
});

AddNewComment.displayName = 'AddNewComment';

// Comment Item Component
const CommentItem = memo(({ 
  comment, 
  onApply, 
  onEdit, 
  onDelete, 
  onRate,
  editingComment,
  onSaveEdit,
  onCancelEdit,
  onUpdateEdit
}: {
  comment: CommentBankEntry;
  onApply: (comment: CommentBankEntry) => void;
  onEdit: (comment: CommentBankEntry) => void;
  onDelete: (commentId: string) => void;
  onRate: (commentId: string, rating: 'like' | 'dislike') => void;
  editingComment: CommentBankEntry | null;
  onSaveEdit: (comment: CommentBankEntry) => void;
  onCancelEdit: () => void;
  onUpdateEdit: (updates: Partial<CommentBankEntry>) => void;
}) => {
  const isEditing = editingComment?._id === comment._id;

  if (isEditing) {
    return (
      <div className={styles.commentItem}>
        <div className={styles.editingComment}>
          <textarea
            value={editingComment.feedback}
            onChange={(e) => onUpdateEdit({ feedback: e.target.value })}
            className={styles.editCommentInput}
            rows={2}
          />
          <div className={styles.editCommentOptions}>
            <input
              type="number"
              min="0"
              value={editingComment.reduced_points || 0}
              onChange={(e) => onUpdateEdit({ reduced_points: Number(e.target.value) })}
              className={styles.editPointsField}
            />
            <select
              value={editingComment.tag || ''}
              onChange={(e) => onUpdateEdit({ tag: e.target.value as 'positive' | 'negative' | undefined })}
              className={styles.editTagField}
            >
              <option value="">ללא תג</option>
              <option value="positive">✅ חיובי</option>
              <option value="negative">❌ שלילי</option>
            </select>
          </div>
          <div className={styles.editActions}>
            <button onClick={() => onSaveEdit(comment)} className={styles.saveEditBtn}>
              <Save size={14} />
              שמור
            </button>
            <button onClick={onCancelEdit} className={styles.cancelEditBtn}>
              ביטול
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.commentItem}>
      <div className={styles.commentHeader}>
        <span className={styles.commentScore}>
          -{getCommentReducedPoints(comment)} נק'
        </span>
        {comment.tag && (
          <span className={`${styles.commentTag} ${styles[comment.tag]}`}>
            {comment.tag === 'positive' ? '✅' : '❌'}
          </span>
        )}
        <span className={styles.commentUsage}>
          שימושים: {comment.usageCount}
        </span>
      </div>
      <div className={styles.commentText}>
        {getCommentDisplayFeedback(comment)}
      </div>
      <div className={styles.commentActions}>
        <button
          onClick={() => onApply(comment)}
          className={styles.useCommentBtn}
          title="החל הערה זו על התשובה הנוכחית"
        >
          השתמש
        </button>
        
        <div className={styles.ratingButtons}>
          <button
            onClick={() => onRate(comment._id, 'like')}
            className={`${styles.ratingBtn} ${styles.likeBtn} ${comment.userRating === 'like' ? styles.active : ''}`}
            title="אשר הערה (מתאים לשימוש)"
          >
            👍 {comment.likes || 0}
          </button>
          <button
            onClick={() => onRate(comment._id, 'dislike')}
            className={`${styles.ratingBtn} ${styles.dislikeBtn} ${comment.userRating === 'dislike' ? styles.active : ''}`}
            title="דחה הערה (לא מתאים לשימוש)"
          >
            👎 {comment.dislikes || 0}
          </button>
        </div>
        
        <button
          onClick={() => onEdit(comment)}
          className={styles.editCommentBtn}
          title="ערוך הערה"
        >
          <Edit3 size={14} />
        </button>
        <button
          onClick={() => onDelete(comment._id)}
          className={styles.deleteCommentBtn}
          title="מחק הערה"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});

CommentItem.displayName = 'CommentItem';

// Main GradeToolbar Component
const GradeToolbar: React.FC = () => {
  const { state, dispatch, fetchCommentBank, showMessage } = useGradeByQuestion();
  const [editingComment, setEditingComment] = useState<CommentBankEntry | null>(null);

  // Apply comment from bank
  const applyComment = useCallback((comment: CommentBankEntry) => {
    const pointsToReduce = getCommentReducedPoints(comment);
    const displayFeedback = getCommentDisplayFeedback(comment);
    const newGrade = Math.max(0, state.currentGrade - pointsToReduce);
    
    dispatch({ type: 'SET_CURRENT_GRADE', payload: newGrade });
    dispatch({ 
      type: 'SET_CURRENT_FEEDBACK', 
      payload: state.currentFeedback ? `${state.currentFeedback}\n${displayFeedback}` : displayFeedback
    });

    // Mark comment as used
    markCommentAsUsed(comment._id);
  }, [state.currentGrade, state.currentFeedback, dispatch]);

  const markCommentAsUsed = useCallback(async (commentId: string) => {
    try {
      await fetch(`/api/admin/comment-bank/${commentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'use' }),
      });
    } catch (err) {
      console.error('Error marking comment as used:', err);
    }
  }, []);

  // Edit comment
  const editComment = useCallback(async (comment: CommentBankEntry) => {
    if (!editingComment) return;

    try {
      const encodedFeedback = encodePointsInFeedback(editingComment.feedback, editingComment.reduced_points || 0);

      const response = await fetch(`/api/admin/comment-bank/${comment._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: encodedFeedback,
          reduced_points: editingComment.reduced_points,
          tag: editingComment.tag,
        }),
      });

      if (!response.ok) throw new Error('Failed to update comment');
      
      if (state.selectedQuestion) {
        fetchCommentBank(state.selectedQuestion.question.id);
      }
      setEditingComment(null);
      showMessage('הערה עודכנה', 'success');
    } catch (err) {
      console.error('Error updating comment:', err);
      showMessage('שגיאה בעדכון הערה', 'error');
    }
  }, [editingComment, state.selectedQuestion, fetchCommentBank, showMessage]);

  // Delete comment
  const deleteComment = useCallback(async (commentId: string) => {
    try {
      const response = await fetch(`/api/admin/comment-bank/${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete comment');
      
      if (state.selectedQuestion) {
        fetchCommentBank(state.selectedQuestion.question.id);
      }
      showMessage('הערה נמחקה', 'success');
    } catch (err) {
      console.error('Error deleting comment:', err);
      showMessage('שגיאה במחיקת הערה', 'error');
    }
  }, [state.selectedQuestion, fetchCommentBank, showMessage]);

  // Rate comment
  const rateComment = useCallback(async (commentId: string, rating: 'like' | 'dislike') => {
    try {
      const response = await fetch(`/api/admin/comment-bank/${commentId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });

      if (response.ok) {
        // Update locally for immediate feedback
        dispatch({
          type: 'SET_COMMENT_BANK_ENTRIES',
          payload: state.commentBankEntries.map(comment => {
            if (comment._id === commentId) {
              const newComment = { ...comment };
              
              // Reset previous rating
              if (comment.userRating === 'like') {
                newComment.likes = (newComment.likes || 0) - 1;
              } else if (comment.userRating === 'dislike') {
                newComment.dislikes = (newComment.dislikes || 0) - 1;
              }
              
              // Apply new rating
              if (rating === 'like') {
                newComment.likes = (newComment.likes || 0) + 1;
              } else {
                newComment.dislikes = (newComment.dislikes || 0) + 1;
              }
              
              newComment.userRating = rating;
              return newComment;
            }
            return comment;
          })
        });
        
        showMessage(rating === 'like' ? 'הערה אושרה' : 'הערה נדחתה', 'success');
      }
    } catch (err) {
      console.error('Error rating comment:', err);
      showMessage('שגיאה בדירוג ההערה', 'error');
    }
  }, [state.commentBankEntries, dispatch, showMessage]);

  const handleEditComment = useCallback((comment: CommentBankEntry) => {
    setEditingComment({
      ...comment,
      feedback: getCommentDisplayFeedback(comment),
      reduced_points: getCommentReducedPoints(comment)
    });
  }, []);

  const handleUpdateEdit = useCallback((updates: Partial<CommentBankEntry>) => {
    if (editingComment) {
      setEditingComment({ ...editingComment, ...updates });
    }
  }, [editingComment]);

  if (!state.selectedQuestion) return null;

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <MessageSquare size={20} />
        <h3>בנק הערות</h3>
      </div>

      <AddNewComment />

      {/* Existing Comments */}
      <div className={styles.commentsSection}>
        <h4>הערות קיימות ({state.commentBankEntries.length})</h4>
        {state.loadingComments ? (
          <div className={styles.loadingComments}>טוען הערות...</div>
        ) : (
          <div className={styles.commentsList}>
            {state.commentBankEntries.map((comment) => (
              <CommentItem
                key={comment._id}
                comment={comment}
                onApply={applyComment}
                onEdit={handleEditComment}
                onDelete={deleteComment}
                onRate={rateComment}
                editingComment={editingComment}
                onSaveEdit={editComment}
                onCancelEdit={() => setEditingComment(null)}
                onUpdateEdit={handleUpdateEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GradeToolbar; 