import { NextRequest, NextResponse } from 'next/server';
import { NotificationService, NotificationHelpers } from '../../../../../lib/notifications';

/**
 * POST /api/admin/notifications/test
 * Create test notifications for development/testing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'createSample':
        // Create sample notifications
        const notifications = await Promise.all([
          NotificationHelpers.userRegistered('יוסי כהן', 'yossi@example.com'),
          NotificationHelpers.homeworkSubmitted('מטלת SQL בסיסי', 'דני לוי'),
          NotificationHelpers.systemError('בעיית חיבור למסד הנתונים', 'database'),
          NotificationHelpers.bulkAction('איפוס סיסמאות', 15),
          NotificationHelpers.dataExport('דוח משתמשים', 120),
          NotificationService.createNotification({
            title: 'מערכת חדשה זמינה',
            message: 'גרסה 2.0 של המערכת זמינה כעת עם תכונות חדשות',
            type: 'success',
            createdBy: 'system',
          }),
        ]);

        return NextResponse.json({
          success: true,
          created: notifications.length,
          notifications: notifications.map(n => ({ id: n.id, title: n.title }))
        });

      case 'clearAll':
        // Clear all notifications (for testing)
        const deletedCount = await NotificationService.deleteExpiredNotifications();
        
        // Also delete all notifications (not just expired)
        const { db } = await import('../../../../../lib/database').then(m => m.connectToDatabase());
        await db.collection('notifications').deleteMany({});
        
        return NextResponse.json({
          success: true,
          deleted: deletedCount,
          message: 'All notifications cleared'
        });

      case 'createError':
        // Create error notification
        const errorNotification = await NotificationHelpers.systemError(
          'זהו הודעת שגיאה לבדיקה',
          'test-error'
        );
        
        return NextResponse.json({
          success: true,
          notification: errorNotification
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: createSample, clearAll, createError' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in test notifications:', error);
    return NextResponse.json(
      { error: 'Failed to create test notifications' },
      { status: 500 }
    );
  }
}
