import { NextResponse } from 'next/server';
import { sendEmail, generateActionEmail } from '../../../utils/email-service';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { users, actions } = data as { users: string[]; actions: { type: string; amount?: number }[] };

    // Fetch only the selected users' data
    const usersResponse = await fetch(`/api/users`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!usersResponse.ok) {
      throw new Error('Failed to fetch users');
    }
    const allUsers = await usersResponse.json();
    const usersData = allUsers.filter((u: any) => users.includes(u.email));
    
    // Create a map of user emails to their current balances
    const coinsResp = await fetch(`/api/users/coins?all=1`);
    const coinsAll = await coinsResp.json();
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
      // Convert to aggregate inc operations using users/coins API in batches
      const emails = balanceUpdates.map(b => b.email);
      const targetUsers = usersData.filter((u: any) => emails.includes(u.email)).map((u: any) => u.email);
      // For simplicity, compute delta from current balances not supported here; send set individually
      await Promise.all(balanceUpdates.map(async ({ email, newBalance }) => {
        await fetch(`/api/users/balance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, currentBalance: Number(newBalance) })
        });
      }));
    }

    // Send password resets if any
    if (passwordResets.length > 0) {
      await fetch(`/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: passwordResets, password: 'shenkar' })
      });
    }

    // Send email notifications to selected users
    const emailPromises = usersData.map((user: any) => {
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
