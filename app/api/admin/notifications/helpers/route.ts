import { NextRequest, NextResponse } from 'next/server';
import { NotificationHelpers } from '../../../../../lib/notifications';

/**
 * POST /api/admin/notifications/helpers
 * Create system notifications using helper functions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    let notification;

    switch (action) {
      case 'userRegistered':
        if (!data.userName || !data.userEmail) {
          return NextResponse.json(
            { error: 'userName and userEmail are required for userRegistered action' },
            { status: 400 }
          );
        }
        notification = await NotificationHelpers.userRegistered(data.userName, data.userEmail);
        break;

      case 'homeworkSubmitted':
        if (!data.homeworkTitle || !data.studentName) {
          return NextResponse.json(
            { error: 'homeworkTitle and studentName are required for homeworkSubmitted action' },
            { status: 400 }
          );
        }
        notification = await NotificationHelpers.homeworkSubmitted(data.homeworkTitle, data.studentName);
        break;

      case 'systemError':
        if (!data.errorMessage) {
          return NextResponse.json(
            { error: 'errorMessage is required for systemError action' },
            { status: 400 }
          );
        }
        notification = await NotificationHelpers.systemError(data.errorMessage, data.context);
        break;

      case 'bulkAction':
        if (!data.action || typeof data.affectedUsers !== 'number') {
          return NextResponse.json(
            { error: 'action and affectedUsers are required for bulkAction' },
            { status: 400 }
          );
        }
        notification = await NotificationHelpers.bulkAction(data.action, data.affectedUsers);
        break;

      case 'dataExport':
        if (!data.exportType || typeof data.recordCount !== 'number') {
          return NextResponse.json(
            { error: 'exportType and recordCount are required for dataExport' },
            { status: 400 }
          );
        }
        notification = await NotificationHelpers.dataExport(data.exportType, data.recordCount);
        break;

      default:
        return NextResponse.json(
          { 
            error: 'Invalid action', 
            supportedActions: [
              'userRegistered', 
              'homeworkSubmitted', 
              'systemError', 
              'bulkAction', 
              'dataExport'
            ]
          },
          { status: 400 }
        );
    }

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification with helper:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
