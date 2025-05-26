import { NextRequest, NextResponse } from 'next/server'
import FirecrawlApp from '@mendable/firecrawl-js'

// Force this API route to use Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json(
        { error: 'No URL provided' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    const apiKey = process.env.FIRECRAWL_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Firecrawl API key not configured' },
        { status: 500 }
      )
    }

    // Initialize Firecrawl
    const app = new FirecrawlApp({ apiKey })

    // Scrape the URL
    const scrapeResponse = await app.scrapeUrl(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true, // Focus on main content, excluding navigation, ads, etc.
    })

    if (!scrapeResponse.success) {
      console.error('Firecrawl scraping failed:', scrapeResponse.error)
      return NextResponse.json(
        { error: `Failed to scrape URL: ${scrapeResponse.error}` },
        { status: 500 }
      )
    }

    // Extract data from the response
    const responseData = (scrapeResponse as any).data || scrapeResponse
    
    return NextResponse.json({
      success: true,
      data: {
        url: responseData.url || url,
        title: responseData.metadata?.title || 'No title available',
        text: responseData.markdown || responseData.content || 'No content extracted',
        description: responseData.metadata?.description || '',
        author: responseData.metadata?.author || '',
        publishedDate: responseData.metadata?.publishedTime || '',
        wordCount: responseData.markdown ? responseData.markdown.split(/\s+/).length : 0,
      }
    })

  } catch (error) {
    console.error('URL scraping error:', error)
    return NextResponse.json(
      { error: 'Internal server error during URL scraping' },
      { status: 500 }
    )
  }
} 