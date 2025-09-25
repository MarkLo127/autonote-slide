"use client"

import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  onSettingsClick: () => void
}

export function Header({ onSettingsClick }: HeaderProps) {
  const handleHomeClick = () => {
    window.location.reload() // 重新載入頁面回到主頁
  }

  return (
    <header className="glass-panel border-b border-glass-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center space-x-4 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleHomeClick}
          >
            <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="bg-gradient-to-r from-blue-100 to-blue-200 bg-clip-text text-transparent font-bold text-sm">
                AI
              </span>
            </div>
            <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              AutoNote&Slide
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={onSettingsClick} className="glass-button">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
