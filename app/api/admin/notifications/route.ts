import { NextRequest, NextResponse } from 'next/server';
import { 
  NotificationService, 
  NotificationFilters, 
  CreateNotificationData,
  NotificationHelpers 
} from '../../../../lib/notifications';

/**
 * GET /api/admin/notifications
 * Get notifications with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: NotificationFilters = {
      type: searchParams.get('type') as any || undefined,
      isRead: searchParams.get('isRead') ? searchParams.get('isRead') === 'true' : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      skip: searchParams.get('skip') ? parseInt(searchParams.get('skip')!) : 0,
      includeExpired: searchParams.get('includeExpired') === 'true',
    };

    const notifications = await NotificationService.getNotifications(filters);
    const unreadCount = await NotificationService.getUnreadCount();

    return NextResponse.json({
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/notifications
 * Create a new notification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.title || !body.message || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, message, type' },
        { status: 400 }
      );
    }

    const notificationData: CreateNotificationData = {
      title: body.title,
      message: body.message,
      type: body.type,
      createdBy: body.createdBy || 'admin',
      metadata: body.metadata,
      expiresAt: body.expiresAt,
    };

    const notification = await NotificationService.createNotification(notificationData);

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/notifications
 * Mark notifications as read or perform bulk operations
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, notificationId } = body;

    switch (action) {
      case 'markAsRead':
        if (!notificationId) {
          return NextResponse.json(
            { error: 'notificationId is required for markAsRead action' },
            { status: 400 }
          );
        }
        const success = await NotificationService.markAsRead(notificationId);
        return NextResponse.json({ success });

      case 'markAllAsRead':
        const modifiedCount = await NotificationService.markAllAsRead();
        return NextResponse.json({ modifiedCount });

      case 'deleteExpired':
        const deletedCount = await NotificationService.deleteExpiredNotifications();
        return NextResponse.json({ deletedCount });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: markAsRead, markAllAsRead, deleteExpired' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/notifications
 * Delete a specific notification
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');

    if (!notificationId) {
      return NextResponse.json(
        { error: 'notificationId is required' },
        { status: 400 }
      );
    }

    const success = await NotificationService.deleteNotification(notificationId);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
