import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const featureVoiceEnabled = process.env.FEATURE_VOICE === '1';
    if (!featureVoiceEnabled) {
      return NextResponse.json({ error: 'Voice feature disabled' }, { status: 404 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { transcript, context, intent = 'sql_assistance' } = await request.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    // Process the voice query using OpenAI
    const response = await processVoiceQuery(transcript, context, intent);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('Voice SQL query processing error:', error);
    return NextResponse.json({ 
      error: 'Failed to process SQL query',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function processVoiceQuery(
  transcript: string, 
  context: string, 
  intent: string
): Promise<{
  sqlQuery?: string;
  explanation?: string;
  needsConfirmation?: boolean;
  suggestedActions?: string[];
  responseText: string;
}> {
  
  const systemPrompt = `You are Michael, an expert SQL tutor. A student has spoken to you with a voice query. 

Context: ${context || 'General SQL assistance'}
Intent: ${intent}
Student's spoken query: "${transcript}"

Your task is to:
1. Understand what the student is asking about SQL
2. If they want to create/modify a SQL query, provide the exact SQL code
3. Give a clear, conversational explanation suitable for voice response
4. Determine if confirmation is needed before executing queries
5. Suggest helpful follow-up actions

Guidelines:
- Keep explanations concise but complete (suitable for voice)
- Use simple language, avoid overly technical jargon
- Support both Hebrew and English
- If generating SQL, make it syntactically correct
- Be encouraging and educational

Respond in JSON format:
{
  "sqlQuery": "SELECT * FROM users WHERE age > 18" (if applicable),
  "explanation": "Brief explanation of what this query does",
  "needsConfirmation": true/false,
  "suggestedActions": ["Execute query", "Explain syntax", "Show examples"],
  "responseText": "What you would say out loud to the student"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    try {
      const parsedResponse = JSON.parse(responseContent);
      
      // Validate response structure
      return {
        sqlQuery: parsedResponse.sqlQuery || undefined,
        explanation: parsedResponse.explanation || undefined,
        needsConfirmation: parsedResponse.needsConfirmation || false,
        suggestedActions: Array.isArray(parsedResponse.suggestedActions) 
          ? parsedResponse.suggestedActions 
          : [],
        responseText: parsedResponse.responseText || generateFallbackResponse(transcript)
      };
      
    } catch (parseError) {
      console.warn('Failed to parse JSON response, using fallback');
      return generateFallbackResponse(transcript);
    }

  } catch (error) {
    console.error('OpenAI API error:', error);
    return generateFallbackResponse(transcript);
  }
}

function generateFallbackResponse(transcript: string): {
  sqlQuery?: string;
  explanation?: string;
  needsConfirmation?: boolean;
  suggestedActions?: string[];
  responseText: string;
} {
  const lowerTranscript = transcript.toLowerCase();
  
  // Basic SQL keyword detection
  if (lowerTranscript.includes('select')) {
    return {
      responseText: "I heard you asking about SELECT queries. SELECT is used to retrieve data from database tables. Would you like me to show you some examples?",
      suggestedActions: ["Show SELECT examples", "Explain SELECT syntax"]
    };
  }
  
  if (lowerTranscript.includes('join')) {
    return {
      responseText: "You mentioned JOINs! JOINs are used to combine data from multiple tables. There are different types like INNER JOIN, LEFT JOIN, and RIGHT JOIN. Which one would you like to learn about?",
      suggestedActions: ["Explain INNER JOIN", "Show JOIN examples"]
    };
  }
  
  if (lowerTranscript.includes('database') || lowerTranscript.includes('table')) {
    return {
      responseText: "I can help you with database and table operations. Are you looking to create tables, query existing ones, or modify table structure?",
      suggestedActions: ["Create table example", "Query table example", "Modify table example"]
    };
  }
  
  // Hebrew support
  if (lowerTranscript.includes('בסיס נתונים') || lowerTranscript.includes('מסד נתונים')) {
    return {
      responseText: "אני יכול לעזור לך עם בסיסי נתונים. על מה בדיוק תרצה ללמוד?",
      suggestedActions: ["דוגמאות SQL", "הסבר על טבלאות", "שאילתות בסיסיות"]
    };
  }
  
  // General fallback
  return {
    responseText: "I'm here to help you learn SQL! Could you be more specific about what you'd like to know? For example, you can ask about SELECT statements, JOINs, creating tables, or any other SQL concept.",
    suggestedActions: ["SQL basics", "Query examples", "Table operations"]
  };
}

export async function GET() {
  return NextResponse.json({
    service: 'Voice SQL Query Processor',
    version: '1.0.0',
    supportedIntents: [
      'sql_assistance',
      'learning_request', 
      'troubleshooting',
      'query_generation'
    ],
    supportedLanguages: ['en', 'he'],
    features: [
      'natural language to SQL conversion',
      'query explanation',
      'confirmation prompts',
      'suggested actions',
      'conversational responses'
    ],
    examples: [
      {
        input: "Show me all users older than 25",
        output: "SELECT * FROM users WHERE age > 25"
      },
      {
        input: "How do I join two tables?",
        output: "Explanation of JOIN operations with examples"
      }
    ]
  });
}
