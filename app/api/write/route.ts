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

interface Section {
  id: string
  title: string
  content: string
  status: "pending" | "writing" | "completed"
}

interface RefinedSection {
  id: string
  title: string
  description: string
  keyPoints: string[]
  estimatedLength: number
}

interface TavilySearchResult {
  title: string
  url: string
  content: string
  raw_content?: string
  score: number
}

interface TavilySearchResponse {
  query: string
  results: TavilySearchResult[]
  response_time: number
}

async function callSolarLLM(messages: SolarLLMMessage[], jsonSchema?: any): Promise<any> {
  const apiKey = process.env.UPSTAGE_API_KEY
  
  if (!apiKey) {
    throw new Error("UPSTAGE_API_KEY environment variable is required")
  }

  const requestBody: any = {
    model: process.env.UPSTAGE_MODEL_NAME || "solar-pro2-preview",
    messages: messages,
    temperature: 0.7,
    max_tokens: 4000,
    top_p: 0.9,
  }

  if (jsonSchema) {
    requestBody.response_format = {
      type: "json_schema",
      json_schema: {
        name: "writing_response",
        schema: jsonSchema,
        strict: true
      }
    }
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

async function refineSections(
  title: string,
  contentType: string,
  context: string,
  originalSections: string[]
): Promise<RefinedSection[]> {
  const schema = {
    type: "object",
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            keyPoints: {
              type: "array",
              items: { type: "string" }
            },
            estimatedLength: { type: "number" }
          },
          required: ["id", "title", "description", "keyPoints", "estimatedLength"]
        }
      }
    },
    required: ["sections"]
  }

  const messages: SolarLLMMessage[] = [
    {
      role: "system",
      content: `You are an expert content strategist and writer. Your task is to refine and improve content sections based on the project context, content type, and source materials.

Guidelines:
1. Analyze the original sections and improve them for better structure and flow
2. Ensure sections are appropriate for the specified content type
3. Consider the context and source materials when refining sections
4. Each section should have a clear purpose and contribute to the overall narrative
5. Provide key points that should be covered in each section
6. Estimate appropriate length for each section (in words)
7. Ensure logical progression and coherent structure

Respond with a JSON object containing the refined sections.`
    },
    {
      role: "user",
      content: `Please refine these content sections for a ${contentType} titled "${title}".

Original Sections:
${originalSections.map((section, index) => `${index + 1}. ${section}`).join('\n')}

Context and Source Materials:
${context}

Requirements:
- Ensure sections flow logically and build upon each other
- Make titles specific and compelling
- Provide 3-5 key points for each section
- Estimate word count for each section (typically 200-600 words per section)
- Consider the target audience and purpose of this ${contentType.toLowerCase()}
- Ensure comprehensive coverage of the topic while maintaining focus`
    }
  ]

  const content = await callSolarLLM(messages, schema)
  const result = JSON.parse(content)
  return result.sections
}

async function extractSearchKeywords(
  sectionTitle: string,
  sectionDescription: string,
  keyPoints: string[],
  context: string
): Promise<string[]> {
  const schema = {
    type: "object",
    properties: {
      keywords: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["keywords"]
  }

  const messages: SolarLLMMessage[] = [
    {
      role: "system",
      content: `You are an expert at extracting search keywords for research purposes. Your task is to identify 3-5 specific search terms that would help find the most relevant and current information for writing a section.

Guidelines:
1. Focus on concrete, searchable terms rather than abstract concepts
2. Include specific names, technologies, companies, or concepts mentioned
3. Consider current trends and recent developments
4. Prioritize terms that would yield factual, authoritative results
5. Avoid overly generic terms

Return only the keywords as a JSON array.`
    },
    {
      role: "user",
      content: `Extract search keywords for research to write this section:

Section Title: ${sectionTitle}
Section Description: ${sectionDescription}

Key Points to Cover:
${keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

Project Context:
${context}

Please extract 3-5 specific search keywords that would help find the most relevant current information for writing this section.`
    }
  ]

  try {
    const content = await callSolarLLM(messages, schema)
    const result = JSON.parse(content)
    return result.keywords || []
  } catch (error) {
    console.error('Keyword extraction failed:', error)
    // Fallback: extract basic keywords from title and key points
    const fallbackKeywords = [
      ...sectionTitle.split(' ').filter(word => word.length > 3),
      ...keyPoints.flatMap(point => 
        point.split(' ')
          .filter(word => word.length > 4)
          .slice(0, 2)
      )
    ].slice(0, 5)
    return fallbackKeywords
  }
}

async function performTavilySearch(keywords: string[]): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY
  
  if (!apiKey) {
    console.warn("TAVILY_API_KEY not provided, skipping search enhancement")
    return []
  }

  try {
    // Perform searches for each keyword and combine results
    const allResults: TavilySearchResult[] = []
    
    for (const keyword of keywords) {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: keyword,
            search_depth: "advanced",
            include_raw_content: true,
            max_results: 3,
            include_domains: [],
            exclude_domains: ['facebook.com', 'twitter.com', 'instagram.com', 'reddit.com']
          }),
        })

        if (!response.ok) {
          console.error(`Tavily API error for keyword "${keyword}": ${response.status}`)
          continue
        }

        const searchData: TavilySearchResponse = await response.json()
        allResults.push(...searchData.results)
      } catch (error) {
        console.error(`Search failed for keyword "${keyword}":`, error)
        continue
      }
    }

    // Remove duplicates and sort by score
    const uniqueResults = allResults.filter((result, index, self) =>
      index === self.findIndex(r => r.url === result.url)
    ).sort((a, b) => b.score - a.score).slice(0, 8) // Top 8 results

    return uniqueResults
  } catch (error) {
    console.error('Tavily search failed:', error)
    return []
  }
}

async function writeSection(
  sectionTitle: string,
  sectionDescription: string,
  keyPoints: string[],
  projectTitle: string,
  contentType: string,
  context: string,
  estimatedLength: number
): Promise<string> {
  try {
    // Step 1: Extract search keywords
    console.log(`Extracting keywords for section: ${sectionTitle}`)
    const keywords = await extractSearchKeywords(sectionTitle, sectionDescription, keyPoints, context)
    console.log(`Extracted keywords:`, keywords)
    
    // Step 2: Perform Tavily search
    console.log(`Searching for current information...`)
    const searchResults = await performTavilySearch(keywords)
    console.log(`Found ${searchResults.length} search results`)
    
    // Step 3: Prepare enhanced context with search results
    let enhancedContext = context
    
    if (searchResults.length > 0) {
      const searchContext = searchResults.map((result, index) => 
        `## Search Result ${index + 1}: ${result.title}
Source: ${result.url}
Content: ${result.content}
${result.raw_content ? `Full Content: ${result.raw_content.substring(0, 1500)}...` : ''}`
      ).join('\n\n')
      
      enhancedContext = `${context}

## RECENT SEARCH RESULTS AND CURRENT INFORMATION:
${searchContext}

## SEARCH KEYWORDS USED:
${keywords.join(', ')}`
    }

    const messages: SolarLLMMessage[] = [
      {
        role: "system",
        content: `You are a professional content writer specializing in creating high-quality ${contentType.toLowerCase()}s. Your task is to write engaging, informative, and well-structured content sections using both the provided context and recent search results.

Guidelines:
1. Write in a professional yet accessible tone
2. Use clear, concise language appropriate for the content type
3. Include relevant examples, data, or insights from both the context and search results
4. When incorporating information from search results, ensure accuracy and cite credible sources
5. Ensure smooth transitions and logical flow
6. Match the estimated length while maintaining quality
7. Make the content actionable and valuable to readers
8. Use appropriate formatting (headings, bullet points, etc.) when helpful
9. Prioritize current and factual information from search results
10. Blend the provided context with fresh search insights naturally

Important: If search results provide current information that complements or updates the provided context, integrate it seamlessly. Focus on creating comprehensive, up-to-date content.`
      },
      {
        role: "user",
        content: `Write a section for a ${contentType} titled "${projectTitle}".

Section Title: ${sectionTitle}
Section Description: ${sectionDescription}
Target Length: Approximately ${estimatedLength} words

Key Points to Cover:
${keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

Enhanced Context with Search Results:
${enhancedContext}

Please write a comprehensive, well-structured section that covers all key points while incorporating relevant information from both the provided context and the search results. Ensure the content is current, accurate, and flows naturally.`
      }
    ]

    return await callSolarLLM(messages)
  } catch (error) {
    console.error('Enhanced section writing failed, falling back to basic approach:', error)
    
    // Fallback to original approach without search enhancement
    const messages: SolarLLMMessage[] = [
      {
        role: "system",
        content: `You are a professional content writer specializing in creating high-quality ${contentType.toLowerCase()}s. Your task is to write engaging, informative, and well-structured content sections.

Guidelines:
1. Write in a professional yet accessible tone
2. Use clear, concise language appropriate for the content type
3. Include relevant examples, data, or insights when appropriate
4. Ensure smooth transitions and logical flow
5. Match the estimated length while maintaining quality
6. Make the content actionable and valuable to readers
7. Use appropriate formatting (headings, bullet points, etc.) when helpful
8. Ensure accuracy and credibility in all statements

Write content that is comprehensive, engaging, and serves the purpose of the overall ${contentType.toLowerCase()}.`
      },
      {
        role: "user",
        content: `Write a section for a ${contentType} titled "${projectTitle}".

Section Title: ${sectionTitle}
Section Description: ${sectionDescription}
Target Length: Approximately ${estimatedLength} words

Key Points to Cover:
${keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

Context and Reference Materials:
${context}

Please write a comprehensive, well-structured section that covers all key points while maintaining engagement and professional quality. Use appropriate formatting and ensure the content flows naturally.`
      }
    ]

    return await callSolarLLM(messages)
  }
}

async function refineCoherence(
  projectTitle: string,
  contentType: string,
  allSections: { title: string; content: string }[]
): Promise<string> {
  const fullContent = allSections.map(section => `## ${section.title}\n\n${section.content}`).join('\n\n')
  
  const messages: SolarLLMMessage[] = [
    {
      role: "system",
      content: `You are an expert content editor with a meticulous eye for consistency and professional writing standards. Your mission is to transform the content into a cohesive, professional piece that reads as if written by a single expert author.

CRITICAL CONSISTENCY REQUIREMENTS:

1. **Formatting & Structure Consistency:**
   - Standardize ALL numbering systems (1., 2., 3. OR i., ii., iii. - pick ONE style and apply throughout)
   - Ensure consistent heading hierarchy (# Main Headings, ## Sub-headings, ### Sub-sub-headings)
   - Standardize bullet point styles (• or - consistently)
   - Maintain uniform spacing and paragraph structure

2. **Tone & Voice Unification:**
   - Establish ONE consistent authorial voice (professional, conversational, academic, etc.)
   - Eliminate tonal shifts between sections
   - Ensure consistent level of formality throughout
   - Use consistent person (first person "we", second person "you", or third person "one")

3. **Terminology & Language Consistency:**
   - Use identical terms for the same concepts throughout (no synonym variation)
   - Maintain consistent technical vocabulary and definitions
   - Standardize abbreviations and acronyms (spell out on first use, then consistent usage)
   - Ensure consistent capitalization and punctuation styles

4. **Content Flow & Transitions:**
   - Create seamless bridges between sections that feel natural
   - Eliminate redundant information and repetitive statements
   - Ensure logical progression of ideas from simple to complex
   - Make sure each section builds upon previous content

5. **Professional Polish:**
   - Eliminate informal language inconsistencies
   - Ensure consistent sentence structures and complexity
   - Standardize citation and reference styles if applicable
   - Create a unified reading experience

The result should feel like a single expert wrote the entire piece with careful attention to detail and consistency.`
    },
    {
      role: "user",
      content: `Transform this ${contentType} titled "${projectTitle}" into a professionally consistent and cohesive piece. Pay special attention to creating uniformity in formatting, tone, and structure.

CONTENT TO REFINE:
${fullContent}

SPECIFIC REFINEMENT TASKS:
1. **Standardize ALL numbering and formatting** - ensure consistent numbering schemes throughout (1., 2., 3. or i., ii., iii. - choose one style)
2. **Unify the authorial voice** - make it sound like one expert wrote the entire piece with consistent tone and manner
3. **Eliminate formatting inconsistencies** - standardize headings, bullet points, spacing, and structure
4. **Smooth transitions** - create natural bridges between sections that enhance flow
5. **Remove redundancy** - eliminate repetitive content while preserving key information
6. **Consistent terminology** - use identical terms for the same concepts throughout
7. **Professional polish** - ensure consistent formality level and writing quality
8. **Coherent conclusion** - tie all sections together with a strong, unified ending

Return the complete refined content with all sections included, maintaining the original structure while achieving perfect consistency and professional quality.`
    }
  ]

  return await callSolarLLM(messages)
}

async function refineCoherenceStream(
  projectTitle: string,
  contentType: string,
  allSections: { title: string; content: string }[]
): Promise<ReadableStream> {
  const fullContent = allSections.map(section => `## ${section.title}\n\n${section.content}`).join('\n\n')
  
  const messages: SolarLLMMessage[] = [
    {
      role: "system",
      content: `You are an expert content editor with a meticulous eye for consistency and professional writing standards. Your mission is to transform the content into a cohesive, professional piece that reads as if written by a single expert author.

CRITICAL CONSISTENCY REQUIREMENTS:

1. **Formatting & Structure Consistency:**
   - Standardize ALL numbering systems (1., 2., 3. OR i., ii., iii. - pick ONE style and apply throughout)
   - Ensure consistent heading hierarchy (# Main Headings, ## Sub-headings, ### Sub-sub-headings)
   - Standardize bullet point styles (• or - consistently)
   - Maintain uniform spacing and paragraph structure

2. **Tone & Voice Unification:**
   - Establish ONE consistent authorial voice (professional, conversational, academic, etc.)
   - Eliminate tonal shifts between sections
   - Ensure consistent level of formality throughout
   - Use consistent person (first person "we", second person "you", or third person "one")

3. **Terminology & Language Consistency:**
   - Use identical terms for the same concepts throughout (no synonym variation)
   - Maintain consistent technical vocabulary and definitions
   - Standardize abbreviations and acronyms (spell out on first use, then consistent usage)
   - Ensure consistent capitalization and punctuation styles

4. **Content Flow & Transitions:**
   - Create seamless bridges between sections that feel natural
   - Eliminate redundant information and repetitive statements
   - Ensure logical progression of ideas from simple to complex
   - Make sure each section builds upon previous content

5. **Professional Polish:**
   - Eliminate informal language inconsistencies
   - Ensure consistent sentence structures and complexity
   - Standardize citation and reference styles if applicable
   - Create a unified reading experience

The result should feel like a single expert wrote the entire piece with careful attention to detail and consistency.`
    },
    {
      role: "user",
      content: `Transform this ${contentType} titled "${projectTitle}" into a professionally consistent and cohesive piece. Pay special attention to creating uniformity in formatting, tone, and structure.

CONTENT TO REFINE:
${fullContent}

SPECIFIC REFINEMENT TASKS:
1. **Standardize ALL numbering and formatting** - ensure consistent numbering schemes throughout (1., 2., 3. or i., ii., iii. - choose one style)
2. **Unify the authorial voice** - make it sound like one expert wrote the entire piece with consistent tone and manner
3. **Eliminate formatting inconsistencies** - standardize headings, bullet points, spacing, and structure
4. **Smooth transitions** - create natural bridges between sections that enhance flow
5. **Remove redundancy** - eliminate repetitive content while preserving key information
6. **Consistent terminology** - use identical terms for the same concepts throughout
7. **Professional polish** - ensure consistent formality level and writing quality
8. **Coherent conclusion** - tie all sections together with a strong, unified ending

Return the complete refined content with all sections included, maintaining the original structure while achieving perfect consistency and professional quality.`
    }
  ]

  return await callSolarLLMStream(messages)
}

async function writeSectionStream(
  sectionTitle: string,
  sectionDescription: string,
  keyPoints: string[],
  projectTitle: string,
  contentType: string,
  context: string,
  estimatedLength: number
): Promise<ReadableStream> {
  try {
    // Create a transform stream to handle progress updates
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Function to send progress updates
    const sendProgress = (data: any) => {
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    }

    // Step 1: Extract search keywords
    console.log(`Extracting keywords for section: ${sectionTitle}`)
    sendProgress({ type: 'progress', message: `Extracting search keywords for: ${sectionTitle}` })
    
    const keywords = await extractSearchKeywords(sectionTitle, sectionDescription, keyPoints, context)
    console.log(`Extracted keywords:`, keywords)
    
    sendProgress({ 
      type: 'keywords', 
      keywords: keywords,
      message: `Keywords extracted: ${keywords.join(', ')}`
    })
    
    // Step 2: Perform search
    console.log(`Searching for current information...`)
    sendProgress({ type: 'progress', message: 'Searching for current information...' })
    
    const searchResults = await performTavilySearch(keywords)
    console.log(`Found ${searchResults.length} search results`)
    
    sendProgress({ 
      type: 'search_results', 
      results: searchResults.map(r => ({ title: r.title, url: r.url, content: r.content.substring(0, 200) + '...' })),
      message: `Found ${searchResults.length} relevant sources`
    })
    
    sendProgress({ type: 'progress', message: 'Starting content generation...' })
    
    // Step 3: Prepare enhanced context with search results
    let enhancedContext = context
    
    if (searchResults.length > 0) {
      const searchContext = searchResults.map((result, index) => 
        `## Search Result ${index + 1}: ${result.title}
Source: ${result.url}
Content: ${result.content}
${result.raw_content ? `Full Content: ${result.raw_content.substring(0, 1500)}...` : ''}`
      ).join('\n\n')
      
      enhancedContext = `${context}

## RECENT SEARCH RESULTS AND CURRENT INFORMATION:
${searchContext}

## SEARCH KEYWORDS USED:
${keywords.join(', ')}`
    }

    const messages: SolarLLMMessage[] = [
      {
        role: "system",
        content: `You are a professional content writer specializing in creating high-quality ${contentType.toLowerCase()}s. Your task is to write engaging, informative, and well-structured content sections using both the provided context and recent search results.

Guidelines:
1. Write in a professional yet accessible tone
2. Use clear, concise language appropriate for the content type
3. Include relevant examples, data, or insights from both the context and search results
4. When incorporating information from search results, ensure accuracy and cite credible sources
5. Ensure smooth transitions and logical flow
6. Match the estimated length while maintaining quality
7. Make the content actionable and valuable to readers
8. Use appropriate formatting (headings, bullet points, etc.) when helpful
9. Prioritize current and factual information from search results
10. Blend the provided context with fresh search insights naturally

Important: If search results provide current information that complements or updates the provided context, integrate it seamlessly. Focus on creating comprehensive, up-to-date content.`
      },
      {
        role: "user",
        content: `Write a section for a ${contentType} titled "${projectTitle}".

Section Title: ${sectionTitle}
Section Description: ${sectionDescription}
Target Length: Approximately ${estimatedLength} words

Key Points to Cover:
${keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

Enhanced Context with Search Results:
${enhancedContext}

Please write a comprehensive, well-structured section that covers all key points while incorporating relevant information from both the provided context and the search results. Ensure the content is current, accurate, and flows naturally.`
      }
    ]

    // Step 4: Stream the content generation
    const processContentStream = async () => {
      try {
        const contentStream = await callSolarLLMStream(messages)
        const reader = contentStream.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine.startsWith('data: ')) {
              const jsonData = trimmedLine.slice(6)
              try {
                const parsed = JSON.parse(jsonData)
                if (parsed.content) {
                  // Forward the content with type indicator
                  sendProgress({ type: 'content', content: parsed.content })
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }
      } catch (error) {
        console.error('Content generation error:', error)
        sendProgress({ type: 'error', message: 'Content generation failed' })
      } finally {
        writer.close()
      }
    }

    processContentStream()
    return readable
  } catch (error) {
    console.error('Enhanced section writing failed, falling back to basic approach:', error)
    
    // Fallback to original approach without search enhancement
    const messages: SolarLLMMessage[] = [
      {
        role: "system",
        content: `You are a professional content writer specializing in creating high-quality ${contentType.toLowerCase()}s. Your task is to write engaging, informative, and well-structured content sections.

Guidelines:
1. Write in a professional yet accessible tone
2. Use clear, concise language appropriate for the content type
3. Include relevant examples, data, or insights when appropriate
4. Ensure smooth transitions and logical flow
5. Match the estimated length while maintaining quality
6. Make the content actionable and valuable to readers
7. Use appropriate formatting (headings, bullet points, etc.) when helpful
8. Ensure accuracy and credibility in all statements

Write content that is comprehensive, engaging, and serves the purpose of the overall ${contentType.toLowerCase()}.`
      },
      {
        role: "user",
        content: `Write a section for a ${contentType} titled "${projectTitle}".

Section Title: ${sectionTitle}
Section Description: ${sectionDescription}
Target Length: Approximately ${estimatedLength} words

Key Points to Cover:
${keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

Context and Reference Materials:
${context}

Please write a comprehensive, well-structured section that covers all key points while maintaining engagement and professional quality. Use appropriate formatting and ensure the content flows naturally.`
      }
    ]

    return await callSolarLLMStream(messages)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, stream, ...data } = await request.json()

    switch (action) {
      case 'refine-sections':
        const { title, contentType, context, sections } = data
        const refinedSections = await refineSections(title, contentType, context, sections)
        return NextResponse.json({ success: true, data: refinedSections })

      case 'write-section':
        const { 
          sectionTitle, 
          sectionDescription, 
          keyPoints, 
          projectTitle, 
          projectContentType, 
          projectContext, 
          estimatedLength 
        } = data

        if (stream) {
          // Return streaming response
          const streamResponse = await writeSectionStream(
            sectionTitle, 
            sectionDescription, 
            keyPoints, 
            projectTitle, 
            projectContentType, 
            projectContext, 
            estimatedLength
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
          const sectionContent = await writeSection(
            sectionTitle, 
            sectionDescription, 
            keyPoints, 
            projectTitle, 
            projectContentType, 
            projectContext, 
            estimatedLength
          )
          return NextResponse.json({ success: true, data: { content: sectionContent } })
        }

      case 'refine-coherence':
        const { projectTitle: title2, contentType: type2, sections: allSections } = data

        if (stream) {
          // Return streaming response
          const streamResponse = await refineCoherenceStream(title2, type2, allSections)
          
          return new Response(streamResponse, {
            headers: {
              'Content-Type': 'text/stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          })
        } else {
          // Return regular response
          const refinedContent = await refineCoherence(title2, type2, allSections)
          return NextResponse.json({ success: true, data: { content: refinedContent } })
        }

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Writing API error:', error)
    return NextResponse.json(
      { error: 'Internal server error during content generation' },
      { status: 500 }
    )
  }
} 