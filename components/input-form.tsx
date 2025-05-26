"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Link, FileText, Sparkles } from "lucide-react"
import { useTranslations, useLocale } from "next-intl"
import type { ProjectData } from "@/app/en/page"

const CONTENT_TYPE_KEYS = [
  "blogPost",
  "article",
  "essay",
  "report",
  "whitepaper",
  "newsletter",
] as const

const CONTENT_TYPE_OUTLINES = {
  en: {
    "blogPost": `Introduction
Problem or Topic Overview
Key Points and Solutions
Practical Examples
Actionable Tips
Conclusion and Call-to-Action`,
    
    "article": `Introduction
Background and Context
Main Arguments or Points
Supporting Evidence
Analysis and Discussion
Conclusion`,
    
    "essay": `Introduction
Thesis Statement
Supporting Arguments
Counterarguments and Rebuttals
Analysis and Evidence
Conclusion`,
    
    "report": `Executive Summary
Introduction and Objectives
Methodology
Findings and Analysis
Recommendations
Conclusion`,
    
    "whitepaper": `Executive Summary
Problem Statement
Current State Analysis
Proposed Solution
Implementation Strategy
Benefits and ROI
Conclusion and Recommendations`,
    
    "newsletter": `Subject Line and Preview Text
Personal Greeting
Main Content Highlights
Featured Stories or Updates
Upcoming Events or Announcements
Call-to-Action and Footer`,
  },
  
  ko: {
    "blogPost": `도입부
문제 또는 주제 개요
핵심 포인트와 해결책
실용적인 예시
실행 가능한 팁
결론 및 행동 촉구`,
    
    "article": `서론
배경과 맥락
주요 논점
지지하는 증거
분석 및 토론
결론`,
    
    "essay": `서론
논제 제시
뒷받침하는 논거
반박 논리와 재반박
분석 및 증거
결론`,
    
    "report": `요약
서론 및 목적
방법론
조사 결과 및 분석
권고사항
결론`,
    
    "whitepaper": `요약
문제 제기
현재 상황 분석
제안하는 해결책
실행 전략
이익 및 투자 수익률
결론 및 권고사항`,
    
    "newsletter": `제목과 미리보기 텍스트
인사말
주요 콘텐츠 하이라이트
주요 스토리 또는 업데이트
예정된 이벤트 또는 발표
행동 촉구 및 푸터`,
  },
  
  ja: {
    "blogPost": `はじめに
問題またはトピックの概要
重要なポイントと解決策
実用的な例
実行可能なヒント
結論と行動喚起`,
    
    "article": `序論
背景と文脈
主要な論点
裏付けとなる証拠
分析と議論
結論`,
    
    "essay": `序論
論文の提示
支持する論拠
反論と再反駁
分析と証拠
結論`,
    
    "report": `要約
序論と目的
方法論
調査結果と分析
推奨事項
結論`,
    
    "whitepaper": `要約
問題提起
現状分析
提案する解決策
実装戦略
利益とROI
結論と推奨事項`,
    
    "newsletter": `件名とプレビューテキスト
個人的な挨拶
主要コンテンツのハイライト
注目記事または更新情報
今後のイベントまたは発表
行動喚起とフッター`,
  }
}

interface InputFormProps {
  onSubmit: (data: ProjectData) => void
}

export function InputForm({ onSubmit }: InputFormProps) {
  const t = useTranslations()
  const locale = useLocale()
  const [formData, setFormData] = useState<ProjectData>({
    title: "",
    sources: {
      text: "",
      url: "",
      files: [],
    },
    contentType: "",
    outline: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProcessingUrl, setIsProcessingUrl] = useState(false)
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [detectedUrls, setDetectedUrls] = useState<string[]>([])
  const [processedUrls, setProcessedUrls] = useState<Set<string>>(new Set())

  // URL detection function
  const detectUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const matches = text.match(urlRegex)
    return matches ? matches.filter(url => url.length > 10) : []
  }

  // Auto-crawl detected URLs
  const processCrawlUrl = async (url: string) => {
    if (processedUrls.has(url)) return

    setIsProcessingUrl(true)
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const result = await response.json()

      if (result.success) {
        setFormData((prev) => ({
          ...prev,
          sources: {
            ...prev.sources,
            text: prev.sources.text + '\n\n' + `--- Auto-crawled from ${result.data.title} (${result.data.url}) ---\n${result.data.text}`,
          },
        }))
        setProcessedUrls(prev => new Set(prev).add(url))
      }
    } catch (error) {
      console.error('Auto URL processing error:', error)
    } finally {
      setIsProcessingUrl(false)
    }
  }

  const handleContentTypeChange = (value: string) => {
    // Auto-populate outline only if it's empty, otherwise just update content type
    const currentLocale = locale as 'en' | 'ko' | 'ja'
    const localeOutlines = CONTENT_TYPE_OUTLINES[currentLocale] || CONTENT_TYPE_OUTLINES.en
    const outlineTemplate = localeOutlines[value as keyof typeof localeOutlines] || ""
    
    setFormData((prev) => ({ 
      ...prev, 
      contentType: value,
      // Only auto-fill outline if it's currently empty
      outline: prev.outline.trim() ? prev.outline : outlineTemplate
    }))
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    if (files.length === 0) return
    
    setIsProcessingFiles(true)
    
    // Process each file with Upstage Document Parse
    for (const file of files) {
      try {
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        })
        
        const result = await response.json()
        
        if (result.success) {
          // Add extracted text to the text sources
          setFormData((prev) => ({
            ...prev,
            sources: {
              ...prev.sources,
              text: prev.sources.text + '\n\n' + `--- From ${result.data.fileName} ---\n${result.data.text}`,
              files: [...prev.sources.files, file],
            },
          }))
        } else {
          console.error('File upload failed:', result.error)
          alert(`Failed to process ${file.name}: ${result.error}`)
        }
      } catch (error) {
        console.error('File upload error:', error)
        alert(`Error processing ${file.name}`)
      }
    }
    
    setIsProcessingFiles(false)
  }



  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sources: {
        ...prev.sources,
        files: prev.sources.files.filter((_, i) => i !== index),
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.contentType || !formData.outline.trim()) {
      return
    }

    setIsSubmitting(true)
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))
    onSubmit(formData)
    setIsSubmitting(false)
  }

  const isFormValid = formData.title.trim() && formData.contentType && formData.outline.trim()

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Title */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('form.projectTitle')}
            <span className="text-red-500">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder={t('form.projectTitlePlaceholder')}
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            className="text-lg"
          />
        </CardContent>
      </Card>

      {/* Sources */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.sources')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('form.sourcesDescription')}
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" className="gap-2">
                <FileText className="w-4 h-4" />
                Text
              </TabsTrigger>
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="w-4 h-4" />
                Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4">
              <div className="space-y-3">
                <Textarea
                  placeholder={t('form.sourcesPlaceholder')}
                  value={formData.sources.text}
                  onChange={(e) => {
                    const newText = e.target.value
                    setFormData((prev) => ({
                      ...prev,
                      sources: { ...prev.sources, text: newText },
                    }))
                    
                    // Detect URLs in the new text
                    const urls = detectUrls(newText)
                    setDetectedUrls(urls)
                  }}
                  rows={6}
                />
                
                {/* URL Detection and Auto-Crawl */}
                {detectedUrls.length > 0 && (
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Link className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        URLs Detected ({detectedUrls.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {detectedUrls.map((url, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-blue-700 truncate max-w-[300px]">{url}</span>
                          <div className="flex items-center gap-2">
                            {processedUrls.has(url) ? (
                              <span className="text-green-600 text-xs">✓ Crawled</span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => processCrawlUrl(url)}
                                disabled={isProcessingUrl}
                                className="h-6 text-xs"
                              >
                                {isProcessingUrl ? 'Crawling...' : 'Auto-Crawl'}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      💡 URLs will be automatically crawled and their content added to your sources
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>



            <TabsContent value="upload" className="mt-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <Label htmlFor="file-upload" className={`cursor-pointer ${isProcessingFiles ? 'opacity-50 pointer-events-none' : ''}`}>
                  <span className="text-sm font-medium">
                    {isProcessingFiles ? t('form.processing') : t('form.uploadFiles')}
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    {isProcessingFiles ? t('form.processing') : t('form.filesDescription')}
                  </span>
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isProcessingFiles}
                />
              </div>
              {isProcessingFiles && (
                <div className="flex items-center justify-center mt-4">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                  <span className="text-sm text-blue-600">Extracting content using Upstage Document Parse...</span>
                </div>
              )}

              {formData.sources.files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {formData.sources.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{file.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                        {t('form.removeFile')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Content Type */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('form.contentType')}
            <span className="text-red-500 ml-1">*</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('form.contentTypeDescription')}
          </p>
        </CardHeader>
        <CardContent>
          <Select
            value={formData.contentType}
            onValueChange={handleContentTypeChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select content type..." />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPE_KEYS.map((typeKey) => (
                <SelectItem key={typeKey} value={typeKey}>
                  {t(`form.contentTypes.${typeKey}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Outline */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('form.outline')}
            <span className="text-red-500 ml-1">*</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('form.outlineDescription')}
            <span className="block text-blue-600 text-xs mt-1">
              💡 Selecting a content type will automatically populate a template outline
            </span>
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={t('form.outlinePlaceholder')}
            value={formData.outline}
            onChange={(e) => setFormData((prev) => ({ ...prev, outline: e.target.value }))}
            rows={8}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex flex-col items-center space-y-4">
        {!isFormValid && (
          <div className="text-sm text-muted-foreground text-center">
            Please fill in all required fields:
            <div className="mt-2 space-y-1">
              {!formData.title.trim() && <div className="text-orange-600">• Project Title</div>}
              {!formData.contentType && <div className="text-orange-600">• Content Type</div>}
              {!formData.outline.trim() && <div className="text-orange-600">• Content Outline</div>}
            </div>
          </div>
        )}
        <Button type="submit" size="lg" disabled={!isFormValid || isSubmitting} className="gap-2 px-8">
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('form.createProject')}...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {t('form.createProject')}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
