import { NextRequest, NextResponse } from 'next/server'

interface UpstageDocumentParseResponse {
  html: string
  page_count: number
  table_count: number
  figure_count: number
  text?: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF, DOC, DOCX, or TXT files.' },
        { status: 400 }
      )
    }

    const apiKey = process.env.UPSTAGE_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Upstage API key not configured' },
        { status: 500 }
      )
    }

    // Create form data for Upstage API
    const upstageFormData = new FormData()
    upstageFormData.append('document', file)

    // Call Upstage Document Parse API
    const response = await fetch('https://api.upstage.ai/v1/document-ai/document-parse', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: upstageFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Upstage API error:', response.status, errorText)
      return NextResponse.json(
        { error: `Document parsing failed: ${response.status}` },
        { status: response.status }
      )
    }

    const result: UpstageDocumentParseResponse = await response.json()
    
    // Extract text from HTML if text is not directly provided
    let extractedText = result.text || ''
    
    if (!extractedText && result.html) {
      // Simple HTML to text conversion (remove tags)
      extractedText = result.html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    return NextResponse.json({
      success: true,
      data: {
        text: extractedText,
        fileName: file.name,
        fileSize: file.size,
        pageCount: result.page_count,
        tableCount: result.table_count,
        figureCount: result.figure_count,
      }
    })

  } catch (error) {
    console.error('Upload processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error during file processing' },
      { status: 500 }
    )
  }
} 