"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Send, Bot, Download, Copy, RefreshCw, ChevronDown, ChevronRight, Brain } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'



interface ChatInterfaceProps {
  projectTitle: string
  initialContent: string
  contentType: string
  isStreamingFinalPolish?: boolean
  streamingSource?: (() => Promise<ReadableStream>) | null
}

const TONE_SUGGESTIONS = [
  "Professional",
  "Conversational", 
  "Persuasive",
  "Simpler",
  "Technical",
  "Engaging",
  "Shorter",
  "More Examples",
  "Formal",
  "Casual"
]

export function ChatInterface({ projectTitle, initialContent, contentType, isStreamingFinalPolish = false, streamingSource }: ChatInterfaceProps) {
  const [currentMessage, setCurrentMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [content, setContent] = useState(initialContent)
  const [isFinalPolishStreaming, setIsFinalPolishStreaming] = useState(false)
  const [thinkingContent, setThinkingContent] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const [showThinking, setShowThinking] = useState(false)
  const [finalPolishStarted, setFinalPolishStarted] = useState(false)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const bufferedContentRef = useRef<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  // Handle streaming final polish when component mounts
  useEffect(() => {
    if (isStreamingFinalPolish && streamingSource && !finalPolishStarted) {
      startFinalPolishStreaming()
    }
  }, [isStreamingFinalPolish, streamingSource, finalPolishStarted])

  const processStreamingContent = (rawContent: string) => {
    // Separate thinking content from actual content
    const thinkingRegex = /<think>([\s\S]*?)<\/think>/g
    let processedContent = rawContent
    let allThinkingContent = ''
    
    // Extract all thinking content
    let match
    while ((match = thinkingRegex.exec(rawContent)) !== null) {
      allThinkingContent += match[1] + '\n\n'
    }
    
    // Remove thinking tags from main content
    processedContent = rawContent.replace(/<think>[\s\S]*?<\/think>/g, '')
    
    // Update thinking state
    if (allThinkingContent.trim()) {
      setThinkingContent(allThinkingContent.trim())
      setIsThinking(true)
    } else if (isThinking && !rawContent.includes('<think>')) {
      // Thinking phase is complete
      setIsThinking(false)
    }
    
    return processedContent
  }

  const debouncedContentUpdate = (processedContent: string) => {
    // Store the latest content in ref
    bufferedContentRef.current = processedContent
    
    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }
    
    // Set new timeout to update content
    updateTimeoutRef.current = setTimeout(() => {
      setContent(bufferedContentRef.current)
      updateTimeoutRef.current = null
    }, 150) // Update every 150ms maximum
  }

  const startFinalPolishStreaming = async () => {
    if (!streamingSource || finalPolishStarted) return

    setFinalPolishStarted(true)
    setIsFinalPolishStreaming(true)
    setThinkingContent("")
    setIsThinking(false)
    setShowThinking(false)

    try {
      const stream = await streamingSource()
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let rawAccumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonData = trimmedLine.slice(6)
              const parsed = JSON.parse(jsonData)
              
              if (parsed.content) {
                rawAccumulatedContent += parsed.content
                const processedContent = processStreamingContent(rawAccumulatedContent)
                
                // Use debounced update to prevent jittering
                debouncedContentUpdate(processedContent)
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      // Ensure final content is set immediately when streaming completes
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
        updateTimeoutRef.current = null
      }
      
      const finalProcessedContent = processStreamingContent(rawAccumulatedContent)
      setContent(finalProcessedContent)

    } catch (error) {
      console.error('Final polish streaming failed:', error)
    } finally {
      setIsFinalPolishStreaming(false)
    }
  }

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading || isFinalPolishStreaming) return

    const messageToSend = currentMessage
    setCurrentMessage("")
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content,
          userMessage: messageToSend,
          projectTitle: projectTitle,
          contentType: contentType,
          conversationHistory: [],
          stream: true
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      // Handle streaming response and update content directly
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine.startsWith('data: ')) {
              try {
                const jsonData = trimmedLine.slice(6)
                const parsed = JSON.parse(jsonData)
                
                if (parsed.content) {
                  accumulatedContent += parsed.content
                  
                  // Directly update content preview in real-time
                  setContent(accumulatedContent)
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }
      } else {
        throw new Error('No response stream available')
      }
    } catch (error) {
      console.error('Chat error:', error)
      // Just log the error, no need for error messages in chat
    } finally {
      setIsLoading(false)
    }
  }

  const handleToneSuggestion = (suggestion: string) => {
    setCurrentMessage(suggestion)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const copyContent = () => {
    navigator.clipboard.writeText(content)
  }

  const downloadContent = () => {
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${projectTitle.replace(/\s+/g, "-").toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Global Status Indicator - Outside of input card */}
      {isFinalPolishStreaming && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-3 text-blue-800">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <div>
              <span className="font-semibold">🎨 Final Polish in Progress</span>
              <p className="text-sm text-blue-600 mt-1">
                Refining your content for consistency, flow, and professional quality...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Input Panel - Clean content editing interface */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="w-5 h-5" />
            Content Refinement
            <span className="text-sm text-muted-foreground font-normal ml-2">
              - Make requests and see updates below
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {/* Message Input - Most prominent */}
          <div className="mb-4">
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder="Describe changes you want: adjust tone, add details, make shorter, change style, etc. (Press Enter to apply)"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="w-full"
                  disabled={isLoading || isFinalPolishStreaming}
                />
              </div>
              <Button 
                onClick={handleSendMessage} 
                disabled={!currentMessage.trim() || isLoading || isFinalPolishStreaming}
                className="shrink-0 px-4 py-2"
                size="lg"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Quick Suggestions */}
          <div>
            <p className="text-sm font-medium mb-2">Quick suggestions:</p>
            <div className="w-full border rounded-md p-3 bg-muted/30 overflow-hidden">
              <div className="flex flex-wrap gap-2">
                {TONE_SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => handleToneSuggestion(`Make it ${suggestion.toLowerCase()}`)}
                    className="text-xs h-8 px-3 flex-shrink-0"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Content Panel - Now below chat for results */}
      <Card className="flex flex-col flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Updated Content
              {(isLoading || isFinalPolishStreaming) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Updating...
                </div>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyContent}>
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={downloadContent}>
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <Tabs defaultValue="preview" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="flex-1 mt-4">
              <ScrollArea className="h-full">
                {/* AI Thinking Section */}
                {(isThinking || thinkingContent) && (
                  <div className="mb-4 border rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
                    <button
                      onClick={() => setShowThinking(!showThinking)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-amber-100/50 rounded-t-lg transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-amber-600" />
                        <span className="font-medium text-amber-800">
                          {isThinking ? 'AI is thinking...' : 'AI Thought Process'}
                        </span>
                        {isThinking && (
                          <div className="w-3 h-3 border border-amber-400 border-t-amber-600 rounded-full animate-spin" />
                        )}
                      </div>
                      {showThinking ? (
                        <ChevronDown className="w-4 h-4 text-amber-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-amber-600" />
                      )}
                    </button>
                    
                    {showThinking && (
                      <div className="p-3 pt-0 border-t border-amber-200">
                        <div className="text-sm text-amber-800 whitespace-pre-wrap font-mono bg-amber-50 p-3 rounded border">
                          {thinkingContent || 'Processing and analyzing content...'}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Content Container with Stable Layout */}
                <div className="relative">
                  {isFinalPolishStreaming && (
                    <div className="absolute top-0 right-0 z-10 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-bl-lg border-l border-b border-blue-200">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 border border-blue-400 border-t-blue-600 rounded-full animate-spin" />
                        Refining...
                      </div>
                    </div>
                  )}
                  
                  <div 
                    className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground transition-all duration-75 ease-out"
                    style={{
                      minHeight: isFinalPolishStreaming ? '400px' : 'auto',
                      transition: 'opacity 0.1s ease-out',
                    }}
                  >
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                      h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4 text-foreground" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-xl font-semibold mb-3 text-foreground" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-lg font-medium mb-2 text-foreground" {...props} />,
                      p: ({node, ...props}) => <p className="mb-3 text-foreground leading-relaxed" {...props} />,
                      ul: ({node, ...props}) => <ul className="mb-3 list-disc list-inside space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="mb-3 list-decimal list-inside space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="text-foreground" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                      em: ({node, ...props}) => <em className="italic text-foreground" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4 text-muted-foreground" {...props} />,
                      code: ({node, className, children, ...props}) => {
                        const match = /language-(\w+)/.exec(className || '')
                        const isInline = !match
                        return isInline 
                          ? <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
                          : <code className="block bg-muted p-3 rounded text-sm font-mono overflow-x-auto" {...props}>{children}</code>
                      },
                      hr: ({node, ...props}) => <hr className="my-6 border-gray-300" {...props} />,
                    }}
                                      >
                      {content}
                    </ReactMarkdown>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="edit" className="flex-1 mt-4">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="h-full resize-none"
                placeholder="Edit your content directly..."
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
