"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, Clock, Sparkles, RefreshCw, Brain, FileText } from "lucide-react"
import { useTranslations } from 'next-intl'
import type { Section } from "@/app/page"

interface RefinedSection {
  id: string
  title: string
  description: string
  keyPoints: string[]
  estimatedLength: number
}

interface WritingProgressProps {
  sections: Section[]
  setSections: React.Dispatch<React.SetStateAction<Section[]>>
  onComplete: (finalContent: string, isStreaming?: boolean, streamingSource?: () => Promise<ReadableStream>) => void
  projectData: {
    title: string
    contentType: string
    sources: {
      text: string
      url: string
      files: File[]
    }
    outline: string
  }
}

export function WritingProgress({ sections, setSections, onComplete, projectData }: WritingProgressProps) {
  const t = useTranslations('progress')
  const [currentPhase, setCurrentPhase] = useState<'refining-sections' | 'writing' | 'coherence' | 'complete'>('refining-sections')
  const [refinedSections, setRefinedSections] = useState<RefinedSection[]>([])
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState(t('status.initializing'))
  
  // Search process tracking
  const [currentKeywords, setCurrentKeywords] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<Array<{title: string, url: string, content: string}>>([])
  const [searchPhase, setSearchPhase] = useState<'idle' | 'extracting' | 'searching' | 'writing'>('idle')
  
  // Structure analysis tracking
  const [analysisStep, setAnalysisStep] = useState<string>("")
  const [analysisDetails, setAnalysisDetails] = useState<string[]>([])

  // Start the writing process
  useEffect(() => {
    if (currentPhase === 'refining-sections' && !isProcessing) {
      refineOriginalSections()
    }
  }, [currentPhase])

  // Handle section writing process
  useEffect(() => {
    if (currentPhase === 'writing' && currentSectionIndex < refinedSections.length && !isProcessing) {
      writeCurrentSection()
    } else if (currentPhase === 'writing' && currentSectionIndex >= refinedSections.length && !isProcessing) {
      // All sections written, automatically move to Final Polish (coherence phase)
      setTimeout(() => {
        setCurrentPhase('coherence')
        refineCoherence()
      }, 500) // Small delay for better UX
    }
  }, [currentPhase, currentSectionIndex, refinedSections, isProcessing])

  const refineOriginalSections = async () => {
    setIsProcessing(true)
    setAnalysisStep("")
    setAnalysisDetails([])
    setStatusMessage(t('status.analyzing'))
    setProgress(10)

    try {
      // Show progressive analysis steps
      setAnalysisStep(t('analysis.analyzingContentType'))
      setAnalysisDetails([`Content Type: ${projectData.contentType}`, `Outline sections: ${projectData.outline.split('\n').filter(line => line.trim()).length}`])
      await new Promise(resolve => setTimeout(resolve, 800))
      
      setAnalysisStep(t('analysis.examiningSourceMaterials'))
      const sourceDetails = []
      if (projectData.sources.text) sourceDetails.push(`✓ Text content (${projectData.sources.text.length} characters)`)
      if (projectData.sources.url) sourceDetails.push(`✓ URL content included`)
      if (projectData.sources.files.length > 0) sourceDetails.push(`✓ ${projectData.sources.files.length} uploaded files`)
      setAnalysisDetails(sourceDetails)
      await new Promise(resolve => setTimeout(resolve, 600))

      setAnalysisStep(t('analysis.optimizingSectionStructure'))
      setAnalysisDetails(["Analyzing section flow and coherence", "Identifying content gaps", "Determining optimal section length"])
      setProgress(15)

      const context = `
        Source Text: ${projectData.sources.text}
        URL Content: ${projectData.sources.url ? `Content from: ${projectData.sources.url}` : 'No URL provided'}
        Additional Files: ${projectData.sources.files.length > 0 ? `${projectData.sources.files.length} files uploaded` : 'No files uploaded'}
      `.trim()

      const originalSectionTitles = projectData.outline.split('\n').filter(line => line.trim())

      setAnalysisStep(t('analysis.generatingEnhancedSections'))
      setAnalysisDetails(["Processing with AI", "Enhancing section descriptions", "Adding key points and structure"])

      const response = await fetch('/api/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refine-sections',
          title: projectData.title,
          contentType: projectData.contentType,
          context: context,
          sections: originalSectionTitles
        }),
      })

      const result = await response.json()

      if (result.success) {
        setAnalysisStep(t('analysis.finalizingStructure'))
        setAnalysisDetails([
          t('analysis.sectionsOptimized', { count: result.data.length }),
          t('analysis.sectionDescriptionsEnhanced'),
          t('analysis.keyPointsIdentified'),
          t('analysis.contentFlowOptimized')
        ])
        setProgress(20)
        await new Promise(resolve => setTimeout(resolve, 500))
        
        setRefinedSections(result.data)
        
        // Update sections with refined structure
        const updatedSections: Section[] = result.data.map((refinedSection: RefinedSection) => ({
          id: refinedSection.id,
          title: refinedSection.title,
          content: '',
          status: 'pending' as const
        }))
        
        setSections(updatedSections)
        setProgress(25)
        setCurrentPhase('writing')
        setStatusMessage(t('status.preparingContentGeneration'))
        
        // Clear analysis tracking
        setAnalysisStep("")
        setAnalysisDetails([])
      } else {
        throw new Error(result.error || 'Failed to refine sections')
      }
    } catch (error) {
      console.error('Section refinement failed:', error)
      setStatusMessage("Error refining sections. Using original outline...")
      
      // Fallback to original sections
      const fallbackSections = projectData.outline.split('\n').filter(line => line.trim()).map((title, index) => ({
        id: `section-${index}`,
        title: title.trim(),
        description: `Content for ${title.trim()}`,
        keyPoints: [`Key point for ${title.trim()}`],
        estimatedLength: 300
      }))
      
      setRefinedSections(fallbackSections)
      setCurrentPhase('writing')
      setAnalysisStep("")
      setAnalysisDetails([])
    } finally {
      setIsProcessing(false)
    }
  }

  const writeCurrentSection = async () => {
    setIsProcessing(true)
    const currentRefinedSection = refinedSections[currentSectionIndex]
    
    // Reset search tracking for new section
    setCurrentKeywords([])
    setSearchResults([])
    setSearchPhase('extracting') // Start showing the research box immediately
    setStatusMessage(t('status.preparingToWrite', { title: currentRefinedSection.title }))
    
    // Update section status to writing
    setSections((prevSections: Section[]) => 
      prevSections.map((section: Section, index: number) => 
        index === currentSectionIndex 
          ? { ...section, status: 'writing' as const }
          : section
      )
    )

    try {
      const context = `
        Source Text: ${projectData.sources.text}
        URL Content: ${projectData.sources.url ? `Content from: ${projectData.sources.url}` : 'No URL provided'}
        Additional Files: ${projectData.sources.files.length > 0 ? `${projectData.sources.files.length} files uploaded` : 'No files uploaded'}
      `.trim()

      const response = await fetch('/api/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'write-section',
          stream: true,
          sectionTitle: currentRefinedSection.title,
          sectionDescription: currentRefinedSection.description,
          keyPoints: currentRefinedSection.keyPoints,
          projectTitle: projectData.title,
          projectContentType: projectData.contentType,
          projectContext: context,
          estimatedLength: currentRefinedSection.estimatedLength
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      // Handle streaming response
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
                
                // Handle different types of updates
                if (parsed.type === 'keywords') {
                  setCurrentKeywords(parsed.keywords)
                  setSearchPhase('extracting')
                  setStatusMessage(parsed.message)
                } else if (parsed.type === 'search_results') {
                  setSearchResults(parsed.results)
                  setSearchPhase('searching')
                  setStatusMessage(parsed.message)
                } else if (parsed.type === 'progress') {
                  setStatusMessage(parsed.message)
                  if (parsed.message.includes('Starting content generation')) {
                    setSearchPhase('writing')
                  }
                } else if (parsed.type === 'content' && parsed.content) {
                  accumulatedContent += parsed.content
                  
                  // Update section content in real-time
                  setSections((prevSections: Section[]) => 
                    prevSections.map((section: Section, index: number) => 
                      index === currentSectionIndex 
                        ? { 
                            ...section, 
                            content: accumulatedContent, 
                            status: 'writing' as const 
                          }
                        : section
                    )
                  )
                } else if (parsed.content) {
                  // Fallback for old format
                  accumulatedContent += parsed.content
                  
                  setSections((prevSections: Section[]) => 
                    prevSections.map((section: Section, index: number) => 
                      index === currentSectionIndex 
                        ? { 
                            ...section, 
                            content: accumulatedContent, 
                            status: 'writing' as const 
                          }
                        : section
                    )
                  )
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }

        // Mark section as completed
        setSections((prevSections: Section[]) => 
          prevSections.map((section: Section, index: number) => 
            index === currentSectionIndex 
              ? { 
                  ...section, 
                  content: accumulatedContent, 
                  status: 'completed' as const 
                }
              : section
          )
        )

        // Reset search state after completion
        setSearchPhase('idle')
        setStatusMessage(t('status.sectionCompleted', { title: currentRefinedSection.title }))

        // Update progress
        const newProgress = 25 + ((currentSectionIndex + 1) / refinedSections.length) * 50
        setProgress(newProgress)
        
        // Move to next section
        setCurrentSectionIndex(prev => prev + 1)
      } else {
        throw new Error('No response stream available')
      }
    } catch (error) {
      console.error('Section writing failed:', error)
      
             // Fallback content
       setSections((prevSections: Section[]) => 
         prevSections.map((section: Section, index: number) => 
           index === currentSectionIndex 
             ? { 
                 ...section, 
                 content: `This section would cover ${currentRefinedSection.title}. Content generation failed, but the structure is in place for manual editing.`, 
                 status: 'completed' as const 
               }
             : section
         )
       )
      
      setCurrentSectionIndex(prev => prev + 1)
    } finally {
      setIsProcessing(false)
    }
  }

  const refineCoherence = async () => {
    setIsProcessing(true)
    setStatusMessage(t('status.finalPolishStandardizing'))
    setProgress(80)

    try {
      // Get all completed sections
      const completedSections = sections
        .filter(section => section.status === 'completed' && section.content)
        .map(section => ({
          title: section.title,
          content: section.content
        }))

      if (completedSections.length === 0) {
        throw new Error('No completed sections to refine')
      }

      // Create the initial content from completed sections
      const initialContent = sections
        .filter(section => section.content)
        .map(section => `## ${section.title}\n\n${section.content}`)
        .join('\n\n')

      // Create streaming function for the chat interface
      const createStreamingSource = async (): Promise<ReadableStream> => {
        const response = await fetch('/api/write', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'refine-coherence',
            stream: true,
            projectTitle: projectData.title,
            contentType: projectData.contentType,
            sections: completedSections
          }),
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        return response.body!
      }

      // Immediately transition to chat interface with streaming
      setProgress(85)
      setCurrentPhase('complete')
      setStatusMessage(t('status.transitioningToFinalPolish'))
      
      setTimeout(() => {
        onComplete(initialContent, true, createStreamingSource)
      }, 500)

    } catch (error) {
      console.error('Coherence refinement failed:', error)
      
      // Fallback - just combine sections
      const fallbackContent = sections
        .filter(section => section.content)
        .map(section => `## ${section.title}\n\n${section.content}`)
        .join('\n\n')
      
      setProgress(100)
      setCurrentPhase('complete')
      setStatusMessage(t('status.contentGenerationCompleted'))
      onComplete(fallbackContent)
    } finally {
      setIsProcessing(false)
    }
  }

  const getPhaseIcon = () => {
    switch (currentPhase) {
      case 'refining-sections':
        return <Brain className="w-5 h-5" />
      case 'writing':
        return <FileText className="w-5 h-5" />
      case 'coherence':
        return <RefreshCw className="w-5 h-5" />
      case 'complete':
        return <CheckCircle className="w-5 h-5" />
      default:
        return <Sparkles className="w-5 h-5" />
    }
  }

  const getPhaseDescription = () => {
    switch (currentPhase) {
      case 'refining-sections':
        return t('descriptions.structureAnalysisDescription')
      case 'writing':
        return t('descriptions.contentCreationDescription')
      case 'coherence':
        return t('descriptions.finalPolishDescription')
      case 'complete':
        return t('status.contentGenerationCompleted')
      default:
        return t('status.preparingContentGeneration')
    }
  }

  const completedSections = sections.filter((s) => s.status === "completed").length
  const totalSections = sections.length

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {getPhaseIcon()}
              {t('title')}
            </span>
            <Badge variant="secondary">
              {completedSections}/{totalSections} sections
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {statusMessage}
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {getPhaseDescription()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Phase Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`${currentPhase === 'refining-sections' || progress > 25 ? 'bg-blue-50 border-blue-200' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                progress > 25 ? 'bg-blue-500 text-white' : currentPhase === 'refining-sections' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <Brain className="w-4 h-4" />
                {currentPhase === 'refining-sections' && (
                  <div className="absolute w-8 h-8 border border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">{t('phases.structureAnalysis')}</p>
                <p className="text-sm text-muted-foreground">
                  {currentPhase === 'refining-sections' && analysisStep ? analysisStep : t('descriptions.optimizingSections')}
                </p>
              </div>
            </div>
            
            {/* Analysis Progress Details */}
            {currentPhase === 'refining-sections' && analysisDetails.length > 0 && (
              <div className="mt-4 p-3 bg-blue-100/50 rounded-lg border border-blue-200">
                <div className="space-y-1">
                  {analysisDetails.map((detail, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-blue-800">
                      <div className="w-1 h-1 rounded-full bg-blue-500" />
                      {detail}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`${currentPhase === 'writing' || progress > 75 ? 'bg-green-50 border-green-200' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                progress > 75 ? 'bg-green-500 text-white' : currentPhase === 'writing' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium">{t('phases.contentCreation')}</p>
                <p className="text-sm text-muted-foreground">{t('descriptions.aiWritingWithLiveSearch')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`${currentPhase === 'coherence' || currentPhase === 'complete' ? 'bg-purple-50 border-purple-200' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentPhase === 'complete' ? 'bg-purple-500 text-white' : currentPhase === 'coherence' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium">{t('phases.finalPolish')}</p>
                <p className="text-sm text-muted-foreground">{t('descriptions.refiningCoherence')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Sections List */}
      {sections.length > 0 && (
      <div className="grid gap-4">
        {sections.map((section, index) => (
          <Card
            key={section.id}
            className={`transition-all duration-300 ${
              section.status === "writing"
                ? "ring-2 ring-blue-500 shadow-lg"
                : section.status === "completed"
                  ? "bg-green-50 border-green-200"
                  : ""
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{section.title}</CardTitle>
                <div className="flex items-center gap-2">
                  {section.status === "pending" && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="w-3 h-3" />
                      {t('sectionStatus.pending')}
                    </Badge>
                  )}
                  {section.status === "writing" && (
                    <Badge className="gap-1 bg-blue-500">
                        <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin block" />
                      {t('sectionStatus.writing')}
                    </Badge>
                  )}
                  {section.status === "completed" && (
                    <Badge className="gap-1 bg-green-500">
                      <CheckCircle className="w-3 h-3" />
                      {t('sectionStatus.completed')}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

                          {/* AI Research Progress for Current Section */}
            {currentPhase === 'writing' && index === currentSectionIndex && (currentKeywords.length > 0 || searchResults.length > 0 || searchPhase !== 'idle') && (
              <CardContent className="pt-0">
                <Separator className="mb-4" />
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    {searchPhase === 'writing' ? (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 border border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                    )}
                    <h4 className="font-medium text-blue-900">
                      {searchPhase === 'writing' ? t('research.aiWritingEnhancedContent') : t('research.aiResearchInProgress')}
                    </h4>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Keywords Display - Show immediately when available */}
                    {currentKeywords.length > 0 && (
                      <div className="animate-in slide-in-from-top-2 duration-300">
                        <p className="text-sm font-medium mb-2 text-blue-800">{t('research.keywordsExtracted')}</p>
                        <div className="flex flex-wrap gap-1">
                          {currentKeywords.map((keyword, keyIndex) => (
                            <Badge key={keyIndex} variant="secondary" className="bg-blue-100 text-blue-800 text-xs animate-in fade-in-50 duration-200" style={{animationDelay: `${keyIndex * 100}ms`}}>
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                        {searchResults.length === 0 && searchPhase !== 'writing' && (
                          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                            <span className="w-3 h-3 border border-blue-400 border-t-blue-600 rounded-full animate-spin block" />
                            {t('research.searchingForCurrentInformation')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Search Results Display - Show as soon as available */}
                    {searchResults.length > 0 && (
                      <div className="animate-in slide-in-from-top-2 duration-300">
                        <p className="text-sm font-medium mb-2 text-purple-800">{t('research.foundCurrentSources', { count: searchResults.length })}</p>
                        <div className="grid gap-2 max-h-24 overflow-y-auto">
                          {searchResults.slice(0, 3).map((result, resultIndex) => (
                            <div key={resultIndex} className="text-xs bg-white/70 rounded p-2 border border-purple-200 animate-in fade-in-50 duration-200" style={{animationDelay: `${resultIndex * 100}ms`}}>
                              <p className="font-medium text-purple-900 truncate">{result.title}</p>
                              <p className="text-purple-700 truncate">{result.url}</p>
                            </div>
                          ))}
                        </div>
                        {searchPhase !== 'writing' && (
                          <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                            <span className="w-3 h-3 border border-purple-400 border-t-purple-600 rounded-full animate-spin block" />
                            {t('research.integratingSearchResults')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Show initial state when no keywords yet */}
                    {currentKeywords.length === 0 && searchResults.length === 0 && searchPhase !== 'idle' && (
                      <div className="animate-in fade-in-50 duration-300">
                        <p className="text-sm text-blue-600 flex items-center gap-2">
                          <span className="w-4 h-4 border border-blue-400 border-t-blue-600 rounded-full animate-spin block" />
                          {t('research.analyzingContentToExtractKeywords')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            )}

            {/* Writing Progress */}
            {section.content && (
              <CardContent className="pt-0">
                <Separator className="mb-4" />
                <div className="prose prose-sm max-w-none">
                    <p className="text-muted-foreground leading-relaxed">
                      {section.content.substring(0, 200)}...
                    </p>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
      )}
    </div>
  )
}
