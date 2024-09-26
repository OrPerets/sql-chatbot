import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { threadId, userId, isLike, userText, message } = req.body;

    try {
      // Here, implement your database saving logic
      // For example, using a database client to insert the feedback
      // await db.feedback.insert({ threadId, userId, isLike, userText, message, timestamp: new Date() });

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