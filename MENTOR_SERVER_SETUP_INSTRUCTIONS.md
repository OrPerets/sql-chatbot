# Mentor Server Setup for Cheat Detection

## ✅ What I Fixed

The cheat detection API was trying to connect directly to MongoDB, but your system uses the `mentor-server` backend. I've updated the frontend API to call the mentor-server instead.

## 🔧 Required Backend Setup

You need to add a cheat detection endpoint to your mentor-server. Here are the options:

### Option 1: Express.js Route (Most Common)

Add this to your `mentor-server/api/index.js` or main server file:

```javascript
// Import the handler (create this file based on mentor-server-cheat-detection-endpoint.js)
const cheatDetection = require('./admin/cheat-detection');

// Add the route
app.post('/admin/cheat-detection', cheatDetection);
```

### Option 2: Serverless Function (if using Vercel)

If your mentor-server is deployed on Vercel, create this file:
`mentor-server/api/admin/cheat-detection.js`

Copy the content from the `mentor-server-cheat-detection-endpoint.js` file I created.

### Option 3: Quick Integration Test

To test if the frontend is working correctly, you can temporarily add this simple endpoint to test connectivity:

```javascript
app.post('/admin/cheat-detection', (req, res) => {
  res.json({
    similarityMatches: [],
    aiDetectionResults: [],
    examAnswers: [],
    stats: {
      totalExams: 0,
      suspiciousSimilarities: 0,
      suspiciousAI: 0,
      averageSimilarityScore: 0,
      highRiskPairs: 0
    }
  });
});
```

## 🚀 How It Works Now

1. **Frontend API** (`/api/admin/cheat-detection`) → Calls mentor-server
2. **Mentor Server** → Fetches exam data from MongoDB & calculates similarity
3. **Frontend** → Processes AI detection using existing `trapDetector`
4. **Result** → Combined analysis sent to UI

## 📁 Files Changed

- ✅ `app/api/admin/cheat-detection/route.ts` - Now calls mentor-server instead of MongoDB
- ✅ `mentor-server-cheat-detection-endpoint.js` - Backend code to add to mentor-server
- ✅ All other frontend files remain unchanged

## 🧪 Testing

Once you add the backend endpoint:

1. Start your mentor-server
2. Go to Admin Panel → "חשד להעתקה"
3. Click "הרץ ניתוח מחדש"
4. Should see analysis results instead of connection errors

## 🔍 Environment Variables

Make sure your frontend has the correct mentor-server URL:

```env
NEXT_PUBLIC_SERVER_BASE=https://your-mentor-server-url.vercel.app
# or for local development:
NEXT_PUBLIC_SERVER_BASE=http://localhost:3001
```

## 🆘 Need Help?

If you're not sure about your mentor-server structure, you can:

1. Show me your `mentor-server/api/index.js` file
2. Or show me how other admin endpoints are set up in mentor-server
3. Or tell me if you're using Express.js, Next.js API routes, or another framework

The frontend is now ready and will work as soon as you add the backend endpoint! 🎉