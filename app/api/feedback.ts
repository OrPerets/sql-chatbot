import type { NextApiRequest, NextApiResponse } from 'next'
import { executeWithRetry, COLLECTIONS } from '@/lib/database'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { threadId, userId, isLike, userText, message, chatId, feedback } = req.body as any;

    try {
      await executeWithRetry(async (db) => {
        await db.collection(COLLECTIONS.FEEDBACKS).insertOne({
          threadId,
          userId,
          chatId,
          isLike,
          feedback,
          message,
          userText,
          time: new Date(),
        })
      })

      res.status(200).json({ status: 'success', message: 'Feedback saved successfully' });
    } catch (error) {
      console.error('Error saving feedback:', error);
      res.status(500).json({ status: 'error', message: 'Failed to save feedback' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}