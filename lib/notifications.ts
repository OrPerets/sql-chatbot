import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database';
import { ObjectId } from 'mongodb';

/**
 * Notification Types and Interfaces
 */
export type NotificationType = 'info' | 'warning' | 'success' | 'error' | 'system';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  createdBy?: string; // Admin user who created the notification
  metadata?: Record<string, any>; // Additional data for the notification
  expiresAt?: string; // Optional expiration date
}

export interface CreateNotificationData {
  title: string;
  message: string;
  type: NotificationType;
  createdBy?: string;
  metadata?: Record<string, any>;
  expiresAt?: string;
}

export interface NotificationFilters {
  type?: NotificationType;
  isRead?: boolean;
  limit?: number;
  skip?: number;
  includeExpired?: boolean;
}

/**
 * Notification Service Functions
 */
export class NotificationService {
  /**
   * Create a new notification
   */
  static async createNotification(data: CreateNotificationData): Promise<Notification> {
    const now = new Date().toISOString();
    
    const notification = {
      title: data.title,
      message: data.message,
      type: data.type,
      isRead: false,
      createdAt: now,
      updatedAt: now,
      createdBy: data.createdBy || 'system',
      metadata: data.metadata || {},
      expiresAt: data.expiresAt,
    };

    const result = await executeWithRetry(async (db) => {
      return db.collection(COLLECTIONS.NOTIFICATIONS).insertOne(notification);
    });

    return {
      id: result.insertedId.toString(),
      ...notification,
    };
  }

  /**
   * Get notifications with optional filters
   */
  static async getNotifications(filters: NotificationFilters = {}): Promise<Notification[]> {
    const {
      type,
      isRead,
      limit = 50,
      skip = 0,
      includeExpired = false,
    } = filters;

    const query: any = {};
    
    if (type) {
      query.type = type;
    }
    
    if (typeof isRead === 'boolean') {
      query.isRead = isRead;
    }

    if (!includeExpired) {
      query.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date().toISOString() } }
      ];
    }

    const notifications = await executeWithRetry(async (db) => {
      return db.collection(COLLECTIONS.NOTIFICATIONS)
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    });

    return notifications.map(notification => ({
      id: notification._id.toString(),
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      createdBy: notification.createdBy,
      metadata: notification.metadata,
      expiresAt: notification.expiresAt,
    }));
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      await executeWithRetry(async (db) => {
        return db.collection(COLLECTIONS.NOTIFICATIONS).updateOne(
          { _id: new ObjectId(notificationId) },
          { 
            $set: { 
              isRead: true,
              updatedAt: new Date().toISOString()
            }
          }
        );
      });
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(): Promise<number> {
    try {
      const result = await executeWithRetry(async (db) => {
        return db.collection(COLLECTIONS.NOTIFICATIONS).updateMany(
          { isRead: false },
          { 
            $set: { 
              isRead: true,
              updatedAt: new Date().toISOString()
            }
          }
        );
      });
      return result.modifiedCount;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return 0;
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const result = await executeWithRetry(async (db) => {
        return db.collection(COLLECTIONS.NOTIFICATIONS).deleteOne(
          { _id: new ObjectId(notificationId) }
        );
      });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Delete expired notifications
   */
  static async deleteExpiredNotifications(): Promise<number> {
    try {
      const result = await executeWithRetry(async (db) => {
        return db.collection(COLLECTIONS.NOTIFICATIONS).deleteMany({
          expiresAt: { $lt: new Date().toISOString() }
        });
      });
      return result.deletedCount;
    } catch (error) {
      console.error('Error deleting expired notifications:', error);
      return 0;
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(): Promise<number> {
    try {
      const count = await executeWithRetry(async (db) => {
        return db.collection(COLLECTIONS.NOTIFICATIONS).countDocuments({
          isRead: false,
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date().toISOString() } }
          ]
        });
      });
      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Create system notifications for common admin events
   */
  static async createSystemNotification(
    event: string,
    details: string,
    type: NotificationType = 'info',
    metadata?: Record<string, any>
  ): Promise<Notification> {
    return this.createNotification({
      title: this.getEventTitle(event),
      message: details,
      type,
      createdBy: 'system',
      metadata: {
        event,
        ...metadata,
      },
    });
  }

  /**
   * Get event titles for system notifications
   */
  private static getEventTitle(event: string): string {
    const eventTitles: Record<string, string> = {
      'user_registered': 'משתמש חדש נרשם',
      'user_login': 'משתמש התחבר',
      'homework_created': 'מטלה חדשה נוצרה',
      'homework_submitted': 'מטלה נשלחה',
      'homework_graded': 'מטלה נבדקה',
      'system_error': 'שגיאה במערכת',
      'bulk_action': 'פעולה מרובה בוצעה',
      'user_action': 'פעולת משתמש',
      'system_maintenance': 'תחזוקת מערכת',
      'data_export': 'ייצוא נתונים',
    };

    return eventTitles[event] || 'התראה מהמערכת';
  }
}

/**
 * Helper functions for creating specific types of notifications
 */
export const NotificationHelpers = {
  /**
   * Create user registration notification
   */
  async userRegistered(userName: string, userEmail: string): Promise<Notification> {
    return NotificationService.createSystemNotification(
      'user_registered',
      `${userName} (${userEmail}) הצטרף למערכת`,
      'info',
      { userName, userEmail }
    );
  },

  /**
   * Create homework submission notification
   */
  async homeworkSubmitted(homeworkTitle: string, studentName: string): Promise<Notification> {
    return NotificationService.createSystemNotification(
      'homework_submitted',
      `${studentName} הגיש מטלה: ${homeworkTitle}`,
      'info',
      { homeworkTitle, studentName }
    );
  },

  /**
   * Create system error notification
   */
  async systemError(errorMessage: string, context?: string): Promise<Notification> {
    return NotificationService.createSystemNotification(
      'system_error',
      context ? `${context}: ${errorMessage}` : errorMessage,
      'error',
      { errorMessage, context }
    );
  },

  /**
   * Create bulk action notification
   */
  async bulkAction(action: string, affectedUsers: number): Promise<Notification> {
    return NotificationService.createSystemNotification(
      'bulk_action',
      `פעולה "${action}" בוצעה על ${affectedUsers} משתמשים`,
      'info',
      { action, affectedUsers }
    );
  },

  /**
   * Create data export notification
   */
  async dataExport(exportType: string, recordCount: number): Promise<Notification> {
    return NotificationService.createSystemNotification(
      'data_export',
      `ייצוא ${exportType} הושלם בהצלחה (${recordCount} רשומות)`,
      'success',
      { exportType, recordCount }
    );
  },
};
