import { NextResponse } from 'next/server';
import { sendEmail, generateActionEmail } from '../../../utils/email-service';
import { NotificationHelpers } from '../../../../lib/notifications';
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth';
import { getAllUsers, setCoinsBalance, updatePassword } from '@/lib/users';
import { getAllCoins } from '@/lib/coins';

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const data = await request.json();
    const { users, actions } = data as { users: string[]; actions: { type: string; amount?: number }[] };

    const allUsers = await getAllUsers();
    const usersData = allUsers.filter((u: any) => users.includes(u.email));
    
    // Create a map of user emails to their current balances
    const coinsAll = await getAllCoins();
    const userBalances = new Map(
      coinsAll.map((c: any) => [c.user, c.coins])
    );
    
    interface UserUpdate {
      email: string;
      newBalance?: number;
      resetPassword?: boolean;
    }

    // Process each user's updates
    const userUpdates: UserUpdate[] = users.map(email => {
      const currentBalance = Number(userBalances.get(email) || 0);
      const update: UserUpdate = { email };
      
      // Apply each action for the user
      actions.forEach(({ type, amount }) => {
        switch (type) {
          case 'add_balance':
            update.newBalance = (update.newBalance ?? currentBalance) + Number(amount);
            break;
          case 'reduce_balance':
            update.newBalance = Math.max(0, (update.newBalance ?? currentBalance) - Number(amount));
            break;
          case 'set_balance':
            update.newBalance = Number(amount);
            break;
          case 'reset_password':
            update.resetPassword = true;
            break;
        }
      });

      return update;
    });

    // Separate updates into balance updates and password resets
    const balanceUpdates = userUpdates
      .filter(update => update.newBalance !== undefined)
      .map(({ email, newBalance }) => ({ email, newBalance }));

    const passwordResets = userUpdates
      .filter(update => update.resetPassword)
      .map(update => update.email);

    // Send balance updates if any
    if (balanceUpdates.length > 0) {
      await Promise.all(
        balanceUpdates.map(({ email, newBalance }) => setCoinsBalance(email, Number(newBalance))),
      );
    }

    // Send password resets if any
    if (passwordResets.length > 0) {
      await updatePassword(passwordResets, 'shenkar');
    }

    // Send email notifications to selected users
    const emailPromises = usersData.map((user: any) => {
      const emailContent = generateActionEmail(user.email, user.name, actions);
      return sendEmail(emailContent);
    });

    // Wait for all emails to be sent
    await Promise.all(emailPromises);

    // Create notification for bulk action
    const actionSummary = actions.map(a => a.type).join(', ');
    await NotificationHelpers.bulkAction(
      `פעולות מרובות: ${actionSummary}`, 
      users.length
    );

    // Return success response with summary
    return NextResponse.json({
      success: true,
      summary: {
        balanceUpdates: balanceUpdates.length > 0 ? balanceUpdates : undefined,
        passwordResets: passwordResets.length > 0 ? passwordResets : undefined,
        emailsSent: users.length
      }
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error in bulk actions:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    );
  }
}
