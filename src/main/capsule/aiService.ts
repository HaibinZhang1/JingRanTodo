/**
 * AI 服务模块
 * 支持 Gemini、OpenAI 兼容接口（Ollama、DeepSeek 等）
 */

import { ParsedTask, parseLocally } from './localParser'
import { AIProviderConfig, getSystemPrompt } from '../database'

// 重新导出类型
export type { AIProviderConfig } from '../database'

/**
 * 胶囊设置
 */
export interface CapsuleSettings {
    useCloudAPI: boolean
    activeProviderId?: string
    providers: AIProviderConfig[]
}

/**
 * API 调用超时时间 (ms)
 */
const API_TIMEOUT = 15000

/**
 * 获取动态系统提示词
 * 如果有自定义提示词，在其后附加当前日期；否则使用默认模板+日期
 */
function getDynamicSystemPrompt(customPrompt?: string): string {
    const currentDate = new Date()
    const dateStr = currentDate.toISOString().split('T')[0]
    const timeStr = currentDate.toTimeString().slice(0, 5)
    const weekDay = ['日', '一', '二', '三', '四', '五', '六'][currentDate.getDay()]
    const dateSuffix = `当前日期:${dateStr}(周${weekDay}) ${timeStr}。`

    // 使用自定义提示词或默认基础模板，然后附加时间
    const { BASE_SYSTEM_PROMPT } = require('../database')
    const basePrompt = (customPrompt && customPrompt.trim()) ? customPrompt.trim() : BASE_SYSTEM_PROMPT
    return `${basePrompt}${dateSuffix}`
}

/**
 * 调用 Gemini 原生 API
 */
async function callGemini(text: string, config: AIProviderConfig): Promise<ParsedTask> {
    const url = `${config.baseUrl}${config.modelName}:generateContent?key=${config.apiKey}`

    console.log('[Gemini] Calling URL:', url.replace(config.apiKey || '', '***'))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${getDynamicSystemPrompt(config.systemPrompt)}\n\n用户输入: ${text}`
                    }]
                }],
                generationConfig: {
                    temperature: config.temperature ?? 0.1,
                    maxOutputTokens: config.maxTokens ?? 256
                }
            }),
            signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
            const errorBody = await response.text()
            console.error('[Gemini] API error:', response.status, errorBody)
            throw new Error(`Gemini API error: ${response.status} - ${errorBody.slice(0, 200)}`)
        }

        const data = await response.json()
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text

        console.log('[Gemini] Raw Content:', content)

        if (!content) {
            throw new Error('Empty response from Gemini')
        }

        return parseAIResponse(content, text)
    } catch (error: any) {
        clearTimeout(timeoutId)
        console.error('[Gemini] Call failed:', error.message)
        throw error
    }
}

/**
 * 调用 OpenAI 兼容接口 (Ollama, DeepSeek, etc.)
 */
async function callOpenAICompatible(text: string, config: AIProviderConfig): Promise<ParsedTask> {
    const url = `${config.baseUrl}/chat/completions`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey || 'ollama'}`
            },
            body: JSON.stringify({
                model: config.modelName,
                messages: [
                    { role: 'system', content: getDynamicSystemPrompt(config.systemPrompt) },
                    { role: 'user', content: text }
                ],
                temperature: config.temperature ?? 0.1,
                max_tokens: config.maxTokens ?? 256
            }),
            signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        console.log('[OpenAI] Raw Content:', content)

        if (!content) {
            throw new Error('Empty response from API')
        }

        return parseAIResponse(content, text)
    } catch (error) {
        clearTimeout(timeoutId)
        throw error
    }
}

/**
 * 解析 AI 响应为 ParsedTask
 */
function parseAIResponse(content: string, originalText: string): ParsedTask {
    try {
        // 尝试提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            throw new Error('No JSON found in response')
        }

        const parsed = JSON.parse(jsonMatch[0])
        console.log('[AI] Parsed JSON from response:', JSON.stringify(parsed, null, 2))

        const result: ParsedTask = {
            title: parsed.title || originalText,
            dueDate: parsed.dueDate || undefined,
            dueTime: parsed.dueTime || undefined,
            reminderTime: parsed.hasReminder && parsed.dueTime
                ? calculateReminderFromTime(parsed.dueTime)
                : undefined,
            hasReminder: parsed.hasReminder || false,
            priority: parsed.priority || undefined,
            tags: Array.isArray(parsed.tags) ? parsed.tags : []
        }
        console.log('[AI] Final ParsedTask:', JSON.stringify(result, null, 2))
        return result
    } catch {
        // JSON 解析失败，降级到本地解析
        console.warn('[AI] Failed to parse AI response, falling back to local')
        return parseLocally(originalText)
    }
}

/**
 * 计算提醒时间（默认与任务时间相同，不提前）
 */
function calculateReminderFromTime(dueTime: string): string {
    const [hours, minutes] = dueTime.split(':').map(Number)
    // 默认不提前，提醒时间 = 任务时间
    let totalMinutes = hours * 60 + minutes
    if (totalMinutes < 0) totalMinutes = 0

    const newHours = Math.floor(totalMinutes / 60) % 24
    const newMinutes = totalMinutes % 60

    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
}

/**
 * 使用 AI 解析（指定 Provider）
 */
export async function parseWithAI(text: string, config: AIProviderConfig): Promise<ParsedTask> {
    if (config.type === 'gemini') {
        return callGemini(text, config)
    } else {
        return callOpenAICompatible(text, config)
    }
}

/**
 * 带故障转移的解析
 * 1. 如果 useCloudAPI 关闭 → 直接用本地
 * 2. 如果 useCloudAPI 开启 → 尝试 API，失败则降级本地
 */
export async function parseWithFallback(text: string): Promise<{ result: ParsedTask; source: 'local' | 'cloud' }> {
    try {
        // 使用新的数据库函数
        const { getCapsuleSettings, getActiveAIProvider, DEFAULT_SYSTEM_PROMPT } = await import('../database')

        const capsuleSettings = getCapsuleSettings()

        if (!capsuleSettings.useAI) {
            // 使用本地解析
            return { result: parseLocally(text), source: 'local' }
        }

        // 获取 Provider 配置
        const activeProvider = getActiveAIProvider()

        if (!activeProvider || !activeProvider.apiKey) {
            console.log('[AI] No active provider or API key, using local parser')
            return { result: parseLocally(text), source: 'local' }
        }

        // 使用自定义或默认系统提示词
        const providerConfig: AIProviderConfig = {
            ...activeProvider,
            systemPrompt: capsuleSettings.systemPrompt
        }

        // 尝试 AI 解析
        try {
            const result = await parseWithAI(text, providerConfig)
            return { result, source: 'cloud' }
        } catch (error) {
            console.warn('[AI] Cloud API failed, falling back to local:', error)
            return { result: parseLocally(text), source: 'local' }
        }
    } catch (error) {
        console.error('[AI] Error in parseWithFallback:', error)
        return { result: parseLocally(text), source: 'local' }
    }
}

/**
 * 测试 API 连接
 */
export async function testConnection(config: AIProviderConfig): Promise<{ success: boolean; message: string }> {
    try {
        const testText = "明天下午3点开会"
        const result = await parseWithAI(testText, config)

        if (result && result.title) {
            return { success: true, message: '连接成功！AI 解析正常工作。' }
        } else {
            return { success: false, message: '连接成功但解析结果异常' }
        }
    } catch (error: any) {
        return {
            success: false,
            message: `连接失败: ${error.message || '未知错误'}`
        }
    }
}
