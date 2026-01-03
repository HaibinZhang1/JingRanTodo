import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from '../i18n'
import { X, Download, Upload, Info, Folder, Check, Globe, Plus, Type, Palette, Image as ImageIcon, Clock, Save, Trash2, Circle, Puzzle } from 'lucide-react'
import { HexColorPicker } from 'react-colorful'
import { useAppDispatch, useAppSelector } from '../hooks/useRedux'
import {
    setThemeMode, updateMinimalConfig, updateGradientConfig, updateWallpaperConfig,
    setSavedWallpapers, addSavedWallpaper, removeSavedWallpaper,
    setBackgroundOpacity, setPanelOpacity, setModalOpacity,
    setLanguage, setNotesPath, saveSetting, setShortcut
} from '../store/settingsSlice'
import type { ThemeMode, GradientVariant } from '../store/settingsSlice'
import { fetchNotes } from '../store/notesSlice'
import { GlassPanel, ConfirmModal } from '../components'
import { ShortcutRecorder } from '../components/ShortcutRecorder'
import { AIExtensionCenter } from '../components/AIExtensionCenter'
import type { RootState } from '../store'
import iconPng from '/icon.png?url'

interface SettingsViewProps {
    isOpen: boolean
    onClose: () => void
    isDark?: boolean
}

// 最近使用的配色预设
interface ColorPreset {
    colors: string[]
    variant: GradientVariant
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isOpen, onClose, isDark }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()
    const { themeConfig, language, notesPath, shortcuts } = useAppSelector((state: RootState) => state.settings)

    const [activeSection, setActiveSection] = useState<'appearance' | 'general' | 'extensions' | 'data' | 'about'>('appearance')
    const [autoStart, setAutoStart] = useState(false)
    const [activeColorIndex, setActiveColorIndex] = useState<number | null>(null)
    const [colorPickerPosition, setColorPickerPosition] = useState<{ x: number; y: number } | null>(null)
    const [recentPresets, setRecentPresets] = useState<ColorPreset[]>([])
    const colorButtonRefs = useRef<(HTMLButtonElement | null)[]>([])

    // 确认弹窗状态
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean
        title: string
        content: string
        onConfirm: () => void
    }>({
        isOpen: false,
        title: '',
        content: '',
        onConfirm: () => { }
    })



    // ESC关闭设置
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    // 初始化时获取自启动状态和壁纸列表
    useEffect(() => {
        if (isOpen) {
            window.electronAPI?.getAutoStart?.().then(setAutoStart).catch(() => { })
            window.electronAPI?.getWallpapers?.().then((wallpapers) => {
                if (wallpapers && wallpapers.length > 0) {
                    dispatch(setSavedWallpapers(wallpapers))
                }
            }).catch(console.error)
            // 加载最近使用的配色
            const saved = localStorage.getItem('zenhub_color_presets')
            if (saved) {
                try {
                    setRecentPresets(JSON.parse(saved))
                } catch (e) { }
            }
        }
    }, [isOpen, dispatch])

    // 保存主题配置
    const saveThemeConfig = useCallback(() => {
        dispatch(saveSetting({ key: 'themeConfig', value: themeConfig }))
    }, [dispatch, themeConfig])

    // 主题变更时自动保存
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(saveThemeConfig, 500)
            return () => clearTimeout(timer)
        }
    }, [themeConfig, isOpen, saveThemeConfig])

    // 处理颜色变更
    const handleColorChange = (color: string) => {
        if (activeColorIndex === null) return
        const newColors = [...themeConfig.gradient.colors]
        newColors[activeColorIndex] = color
        dispatch(updateGradientConfig({ colors: newColors }))
    }

    // 打开颜色选择器（悬浮定位）
    const handleColorButtonClick = (idx: number, e: React.MouseEvent<HTMLButtonElement>) => {
        if (activeColorIndex === idx) {
            setActiveColorIndex(null)
            setColorPickerPosition(null)
        } else {
            setActiveColorIndex(idx)
            const rect = e.currentTarget.getBoundingClientRect()
            setColorPickerPosition({
                x: rect.left + rect.width / 2,
                y: rect.bottom + 10
            })
        }
    }

    // 保存当前配色到最近使用
    const saveCurrentPreset = () => {
        const preset: ColorPreset = {
            colors: [...themeConfig.gradient.colors],
            variant: themeConfig.gradient.variant
        }
        const newPresets = [preset, ...recentPresets.filter(p =>
            JSON.stringify(p.colors) !== JSON.stringify(preset.colors)
        )].slice(0, 5)
        setRecentPresets(newPresets)
        localStorage.setItem('zenhub_color_presets', JSON.stringify(newPresets))
    }

    // 应用配色预设
    const applyPreset = (preset: ColorPreset) => {
        dispatch(updateGradientConfig({ variant: preset.variant, colors: preset.colors }))
    }

    // 上传壁纸
    const handleWallpaperUpload = async () => {
        try {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) {
                    // In Electron, File object has 'path' property
                    const filePath = (file as any).path
                    if (filePath && window.electronAPI?.saveWallpaper) {
                        try {
                            const savedPath = await window.electronAPI.saveWallpaper(filePath)
                            dispatch(addSavedWallpaper(savedPath))
                        } catch (err) {
                            console.error('Save wallpaper failed:', err)
                            alert('保存壁纸失败: ' + (err as Error).message)
                        }
                    } else if (!filePath) {
                        alert('无法获取文件路径，请确保在 Electron 环境中运行')
                    }
                }
            }
            input.click()
        } catch (error) {
            console.error('Failed to upload wallpaper:', error)
        }
    }

    // 透明度处理函数
    const handleBackgroundOpacityChange = (value: number) => {
        dispatch(setBackgroundOpacity(value))
    }
    const handlePanelOpacityChange = (value: number) => {
        dispatch(setPanelOpacity(value))
    }
    const handleModalOpacityChange = (value: number) => {
        dispatch(setModalOpacity(value))
    }
    const handleLanguageChange = (newLang: 'zh' | 'en') => dispatch(setLanguage(newLang))

    const handleAutoStartToggle = async () => {
        const newValue = !autoStart
        try {
            await window.electronAPI?.setAutoStart?.(newValue)
            setAutoStart(newValue)
        } catch (error) {
            console.error('Failed to toggle auto-start:', error)
        }
    }

    const handleSelectNotesPath = async () => {
        if (!window.electronAPI?.selectDirectory) return
        try {
            const path = await window.electronAPI.selectDirectory()
            if (path) {
                await dispatch(saveSetting({ key: 'notes_path', value: path }))
                dispatch(setNotesPath(path))
                dispatch(fetchNotes())
            }
        } catch (error) {
            console.error('Failed to set notes path:', error)
        }
    }

    const handleModeSwitch = (mode: ThemeMode) => {
        dispatch(setThemeMode(mode))
    }

    const sections = [
        { id: 'appearance', name: t.settings.appearance, icon: <Palette size={18} /> },
        { id: 'general', name: t.nav.settings, icon: <Globe size={18} /> },
        { id: 'extensions', name: t.settings.extensions, icon: <Puzzle size={18} /> },
        { id: 'data', name: t.settings.data, icon: <Folder size={18} /> },
        { id: 'about', name: t.settings.about, icon: <Info size={18} /> },
    ]

    if (!isOpen) return null

    const colorCount = themeConfig.gradient.variant === 'single' ? 1 : themeConfig.gradient.variant === 'dual' ? 2 : 3

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
            <GlassPanel variant="modal" className="w-full max-w-3xl h-[600px] flex overflow-hidden rounded-2xl shadow-2xl dark:border-gray-700" isDark={themeConfig.mode === 'minimal' && themeConfig.minimal.variant === 'dark'}>
                {/* Sidebar */}
                <div className="w-48 bg-transparent border-r border-gray-200/50 dark:border-gray-700/50 p-4 flex flex-col gap-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 px-2">{t.nav.settings}</h2>
                    {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id as any)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                                ${activeSection === section.id ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-700/50'}`}
                        >
                            {section.icon}
                            {section.name}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Fixed Header with Close Button */}
                    <div className="shrink-0 flex items-center justify-between p-6 pb-2">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                            {activeSection === 'appearance' && t.settings.appearance}
                            {activeSection === 'general' && t.nav.settings}
                            {activeSection === 'extensions' && t.settings.extensions}
                            {activeSection === 'data' && t.settings.data}
                            {activeSection === 'about' && t.settings.about}
                        </h3>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-full transition-colors" title={t.common.close}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto px-6 pb-6 scrollbar-thin">

                        {/* Appearance Tab */}
                        {activeSection === 'appearance' && (
                            <div className="space-y-8">
                                <div>
                                    {/* Mode Switcher */}
                                    <div className="grid grid-cols-3 gap-4 mb-8">
                                        <button
                                            onClick={() => handleModeSwitch('minimal')}
                                            className={`p-4 rounded-xl border-2 text-center transition-all bg-white/20 hover:bg-white/40 dark:bg-gray-800/20 dark:hover:bg-gray-800/40 ${themeConfig.mode === 'minimal' ? 'border-blue-500 text-blue-700 dark:text-blue-400 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'}`}
                                        >
                                            <Type className="mx-auto mb-2" size={24} />
                                            <div className="text-xs font-bold">{t.settings.themeMono}</div>
                                        </button>
                                        <button
                                            onClick={() => handleModeSwitch('gradient')}
                                            className={`p-4 rounded-xl border-2 text-center transition-all bg-white/20 hover:bg-white/40 dark:bg-gray-800/20 dark:hover:bg-gray-800/40 ${themeConfig.mode === 'gradient' ? 'border-blue-500 text-blue-700 dark:text-blue-400 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'}`}
                                        >
                                            <Palette className="mx-auto mb-2" size={24} />
                                            <div className="text-xs font-bold">炫彩</div>
                                        </button>
                                        <button
                                            onClick={() => handleModeSwitch('wallpaper')}
                                            className={`p-4 rounded-xl border-2 text-center transition-all bg-white/20 hover:bg-white/40 dark:bg-gray-800/20 dark:hover:bg-gray-800/40 ${themeConfig.mode === 'wallpaper' ? 'border-blue-500 text-blue-700 dark:text-blue-400 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'}`}
                                        >
                                            <ImageIcon className="mx-auto mb-2" size={24} />
                                            <div className="text-xs font-bold">{t.settings.themeWallpaper}</div>
                                        </button>
                                    </div>

                                    {/* Minimal Mode Settings */}
                                    {themeConfig.mode === 'minimal' && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                                            <h4 className="text-sm font-bold text-gray-600 dark:text-gray-400">{t.settings.theme}</h4>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div
                                                    onClick={() => dispatch(updateMinimalConfig({ variant: 'light' }))}
                                                    className={`cursor-pointer group relative overflow-hidden rounded-2xl border-2 transition-all ${themeConfig.minimal.variant === 'light' ? 'border-blue-500 ring-4 ring-blue-100 dark:ring-blue-900' : 'border-gray-200 dark:border-gray-700'}`}
                                                >
                                                    <div className="h-24 bg-gray-100 flex items-center justify-center text-gray-400 font-mono text-xs">Light Preview</div>
                                                    <div className="p-3 bg-white dark:bg-gray-800 text-center font-bold text-gray-700 dark:text-gray-300 text-sm border-t dark:border-gray-700">{t.settings.lightTheme}</div>
                                                </div>
                                                <div
                                                    onClick={() => dispatch(updateMinimalConfig({ variant: 'dark' }))}
                                                    className={`cursor-pointer group relative overflow-hidden rounded-2xl border-2 transition-all ${themeConfig.minimal.variant === 'dark' ? 'border-blue-500 ring-4 ring-blue-100 dark:ring-blue-900' : 'border-gray-200 dark:border-gray-700'}`}
                                                >
                                                    <div className="h-24 bg-gray-900 flex items-center justify-center text-gray-500 font-mono text-xs">Dark Preview</div>
                                                    <div className="p-3 bg-white dark:bg-gray-800 text-center font-bold text-gray-700 dark:text-gray-300 text-sm border-t dark:border-gray-700">{t.settings.darkTheme}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Gradient Mode Settings */}
                                    {themeConfig.mode === 'gradient' && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
                                            <h4 className="text-sm font-bold text-gray-600 dark:text-gray-400">{t.settings.theme}</h4>
                                            <div className="flex bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-xl w-fit">
                                                {(['single', 'dual', 'tri'] as const).map(v => (
                                                    <button
                                                        key={v}
                                                        onClick={() => {
                                                            let newColors: string[]
                                                            if (v === 'single') {
                                                                newColors = [themeConfig.gradient.colors[0] || '#3b82f6']
                                                            } else if (v === 'dual') {
                                                                newColors = themeConfig.gradient.colors.slice(0, 2)
                                                                if (newColors.length < 2) newColors.push('#8b5cf6')
                                                            } else {
                                                                newColors = [...themeConfig.gradient.colors.slice(0, 2), themeConfig.gradient.colors[2] || '#ec4899']
                                                            }
                                                            dispatch(updateGradientConfig({ variant: v, colors: newColors }))
                                                        }}
                                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${themeConfig.gradient.variant === v ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
                                                    >
                                                        {v === 'single' ? '单色纯净' : v === 'dual' ? '双色流光' : '三色炫彩'}
                                                    </button>
                                                ))}
                                            </div>
                                            {/* Color Preview */}
                                            <div className="flex gap-4 items-center flex-wrap">
                                                {themeConfig.gradient.colors.slice(0, colorCount).map((color: string, idx: number) => (
                                                    <div key={idx} className="flex flex-col gap-2 items-center">
                                                        <button
                                                            ref={el => colorButtonRefs.current[idx] = el}
                                                            onClick={(e) => handleColorButtonClick(idx, e)}
                                                            className={`w-12 h-12 rounded-full border-4 shadow-sm overflow-hidden transition-transform hover:scale-110 ${activeColorIndex === idx ? 'border-blue-500 scale-110' : 'border-gray-100 dark:border-gray-700'}`}
                                                            style={{ backgroundColor: color }}
                                                        />
                                                        <span className="text-[10px] text-gray-400 font-mono uppercase">{color}</span>
                                                    </div>
                                                ))}

                                                {/* Save Current Preset Button */}
                                                <button
                                                    onClick={saveCurrentPreset}
                                                    className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-all"
                                                    title={t.settings.savePreset}
                                                >
                                                    <Save size={16} />
                                                </button>
                                            </div>

                                            {/* Recently Used Presets */}
                                            {recentPresets.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Clock size={12} className="text-gray-400" />
                                                        <span className="text-xs text-gray-500">{t.settings.recentPresets}</span>
                                                    </div>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {recentPresets.map((preset, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => applyPreset(preset)}
                                                                className="h-8 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-all flex"
                                                                title={t.settings.applyPreset}
                                                            >
                                                                {preset.colors.slice(0, preset.variant === 'dual' ? 2 : 3).map((c, i) => (
                                                                    <div key={i} className="w-6 h-full" style={{ backgroundColor: c }} />
                                                                ))}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Wallpaper Mode Settings */}
                                    {themeConfig.mode === 'wallpaper' && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
                                            <label className="block w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400" onClick={handleWallpaperUpload}>
                                                <Plus size={20} />
                                                <span className="text-xs font-bold">{t.settings.uploadWallpaper}</span>
                                            </label>
                                            <h4 className="text-sm font-bold text-gray-600 dark:text-gray-400">{t.settings.savedWallpapers} ({themeConfig.wallpaper.saved.length}/10)</h4>
                                            <div className="grid grid-cols-3 gap-3">
                                                {themeConfig.wallpaper.saved.map((src: string, idx: number) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => dispatch(updateWallpaperConfig({ src }))}
                                                        className={`relative aspect-video rounded-lg bg-gray-100/30 dark:bg-gray-800/30 overflow-hidden cursor-pointer border-2 transition-all group/wallpaper ${themeConfig.wallpaper.src === src ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'}`}
                                                        style={{
                                                            backgroundImage: `url('${src}')`,
                                                            backgroundSize: 'cover',
                                                            backgroundPosition: 'center'
                                                        }}
                                                    >
                                                        {/* 删除按钮 */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                e.preventDefault()
                                                                dispatch(removeSavedWallpaper(src))
                                                            }}
                                                            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover/wallpaper:opacity-100 transition-opacity z-10"
                                                            title="删除壁纸"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                        {themeConfig.wallpaper.src === src && (
                                                            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                                                <Check className="text-white drop-shadow-md" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {themeConfig.wallpaper.saved.length === 0 && (
                                                    <div className="col-span-3 py-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                                                        {t.settings.noWallpapers}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 透明度区域 */}
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                    <h4 className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-4">透明度</h4>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-gray-600 dark:text-gray-300 w-24">背景透明度</span>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={themeConfig.opacity.background}
                                                onChange={(e) => handleBackgroundOpacityChange(Number(e.target.value))}
                                                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium w-8 text-right">{themeConfig.opacity.background}%</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-gray-600 dark:text-gray-300 w-24">主面板透明度</span>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={themeConfig.opacity.panel}
                                                onChange={(e) => handlePanelOpacityChange(Number(e.target.value))}
                                                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium w-8 text-right">{themeConfig.opacity.panel}%</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-gray-600 dark:text-gray-300 w-24">弹窗透明度</span>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={themeConfig.opacity.modal}
                                                onChange={(e) => handleModalOpacityChange(Number(e.target.value))}
                                                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium w-8 text-right">{themeConfig.opacity.modal}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* General Tab */}
                        {activeSection === 'general' && (
                            <div className="space-y-6">
                                {/* Shortcuts Settings */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">快捷键设置</h3>
                                    <div className="space-y-3">
                                        {[
                                            { key: 'toggleCapsule', label: '闪念胶囊 (全局)' },
                                            { key: 'toggleMainWindow', label: '显示/隐藏主窗口 (全局)' },
                                            { key: 'createStickyNote', label: '新建便签 (全局)' }
                                        ].map(({ key, label }) => (
                                            <div key={key} className="flex items-center justify-between p-3 bg-white/20 dark:bg-gray-800/20 border border-gray-200 dark:border-gray-700 rounded-xl">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
                                                <ShortcutRecorder
                                                    value={shortcuts?.[key as keyof typeof shortcuts] || ''}
                                                    onChange={(val) => {
                                                        dispatch(setShortcut({ key: key as 'toggleCapsule' | 'toggleMainWindow' | 'createStickyNote', value: val }))
                                                        const newShortcuts = { ...shortcuts, [key]: val }
                                                        dispatch(saveSetting({ key: 'shortcuts', value: newShortcuts }))
                                                    }}
                                                    isDark={isDark}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Auto-start Setting */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.settings.autoStart}</h3>
                                    <label className="flex items-center justify-between p-4 bg-white/20 dark:bg-gray-800/20 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-white/40 dark:hover:bg-gray-800/40 transition-colors cursor-pointer">
                                        <div>
                                            <div className="font-medium text-gray-700 dark:text-gray-300">{t.settings.autoStart}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">在登录时自动启动 JingRan Todo</div>
                                        </div>
                                        <div
                                            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${autoStart ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                            onClick={(e) => { e.preventDefault(); handleAutoStartToggle(); }}
                                        >
                                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoStart ? 'translate-x-5' : ''}`} />
                                        </div>
                                    </label>
                                </div>




                                {/* Reset Floating Window Positions */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.settings.resetPositions}</h3>
                                    <button
                                        onClick={() => {
                                            setConfirmConfig({
                                                isOpen: true,
                                                title: t.settings.resetConfirmTitle,
                                                content: t.settings.resetConfirmContent,
                                                onConfirm: async () => {
                                                    try {
                                                        await window.electronAPI?.resetCardPositions?.()
                                                    } catch (err) {
                                                        console.error('Failed to reset positions:', err)
                                                    }
                                                }
                                            })
                                        }}
                                        className="w-full flex items-center gap-3 p-4 bg-white/20 dark:bg-gray-800/20 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-white/40 dark:hover:bg-gray-800/40 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-orange-100/50 dark:bg-orange-900/30 flex items-center justify-center">
                                            <Folder size={16} className="text-orange-500" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-700 dark:text-gray-300">{t.settings.resetPositions}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{t.settings.resetPositionsDesc}</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Extensions Tab */}
                        {activeSection === 'extensions' && (
                            <AIExtensionCenter isDark={isDark} />
                        )}

                        {/* Data Tab */}
                        {activeSection === 'data' && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="p-4 bg-white/20 dark:bg-gray-800/20 border dark:border-gray-700 rounded-xl">
                                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.settings.notesPath}</h3>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={notesPath || '默认位置 (public/notes)'}
                                                readOnly
                                                className="flex-1 px-3 py-2 bg-white/30 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 outline-none"
                                            />
                                            <button
                                                onClick={handleSelectNotesPath}
                                                className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                                            >
                                                {t.settings.changePath}
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2">{t.settings.notesPathDesc}</p>
                                    </div>

                                    <button className="w-full flex items-center gap-3 p-4 bg-white/20 dark:bg-gray-800/20 border dark:border-gray-700 rounded-xl hover:bg-white/40 dark:hover:bg-gray-800/40 transition-colors" onClick={() => window.electronAPI?.exportData()}>
                                        <Download className="text-blue-500" />
                                        <div className="text-left">
                                            <div className="font-medium dark:text-gray-200">{t.settings.exportData}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{t.settings.exportDesc}</div>
                                        </div>
                                    </button>
                                    <button className="w-full flex items-center gap-3 p-4 bg-white/20 dark:bg-gray-800/20 border dark:border-gray-700 rounded-xl hover:bg-white/40 dark:hover:bg-gray-800/40 transition-colors" onClick={() => window.electronAPI?.importData()}>
                                        <Upload className="text-green-500" />
                                        <div className="text-left">
                                            <div className="font-medium dark:text-gray-200">{t.settings.importData}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{t.settings.importDesc}</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* About Tab */}
                        {activeSection === 'about' && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="flex items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-100 dark:border-blue-900/50">
                                    <div className="w-16 h-16 rounded-2xl bg-transparent flex items-center justify-center shadow-lg overflow-hidden">
                                        <img src={iconPng} alt="Logo" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100">井然——JingRanTodo</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">一切井井然</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">v1.0.0 | 内测离线版</p>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-600 space-y-2">
                                    <p>软件已开源，严禁用于商业盈利，仅供个人使用</p>
                                    <p>开源地址：https://github.com/HaibinZhang1/JingRanTodo</p>
                                    <p>问题反馈：“协同”搜索“zhanghaibin”或发送邮件至“JingRanTodo@163.com”</p>
                                    <p className="text-xs text-gray-400 mt-4">© 2025 JingRan Team. All rights reserved.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Floating Color Picker */}
                {
                    activeColorIndex !== null && (
                        <>
                            <div
                                className="absolute inset-0 z-[150]"
                                onClick={() => { setActiveColorIndex(null); setColorPickerPosition(null); }}
                            />
                            <div
                                className="absolute z-[200] animate-fade-in"
                                style={{
                                    right: 90,
                                    top: 120,
                                }}
                            >
                                <div className="p-3 bg-white rounded-xl shadow-2xl border border-gray-200">
                                    <HexColorPicker
                                        color={themeConfig.gradient.colors[activeColorIndex]}
                                        onChange={handleColorChange}
                                    />
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-xs text-gray-500 font-mono uppercase">
                                            {themeConfig.gradient.colors[activeColorIndex]}
                                        </span>
                                        <button
                                            onClick={() => { setActiveColorIndex(null); setColorPickerPosition(null); }}
                                            className="text-xs text-blue-500 hover:text-blue-700"
                                        >
                                            完成
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )
                }

                {/* Confirmation Modal */}
                <ConfirmModal
                    isOpen={confirmConfig.isOpen}
                    title={confirmConfig.title}
                    content={confirmConfig.content}
                    onConfirm={confirmConfig.onConfirm}
                    onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                    type="warning"
                    confirmText={t.common.confirm}
                    cancelText={t.common.cancel}
                />
            </GlassPanel >
        </div >
    )
}

export default SettingsView
