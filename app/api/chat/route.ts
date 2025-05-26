import { NextRequest, NextResponse } from 'next/server'

// Force this API route to use Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs'

interface SolarLLMMessage {
  role: "user" | "assistant" | "system"
  content: string
}

interface SolarLLMResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

async function callSolarLLM(messages: SolarLLMMessage[]): Promise<string> {
  const apiKey = process.env.UPSTAGE_API_KEY
  
  if (!apiKey) {
    throw new Error("UPSTAGE_API_KEY environment variable is required")
  }

  const requestBody = {
    model: process.env.UPSTAGE_MODEL_NAME || "solar-pro2-preview",
    messages: messages,
    temperature: 0.7,
    max_tokens: 4000,
    top_p: 0.9,
  }

  // Retry logic with exponential backoff
  const maxRetries = 3
  let retryCount = 0
  
  while (retryCount <= maxRetries) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000) // 300 seconds timeout

      const response = await fetch('https://api.upstage.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Upstage SolarLLM API error: ${response.status} - ${errorText}`)
      }

      const result: SolarLLMResponse = await response.json()
      
      if (!result.choices || result.choices.length === 0) {
        throw new Error("No response from SolarLLM")
      }

      return result.choices[0].message.content

    } catch (error) {
      retryCount++
      console.error(`Upstage API call failed (attempt ${retryCount}/${maxRetries + 1}):`, error)
      
      if (retryCount > maxRetries) {
        throw new Error(`Upstage API failed after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      // Exponential backoff: wait 2^retryCount seconds
      const backoffMs = Math.pow(2, retryCount) * 1000
      console.log(`Retrying in ${backoffMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }
  }

  throw new Error("Failed to get response from SolarLLM")
}

async function callSolarLLMStream(messages: SolarLLMMessage[]): Promise<ReadableStream> {
  const apiKey = process.env.UPSTAGE_API_KEY
  
  if (!apiKey) {
    throw new Error("UPSTAGE_API_KEY environment variable is required")
  }

  const requestBody = {
    model: process.env.UPSTAGE_MODEL_NAME || "solar-pro2-preview",
    messages: messages,
    temperature: 0.7,
    max_tokens: 4000,
    top_p: 0.9,
    stream: true
  }

  const response = await fetch('https://api.upstage.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Upstage SolarLLM API error: ${response.status} - ${errorText}`)
  }

  return new ReadableStream({
    start(controller) {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      function pump(): Promise<void> {
        return reader!.read().then(({ done, value }) => {
          if (done) {
            controller.close()
            return
          }

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
              try {
                const jsonData = trimmedLine.slice(6) // Remove 'data: ' prefix
                const parsed = JSON.parse(jsonData)
                
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  const content = parsed.choices[0].delta.content
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`))
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }

          return pump()
        })
      }

      return pump()
    }
  })
}

async function refineContentBasedOnFeedback(
  content: string,
  userFeedback: string,
  projectTitle: string,
  contentType: string,
  conversationHistory: { role: string; content: string }[]
): Promise<{ response: string; updatedContent?: string }> {
  
  // Check if this is a request for content modification
  const modificationKeywords = [
    'make it', 'change', 'rewrite', 'modify', 'adjust', 'improve', 'enhance',
    'more professional', 'more casual', 'shorter', 'longer', 'simplify',
    'add more', 'remove', 'tone', 'style', 'formal', 'informal'
  ]
  
  const isContentModification = modificationKeywords.some(keyword => 
    userFeedback.toLowerCase().includes(keyword)
  )

  if (isContentModification) {
    // This is a content modification request
    const messages: SolarLLMMessage[] = [
      {
        role: "system",
        content: `You are an expert content editor. Your task is to modify the provided content based on user feedback while maintaining the core message and structure.

Guidelines:
1. Carefully analyze the user's feedback to understand what changes they want
2. Make targeted modifications while preserving the essential information
3. Maintain consistent quality and professional standards
4. If asked to change tone, adjust the language style appropriately
5. If asked to change length, add or remove content strategically
6. Ensure the modified content remains coherent and well-structured
7. Return the complete revised content, not just the changes

Always provide the full updated content after making the requested modifications.`
      },
      {
        role: "user", 
        content: `Please modify this ${contentType} titled "${projectTitle}" based on the user's feedback.

Current Content:
${content}

User Feedback: ${userFeedback}

Please provide the complete updated content incorporating the requested changes.`
      }
    ]

    const updatedContent = await callSolarLLM(messages)
    
    return {
      response: `I've updated your content based on your feedback. The changes have been applied to maintain the quality while addressing your specific requests.`,
      updatedContent: updatedContent
    }
  } else {
    // This is a general question or comment
    const conversationContext = conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')

    const messages: SolarLLMMessage[] = [
      {
        role: "system",
        content: `You are a professional content writing assistant helping users refine their ${contentType}. You provide helpful advice, answer questions about the content, and suggest improvements.

Guidelines:
1. Be helpful and constructive in your responses
2. Provide specific actionable advice when possible
3. Ask clarifying questions if the user's request is unclear
4. Suggest concrete improvements for content quality
5. Be encouraging and supportive
6. Reference the content when relevant to your response

You are currently helping with a ${contentType} titled "${projectTitle}".`
      },
      {
        role: "user",
        content: `Here's the current content:

${content}

Conversation so far:
${conversationContext}

User's latest message: ${userFeedback}

Please provide a helpful response.`
      }
    ]

    const response = await callSolarLLM(messages)
    
    return {
      response: response
    }
  }
}

async function refineContentBasedOnFeedbackStream(
  content: string,
  userFeedback: string,
  projectTitle: string,
  contentType: string,
  conversationHistory: { role: string; content: string }[]
): Promise<ReadableStream> {
  
  // Check if this is a request for content modification
  const modificationKeywords = [
    'make it', 'change', 'rewrite', 'modify', 'adjust', 'improve', 'enhance',
    'more professional', 'more casual', 'shorter', 'longer', 'simplify',
    'add more', 'remove', 'tone', 'style', 'formal', 'informal'
  ]
  
  const isContentModification = modificationKeywords.some(keyword => 
    userFeedback.toLowerCase().includes(keyword)
  )

  if (isContentModification) {
    // This is a content modification request
    const messages: SolarLLMMessage[] = [
      {
        role: "system",
        content: `You are an expert content editor. Your task is to modify the provided content based on user feedback while maintaining the core message and structure.

Guidelines:
1. Carefully analyze the user's feedback to understand what changes they want
2. Make targeted modifications while preserving the essential information
3. Maintain consistent quality and professional standards
4. If asked to change tone, adjust the language style appropriately
5. If asked to change length, add or remove content strategically
6. Ensure the modified content remains coherent and well-structured
7. Return the complete revised content, not just the changes

Always provide the full updated content after making the requested modifications.`
      },
      {
        role: "user", 
        content: `Please modify this ${contentType} titled "${projectTitle}" based on the user's feedback.

Current Content:
${content}

User Feedback: ${userFeedback}

Please provide the complete updated content incorporating the requested changes.`
      }
    ]

    return await callSolarLLMStream(messages)
  } else {
    // This is a general question or comment
    const conversationContext = conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')

    const messages: SolarLLMMessage[] = [
      {
        role: "system",
        content: `You are a professional content writing assistant helping users refine their ${contentType}. You provide helpful advice, answer questions about the content, and suggest improvements.

Guidelines:
1. Be helpful and constructive in your responses
2. Provide specific actionable advice when possible
3. Ask clarifying questions if the user's request is unclear
4. Suggest concrete improvements for content quality
5. Be encouraging and supportive
6. Reference the content when relevant to your response

You are currently helping with a ${contentType} titled "${projectTitle}".`
      },
      {
        role: "user",
        content: `Here's the current content:

${content}

Conversation so far:
${conversationContext}

User's latest message: ${userFeedback}

Please provide a helpful response.`
      }
    ]

    return await callSolarLLMStream(messages)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      content, 
      userMessage, 
      projectTitle, 
      contentType, 
      conversationHistory = [],
      stream = false
    } = await request.json()

    if (!content || !userMessage || !projectTitle || !contentType) {
      return NextResponse.json(
        { error: 'Missing required fields: content, userMessage, projectTitle, contentType' },
        { status: 400 }
      )
    }

    if (stream) {
      // Return streaming response
      const streamResponse = await refineContentBasedOnFeedbackStream(
        content,
        userMessage,
        projectTitle,
        contentType,
        conversationHistory
      )
      
      return new Response(streamResponse, {
        headers: {
          'Content-Type': 'text/stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      // Return regular response
      const result = await refineContentBasedOnFeedback(
        content,
        userMessage,
        projectTitle,
        contentType,
        conversationHistory
      )

      return NextResponse.json({
        success: true,
        data: {
          response: result.response,
          updatedContent: result.updatedContent || null,
          hasContentUpdate: !!result.updatedContent
        }
      })
    }

  } catch (error) {
    console.error('Chat refinement error:', error)
    return NextResponse.json(
      { error: 'Internal server error during content refinement' },
      { status: 500 }
    )
  }
} 