import { NextResponse } from 'next/server';
import config from '../../../config';
import { sendEmail, generateActionEmail } from '../../../utils/email-service';

const SERVER_BASE = config.serverUrl;

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { users, actions } = data;

    // Fetch only the selected users' data
    const usersResponse = await fetch(`${SERVER_BASE}/users/selected`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emails: users })
    });
    
    if (!usersResponse.ok) {
      throw new Error('Failed to fetch selected users');
    }
    const usersData = await usersResponse.json();
    
    // Create a map of user emails to their current balances
    const userBalances = new Map(
      usersData.map(user => [user.email, user.balance])
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
      const balanceResponse = await fetch(`${SERVER_BASE}/update-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users: balanceUpdates }),
      });

      if (!balanceResponse.ok) {
        throw new Error('Failed to update balances');
      }
    }

    // Send password resets if any
    if (passwordResets.length > 0) {
      const passwordResponse = await fetch(`${SERVER_BASE}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          users: passwordResets,
          newPassword: 'shenkar'
        }),
      });

      if (!passwordResponse.ok) {
        throw new Error('Failed to reset passwords');
      }
    }

    // Send email notifications to selected users
    const emailPromises = usersData.map(user => {

      const emailContent = generateActionEmail(user.email, user.name, actions);
      return sendEmail(emailContent);
    });

    // Wait for all emails to be sent
    await Promise.all(emailPromises);

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
    console.error('Error in bulk actions:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    );
  }
}
