import React, { useState, useEffect, useRef } from 'react'
import { X, Keyboard } from 'lucide-react'

interface ShortcutRecorderProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    isDark?: boolean
}

// Maps specific keys to Electron Accelerator format
const KEY_MAP: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'Control': 'Ctrl',
    'Meta': 'Command', // Mac Command or Windows key often mapped to Super/Meta
}

// Keys to ignore as standalone keys (modifiers)
const MODIFIERS = ['Control', 'Alt', 'Shift', 'Meta']

export const ShortcutRecorder: React.FC<ShortcutRecorderProps> = ({ value, onChange, disabled, isDark }) => {
    const [isRecording, setIsRecording] = useState(false)
    const [currentKeys, setCurrentKeys] = useState<string[]>([])
    const inputRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!isRecording) return

        // 1. Tell Main process to start recording (traps Alt+Space)
        (window.electronAPI as any)?.startShortcutRecording?.()

        // 2. Listen for trapped shortcuts from Main (e.g. Alt+Space)
        const cleanupShortcutListener = (window.electronAPI as any)?.onShortcutRecorded?.((shortcut: string) => {
            onChange(shortcut)
            setIsRecording(false)
        })

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault()
            e.stopPropagation()

            // If Escape, cancel recording
            if (e.key === 'Escape') {
                setIsRecording(false)
                setCurrentKeys([])
                return
            }

            const keys = new Set<string>()
            if (e.ctrlKey) keys.add('Ctrl')
            if (e.metaKey) keys.add('Super') // Electron uses 'Super' for Windows key usually, or Command on Mac
            if (e.altKey) keys.add('Alt')
            if (e.shiftKey) keys.add('Shift')

            // If the key pressed is not a modifier, add it
            if (!MODIFIERS.includes(e.key)) {
                let key = e.key.toUpperCase()
                if (KEY_MAP[e.key]) key = KEY_MAP[e.key]
                // Handle letters
                if (key.length === 1) key = key.toUpperCase()

                keys.add(key)

                // If we have a non-modifier key, we consider the shortcut complete
                const shortcutString = Array.from(keys).join('+')
                onChange(shortcutString)
                setIsRecording(false)
            } else {
                // Just update visual state if only modifiers are held
                setCurrentKeys(Array.from(keys))
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            // Optional: could handle modifier release here if we wanted "hold" logic, 
            // but usually we just wait for a non-modifier key.
        }

        // Use capture phase to try and catch events early
        document.addEventListener('keydown', handleKeyDown, true)
        document.addEventListener('keyup', handleKeyUp, true)

        return () => {
            // Restore normal shortcuts when stopping recording
            (window.electronAPI as any)?.stopShortcutRecording?.()
            cleanupShortcutListener?.()

            document.removeEventListener('keydown', handleKeyDown, true)
            document.removeEventListener('keyup', handleKeyUp, true)
        }
    }, [isRecording, onChange])

    // Convert string "Ctrl+Shift+Z" to visual elements
    const renderKeys = (shortcut: string) => {
        if (!shortcut) return <span className="text-gray-400 text-xs">未设置</span>
        return shortcut.split('+').map((k, i) => (
            <React.Fragment key={i}>
                {i > 0 && <span className="text-gray-400 mx-0.5">+</span>}
                <kbd className={`px-2 py-1 border rounded-md text-xs font-mono min-w-[20px] text-center shadow-sm ${isDark ? 'bg-gray-700/50 border-gray-600 text-gray-200' : 'bg-gray-100/50 border-gray-300 text-gray-700'}`}>
                    {k}
                </kbd>
            </React.Fragment>
        ))
    }

    return (
        <div className="flex items-center gap-2">
            <div
                ref={inputRef}
                onClick={() => !disabled && setIsRecording(true)}
                className={`
                    relative flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-all cursor-pointer min-w-[140px] h-9
                    ${disabled ? 'bg-gray-50/50 opacity-50 cursor-not-allowed' :
                        isRecording ? 'border-blue-500 ring-2 ring-blue-100 bg-white/90 dark:bg-gray-800' :
                            isDark ? 'border-gray-700 bg-gray-900/50 hover:border-blue-500 hover:bg-gray-800' :
                                'border-gray-200 bg-white/40 hover:border-blue-400 hover:bg-blue-50/30'}
                `}
            >
                {isRecording ? (
                    <div className="text-xs text-blue-500 animate-pulse font-medium flex-1 text-center">
                        {currentKeys.length > 0 ? renderKeys(currentKeys.join('+')) : '按下快捷键...'}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        {renderKeys(value)}
                    </div>
                )}

                {value && !isRecording && !disabled && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onChange('')
                        }}
                        className="p-0.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50/50 dark:hover:bg-red-900/30 ml-1 transition-colors"
                        title="清除快捷键"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
            {isRecording && (
                <div className="text-xs text-gray-400 animate-in fade-in slide-in-from-left-2">
                    按 ESC 取消
                </div>
            )}
        </div>
    )
}
