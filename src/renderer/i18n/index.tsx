import React, { createContext, useContext, useMemo } from 'react'
import { useAppSelector } from '../hooks/useRedux'
import { zh } from './locales/zh'
import { en } from './locales/en'
import type { RootState } from '../store'

// 定义翻译对象类型
type Translations = typeof zh

// 语言包映射
const locales: Record<string, Translations> = {
    zh,
    en
}

// 创建 Context
interface I18nContextType {
    t: Translations
    language: 'zh' | 'en'
}

const I18nContext = createContext<I18nContextType>({
    t: zh,
    language: 'zh'
})

// Provider 组件
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const language = useAppSelector((state: RootState) => state.settings.language) || 'zh'

    const value = useMemo(() => ({
        t: locales[language] || zh,
        language: language as 'zh' | 'en'
    }), [language])

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    )
}

// Hook 获取翻译
export const useTranslation = () => {
    const context = useContext(I18nContext)
    return context
}

// 辅助函数：获取嵌套翻译值
export const getNestedTranslation = (obj: any, path: string): string => {
    const keys = path.split('.')
    let result = obj

    for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
            result = result[key]
        } else {
            return path // 返回原路径作为后备
        }
    }

    return typeof result === 'string' ? result : path
}

export default I18nProvider
