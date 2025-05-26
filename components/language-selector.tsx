"use client"

import { useState, useEffect } from "react"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLocale, useTranslations } from "next-intl"
import { useRouter, usePathname } from "next/navigation"
import { locales, type Locale } from "@/i18n"

export function LanguageSelector() {
  const t = useTranslations("language")
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()

  const handleLanguageChange = (newLocale: Locale) => {
    // Store in localStorage for persistence
    localStorage.setItem("preferred-locale", newLocale)
    
    // Navigate to the new locale
    const currentPath = pathname.startsWith(`/${locale}`) 
      ? pathname.substring(`/${locale}`.length) 
      : pathname
    const newPath = `/${newLocale}${currentPath || ''}`
    router.push(newPath)
  }

  const getLanguageFlag = (locale: Locale) => {
    switch (locale) {
      case "en":
        return "🇺🇸"
      case "ko":
        return "🇰🇷"
      case "ja":
        return "🇯🇵"
      default:
        return "🌐"
    }
  }

  const getLanguageName = (locale: Locale) => {
    switch (locale) {
      case "en":
        return t("english")
      case "ko":
        return t("korean")
      case "ja":
        return t("japanese")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">{getLanguageFlag(locale)}</span>
          <span className="hidden md:inline">{getLanguageName(locale)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLanguageChange(loc)}
            className={`gap-2 ${locale === loc ? "bg-accent" : ""}`}
          >
            <span>{getLanguageFlag(loc)}</span>
            <span>{getLanguageName(loc)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 