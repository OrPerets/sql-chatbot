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

    const { query, results, language = 'auto' } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'SQL query is required' }, { status: 400 });
    }

    const explanation = await explainSQLQuery(query, results, language);
    
    return NextResponse.json({
      explanation: explanation.text,
      breakdown: explanation.breakdown,
      difficulty: explanation.difficulty,
      concepts: explanation.concepts,
      voiceResponse: explanation.voiceResponse
    });

  } catch (error) {
    console.error('Query explanation error:', error);
    return NextResponse.json({ 
      error: 'Failed to explain query',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function explainSQLQuery(
  query: string, 
  results?: any, 
  language: string = 'auto'
): Promise<{
  text: string;
  breakdown: Array<{ part: string; explanation: string; }>;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  concepts: string[];
  voiceResponse: string;
}> {
  
  const hasResults = results && (Array.isArray(results) ? results.length > 0 : Object.keys(results).length > 0);
  const resultsInfo = hasResults 
    ? `Results: ${JSON.stringify(results).slice(0, 200)}...` 
    : 'No results provided';

  const systemPrompt = `You are Michael, an expert SQL tutor. Explain the following SQL query in a clear, educational way.

SQL Query: ${query}
${resultsInfo}
Language preference: ${language === 'he' ? 'Hebrew' : language === 'en' ? 'English' : 'Auto-detect and respond appropriately'}

Provide a comprehensive explanation that includes:
1. Overall purpose of the query
2. Step-by-step breakdown of each part
3. Key SQL concepts used
4. Difficulty level assessment
5. A concise voice-friendly response

Be educational but conversational. Use simple language suitable for voice output.

Respond in JSON format:
{
  "text": "Detailed written explanation",
  "breakdown": [
    {"part": "SELECT *", "explanation": "Selects all columns"},
    {"part": "FROM users", "explanation": "From the users table"}
  ],
  "difficulty": "beginner|intermediate|advanced",
  "concepts": ["SELECT", "FROM", "WHERE"],
  "voiceResponse": "Concise explanation suitable for voice output"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      temperature: 0.5,
      max_tokens: 600
    });

    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    try {
      const parsedResponse = JSON.parse(responseContent);
      
      return {
        text: parsedResponse.text || generateFallbackExplanation(query).text,
        breakdown: Array.isArray(parsedResponse.breakdown) ? parsedResponse.breakdown : [],
        difficulty: ['beginner', 'intermediate', 'advanced'].includes(parsedResponse.difficulty) 
          ? parsedResponse.difficulty 
          : 'intermediate',
        concepts: Array.isArray(parsedResponse.concepts) ? parsedResponse.concepts : [],
        voiceResponse: parsedResponse.voiceResponse || generateFallbackExplanation(query).voiceResponse
      };
      
    } catch (parseError) {
      console.warn('Failed to parse JSON response, using fallback');
      return generateFallbackExplanation(query);
    }

  } catch (error) {
    console.error('OpenAI API error:', error);
    return generateFallbackExplanation(query);
  }
}

function generateFallbackExplanation(query: string): {
  text: string;
  breakdown: Array<{ part: string; explanation: string; }>;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  concepts: string[];
  voiceResponse: string;
} {
  const upperQuery = query.toUpperCase();
  const concepts: string[] = [];
  const breakdown: Array<{ part: string; explanation: string; }> = [];
  
  // Basic SQL keyword analysis
  if (upperQuery.includes('SELECT')) {
    concepts.push('SELECT');
    breakdown.push({
      part: 'SELECT',
      explanation: 'Retrieves data from the database'
    });
  }
  
  if (upperQuery.includes('FROM')) {
    concepts.push('FROM');
    breakdown.push({
      part: 'FROM',
      explanation: 'Specifies which table(s) to query'
    });
  }
  
  if (upperQuery.includes('WHERE')) {
    concepts.push('WHERE');
    breakdown.push({
      part: 'WHERE',
      explanation: 'Filters rows based on conditions'
    });
  }
  
  if (upperQuery.includes('JOIN')) {
    concepts.push('JOIN');
    breakdown.push({
      part: 'JOIN',
      explanation: 'Combines data from multiple tables'
    });
  }
  
  if (upperQuery.includes('GROUP BY')) {
    concepts.push('GROUP BY');
    breakdown.push({
      part: 'GROUP BY',
      explanation: 'Groups rows that have the same values'
    });
  }
  
  if (upperQuery.includes('ORDER BY')) {
    concepts.push('ORDER BY');
    breakdown.push({
      part: 'ORDER BY',
      explanation: 'Sorts the result set'
    });
  }

  // Determine difficulty
  let difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
  
  if (upperQuery.includes('JOIN') || upperQuery.includes('GROUP BY') || upperQuery.includes('HAVING')) {
    difficulty = 'intermediate';
  }
  
  if (upperQuery.includes('WINDOW') || upperQuery.includes('CTE') || upperQuery.includes('RECURSIVE')) {
    difficulty = 'advanced';
  }

  const text = `This SQL query uses ${concepts.join(', ')} operations. It appears to be a ${difficulty}-level query that works with database tables to retrieve or manipulate data.`;
  
  const voiceResponse = concepts.length > 0 
    ? `This query uses ${concepts.slice(0, 3).join(', ')} to work with your database. It's a ${difficulty} level query.`
    : 'This appears to be a SQL query. I can help explain specific parts if you have questions.';

  return {
    text,
    breakdown,
    difficulty,
    concepts,
    voiceResponse
  };
}

export async function GET() {
  return NextResponse.json({
    service: 'SQL Query Explanation',
    version: '1.0.0',
    supportedFeatures: [
      'query breakdown',
      'concept identification',
      'difficulty assessment',
      'voice-friendly responses',
      'multilingual support'
    ],
    supportedLanguages: ['en', 'he', 'auto'],
    difficultyLevels: ['beginner', 'intermediate', 'advanced'],
    examples: [
      {
        query: "SELECT name, age FROM users WHERE age > 18",
        concepts: ["SELECT", "FROM", "WHERE"],
        difficulty: "beginner"
      },
      {
        query: "SELECT u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.name",
        concepts: ["SELECT", "FROM", "LEFT JOIN", "GROUP BY", "COUNT"],
        difficulty: "intermediate"
      }
    ]
  });
}
