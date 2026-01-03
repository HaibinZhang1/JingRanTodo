/**
 * AI 扩展中心组件
 * 用于管理 AI Provider 配置
 */

import React, { useState, useEffect } from 'react'
import { Bot, Plus, Edit2, Trash2, Settings, Save, X, RefreshCw, Check, AlertCircle } from 'lucide-react'

// Types
interface AIProviderConfig {
    id: string
    type: 'gemini' | 'openai_compatible'
    name: string
    enabled: boolean
    baseUrl: string
    apiKey?: string
    modelName: string
    systemPrompt?: string
    temperature: number
    maxTokens: number
    isDefault: boolean
}

interface CapsuleSettings {
    useAI: boolean
    activeProviderId: string
    systemPrompt: string
}

interface AIExtensionCenterProps {
    isDark?: boolean
}

// 默认预设 URL
const PRESET_URLS: Record<string, { baseUrl: string; modelName: string }> = {
    gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/',
        modelName: 'gemini-1.5-flash-latest'
    },
    deepseek: {
        baseUrl: 'https://api.deepseek.com/v1',
        modelName: 'deepseek-chat'
    },
    ollama: {
        baseUrl: 'http://localhost:11434/v1',
        modelName: 'llama3'
    },
    moonshot: {
        baseUrl: 'https://api.moonshot.cn/v1',
        modelName: 'moonshot-v1-8k'
    }
}

export const AIExtensionCenter: React.FC<AIExtensionCenterProps> = ({ isDark }) => {
    // State
    const [settings, setSettings] = useState<CapsuleSettings>({
        useAI: false,
        activeProviderId: '',
        systemPrompt: ''
    })
    const [providers, setProviders] = useState<AIProviderConfig[]>([])
    const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string }>({
        loading: false
    })
    const [defaultPrompt, setDefaultPrompt] = useState('')
    const [promptEditing, setPromptEditing] = useState(false)
    const [promptText, setPromptText] = useState('')

    // 加载数据
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            // 获取设置
            const settingsResult = await window.electronAPI.capsuleGetSettings()
            if (settingsResult.success && settingsResult.settings) {
                setSettings(settingsResult.settings)
                setPromptText(settingsResult.settings.systemPrompt)
            }

            // 获取 Providers
            const providersResult = await window.electronAPI.capsuleGetProviders()
            if (providersResult.success) {
                setProviders(providersResult.providers)
            }

            // 获取默认提示词
            const promptResult = await window.electronAPI.capsuleGetDefaultPrompt()
            if (promptResult.success) {
                setDefaultPrompt(promptResult.prompt)
            }
        } catch (error) {
            console.error('[AIExtensionCenter] Load data error:', error)
        }
    }

    // 切换 AI 开关
    const handleToggleAI = async () => {
        const newValue = !settings.useAI
        try {
            await window.electronAPI.capsuleSaveSettings({ useAI: newValue })
            setSettings(prev => ({ ...prev, useAI: newValue }))
        } catch (error) {
            console.error('[AIExtensionCenter] Toggle AI error:', error)
        }
    }

    // 选择活动 Provider
    const handleSelectProvider = async (id: string) => {
        try {
            await window.electronAPI.capsuleSetActiveProvider(id)
            setSettings(prev => ({ ...prev, activeProviderId: id }))
        } catch (error) {
            console.error('[AIExtensionCenter] Select provider error:', error)
        }
    }

    // 开始编辑/新建 Provider
    const handleEditProvider = (provider?: AIProviderConfig) => {
        if (provider) {
            setEditingProvider({ ...provider })
        } else {
            // 新建 Provider
            setEditingProvider({
                id: '',
                type: 'openai_compatible',
                name: '',
                enabled: true,
                baseUrl: '',
                apiKey: '',
                modelName: '',
                temperature: 0.1,
                maxTokens: 1024,
                isDefault: false
            })
        }
        setIsEditing(true)
        setTestStatus({ loading: false })
    }

    // 取消编辑
    const handleCancelEdit = () => {
        setEditingProvider(null)
        setIsEditing(false)
        setTestStatus({ loading: false })
    }

    // 保存 Provider
    const handleSaveProvider = async () => {
        if (!editingProvider || !editingProvider.name || !editingProvider.baseUrl || !editingProvider.modelName) {
            return
        }

        try {
            const result = await window.electronAPI.capsuleSaveProvider(editingProvider)
            if (result.success) {
                await loadData()
                handleCancelEdit()
            }
        } catch (error) {
            console.error('[AIExtensionCenter] Save provider error:', error)
        }
    }

    // 删除 Provider
    const handleDeleteProvider = async (id: string) => {
        try {
            await window.electronAPI.capsuleDeleteProvider(id)
            await loadData()
        } catch (error) {
            console.error('[AIExtensionCenter] Delete provider error:', error)
        }
    }

    // 测试连接
    const handleTestConnection = async () => {
        if (!editingProvider) return

        setTestStatus({ loading: true })
        try {
            const result = await window.electronAPI.capsuleTestProvider(editingProvider)
            setTestStatus({
                loading: false,
                success: result.success,
                message: result.message
            })
        } catch (error: any) {
            setTestStatus({
                loading: false,
                success: false,
                message: error.message || '连接测试失败'
            })
        }
    }

    // 应用预设 URL
    const handleApplyPreset = (presetKey: string) => {
        const preset = PRESET_URLS[presetKey]
        if (preset && editingProvider) {
            setEditingProvider({
                ...editingProvider,
                type: presetKey === 'gemini' ? 'gemini' : 'openai_compatible',
                baseUrl: preset.baseUrl,
                modelName: preset.modelName
            })
        }
    }

    // 保存提示词
    const handleSavePrompt = async () => {
        try {
            await window.electronAPI.capsuleSaveSettings({ systemPrompt: promptText })
            setSettings(prev => ({ ...prev, systemPrompt: promptText }))
            setPromptEditing(false)
        } catch (error) {
            console.error('[AIExtensionCenter] Save prompt error:', error)
        }
    }

    // 恢复默认提示词
    const handleResetPrompt = () => {
        setPromptText(defaultPrompt)
    }

    return (
        <div className="space-y-6">
            {/* 标题和开关 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bot size={20} className="text-violet-500" />
                    <span className="font-medium text-gray-800 dark:text-gray-100">AI 扩展中心</span>
                </div>
                <button
                    onClick={handleToggleAI}
                    className={`relative w-12 h-6 rounded-full transition-colors ${settings.useAI ? 'bg-violet-500' : 'bg-gray-300 dark:bg-neutral-600'
                        }`}
                >
                    <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${settings.useAI ? 'translate-x-6' : 'translate-x-0'
                            }`}
                    />
                </button>
            </div>

            {settings.useAI && (
                <>
                    {/* Provider 列表 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-neutral-400">已配置引擎</span>
                            <button
                                onClick={() => handleEditProvider()}
                                className="flex items-center gap-1 text-sm text-violet-500 hover:text-violet-600 dark:hover:text-violet-400"
                            >
                                <Plus size={14} />
                                添加引擎
                            </button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {providers.map(provider => (
                                <div
                                    key={provider.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${settings.activeProviderId === provider.id
                                        ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-900/20'
                                        : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-500'
                                        }`}
                                    onClick={() => handleSelectProvider(provider.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-3 h-3 rounded-full ${settings.activeProviderId === provider.id
                                                ? 'bg-violet-500'
                                                : 'bg-gray-300 dark:bg-neutral-600'
                                                }`}
                                        />
                                        <div>
                                            <div className="font-medium text-sm text-gray-800 dark:text-gray-200">{provider.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-neutral-500">
                                                {provider.type === 'gemini' ? 'Google Gemini' : 'OpenAI 兼容'}
                                                {provider.apiKey ? '' : ' • 未配置 API Key'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleEditProvider(provider)
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 rounded"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        {!provider.isDefault && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDeleteProvider(provider.id)
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 编辑表单 */}
                    {isEditing && editingProvider && (
                        <div className="p-4 rounded-lg bg-gray-50/50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                                    {editingProvider.id ? '编辑引擎' : '添加新引擎'}
                                </span>
                                <button
                                    onClick={handleCancelEdit}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* 预设快捷按钮 */}
                            <div className="flex flex-wrap gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">预设:</span>
                                {Object.keys(PRESET_URLS).map(key => (
                                    <button
                                        key={key}
                                        onClick={() => handleApplyPreset(key)}
                                        className="px-2 py-0.5 text-xs rounded bg-gray-200/50 dark:bg-neutral-700/50 hover:bg-gray-300 dark:hover:bg-neutral-600 text-gray-700 dark:text-gray-300"
                                    >
                                        {key.charAt(0).toUpperCase() + key.slice(1)}
                                    </button>
                                ))}
                            </div>

                            {/* 表单字段 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">类型</label>
                                    <select
                                        value={editingProvider.type}
                                        onChange={(e) => setEditingProvider({
                                            ...editingProvider,
                                            type: e.target.value as 'gemini' | 'openai_compatible'
                                        })}
                                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white/50 dark:bg-neutral-700/50 text-gray-900 dark:text-gray-100"
                                    >
                                        <option value="gemini">Google Gemini</option>
                                        <option value="openai_compatible">OpenAI 兼容</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">名称 *</label>
                                    <input
                                        type="text"
                                        value={editingProvider.name}
                                        onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                                        placeholder="例如: DeepSeek"
                                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white/50 dark:bg-neutral-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">API 地址 *</label>
                                <input
                                    type="text"
                                    value={editingProvider.baseUrl}
                                    onChange={(e) => setEditingProvider({ ...editingProvider, baseUrl: e.target.value })}
                                    placeholder="https://api.example.com/v1"
                                    className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white/50 dark:bg-neutral-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">API Key</label>
                                    <input
                                        type="password"
                                        value={editingProvider.apiKey || ''}
                                        onChange={(e) => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                                        placeholder="sk-xxx..."
                                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white/50 dark:bg-neutral-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">模型名称 *</label>
                                    <input
                                        type="text"
                                        value={editingProvider.modelName}
                                        onChange={(e) => setEditingProvider({ ...editingProvider, modelName: e.target.value })}
                                        placeholder="例如: gpt-4"
                                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white/50 dark:bg-neutral-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                    />
                                </div>
                            </div>

                            {/* 测试状态 */}
                            {testStatus.message && (
                                <div className={`flex items-center gap-2 text-sm ${testStatus.success ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                                    }`}>
                                    {testStatus.success ? <Check size={14} /> : <AlertCircle size={14} />}
                                    {testStatus.message}
                                </div>
                            )}

                            {/* 操作按钮 */}
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={handleTestConnection}
                                    disabled={testStatus.loading}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-neutral-600 hover:bg-gray-100/50 dark:hover:bg-neutral-700/50 text-gray-700 dark:text-gray-200"
                                >
                                    <RefreshCw size={14} className={testStatus.loading ? 'animate-spin' : ''} />
                                    测试连接
                                </button>
                                <button
                                    onClick={handleSaveProvider}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-violet-500 text-white hover:bg-violet-600"
                                >
                                    <Save size={14} />
                                    保存
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 系统提示词 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Settings size={16} className="text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-neutral-400">系统提示词</span>
                            </div>
                            {!promptEditing ? (
                                <button
                                    onClick={() => setPromptEditing(true)}
                                    className="text-sm text-violet-500 hover:text-violet-600 dark:hover:text-violet-400"
                                >
                                    编辑
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleResetPrompt}
                                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    >
                                        恢复默认
                                    </button>
                                    <button
                                        onClick={handleSavePrompt}
                                        className="text-sm text-violet-500 hover:text-violet-600 dark:hover:text-violet-400"
                                    >
                                        保存
                                    </button>
                                    <button
                                        onClick={() => {
                                            setPromptText(settings.systemPrompt)
                                            setPromptEditing(false)
                                        }}
                                        className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    >
                                        取消
                                    </button>
                                </div>
                            )}
                        </div>

                        <textarea
                            value={promptText}
                            onChange={(e) => setPromptText(e.target.value)}
                            disabled={!promptEditing}
                            rows={6}
                            className={`w-full px-3 py-2 text-sm rounded-lg border resize-none ${promptEditing
                                ? 'border-violet-300 bg-white/50 dark:bg-neutral-800/50'
                                : 'border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/20'
                                } ${isDark ? 'text-gray-200 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'}`}
                            placeholder="输入系统提示词..."
                        />
                    </div>
                </>
            )}
        </div>
    )
}

export default AIExtensionCenter
