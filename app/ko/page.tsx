"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { InputForm } from "@/components/input-form"
import { WritingProgress } from "@/components/writing-progress"
import { ChatInterface } from "@/components/chat-interface"
import { LanguageSelector } from "@/components/language-selector"
import { FileText, MessageSquare, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

export interface ProjectData {
  title: string
  sources: {
    text: string
    url: string
    files: File[]
  }
  contentType: string
  outline: string
}

export interface Section {
  id: string
  title: string
  content: string
  status: "pending" | "writing" | "completed"
}

type AppPhase = "input" | "writing" | "chat"

export default function SolarWriterApp() {
  const t = useTranslations()
  const [phase, setPhase] = useState<AppPhase>("input")
  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [finalContent, setFinalContent] = useState<string>("")
  const [isStreamingFinalPolish, setIsStreamingFinalPolish] = useState<boolean>(false)
  const [streamingSource, setStreamingSource] = useState<(() => Promise<ReadableStream>) | null>(null)

  const handleProjectSubmit = (data: ProjectData) => {
    setProjectData(data)
    // Generate sections from outline
    const outlineLines = data.outline.split("\n").filter((line) => line.trim())
    const generatedSections: Section[] = outlineLines.map((line, index) => ({
      id: `section-${index}`,
      title: line.trim(),
      content: "",
      status: "pending",
    }))
    setSections(generatedSections)
    setPhase("writing")
  }

  const handleWritingComplete = (content: string, isStreaming?: boolean, streamingSourceFn?: () => Promise<ReadableStream>) => {
    setFinalContent(content)
    setIsStreamingFinalPolish(isStreaming || false)
    setStreamingSource(streamingSourceFn ? () => streamingSourceFn : null)
    setPhase("chat")
  }

  const resetApp = () => {
    setPhase("input")
    setProjectData(null)
    setSections([])
    setFinalContent("")
    setIsStreamingFinalPolish(false)
    setStreamingSource(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {t('app.title')}
                </h1>
                <p className="text-sm text-muted-foreground">{t('app.subtitle')}</p>
              </div>
            </div>

            {/* Phase Indicator */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge variant={phase === "input" ? "default" : "secondary"} className="gap-1">
                  <FileText className="w-3 h-3" />
                  {t('phases.setup')}
                </Badge>
                <Badge variant={phase === "writing" ? "default" : "secondary"} className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t('phases.writing')}
                </Badge>
                <Badge variant={phase === "chat" ? "default" : "secondary"} className="gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {t('phases.refine')}
                </Badge>
              </div>

              <LanguageSelector />

              {phase !== "input" && (
                <Button variant="outline" size="sm" onClick={resetApp}>
                  {t('app.newProject')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 pb-4">
        {phase === "input" && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">{t('input.title')}</h2>
              <p className="text-lg text-muted-foreground">
                {t('input.subtitle')}
              </p>
            </div>
            <InputForm onSubmit={handleProjectSubmit} />
          </div>
        )}

        {phase === "writing" && projectData && (
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">{projectData.title}</h2>
              <Badge variant="secondary" className="mb-4">
                {projectData.contentType}
              </Badge>
              <p className="text-muted-foreground">{t('writing.subtitle')}</p>
            </div>
            <WritingProgress 
              sections={sections} 
              setSections={setSections} 
              onComplete={handleWritingComplete} 
              projectData={projectData}
            />
          </div>
        )}

        {phase === "chat" && projectData && (
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2">{t('chat.title')}</h2>
              <p className="text-muted-foreground">
                {t('chat.subtitle')}
              </p>
            </div>
            <ChatInterface 
              projectTitle={projectData.title} 
              initialContent={finalContent} 
              contentType={projectData.contentType}
              isStreamingFinalPolish={isStreamingFinalPolish}
              streamingSource={streamingSource}
            />
          </div>
        )}
      </main>


    </div>
  )
}
