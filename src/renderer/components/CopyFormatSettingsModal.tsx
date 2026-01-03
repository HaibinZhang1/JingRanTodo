import React, { useState, useEffect } from 'react'
import { X, Copy } from 'lucide-react'
import { GlassPanel } from './GlassPanel'

export interface CopyFormatSettings {
    copyFormat: 'text' | 'json' | 'markdown'
    copyTemplateTask: string
    copyTemplateSubtask: string
}

interface CopyFormatSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (settings: CopyFormatSettings) => void
    initialSettings?: Partial<CopyFormatSettings>
    title?: string
}

const DEFAULT_TASK_TEMPLATE = '{{chinese_index}}、{{title}}\n    {{description}}\n{{subtasks}}'
const DEFAULT_SUBTASK_TEMPLATE = '    {{index}}.{{title}}\n        {{description}}'

export const CopyFormatSettingsModal: React.FC<CopyFormatSettingsModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialSettings,
    title = '复制格式设置'
}) => {
    const [format, setFormat] = useState<'text' | 'json' | 'markdown'>(initialSettings?.copyFormat || 'text')
    const [taskTemplate, setTaskTemplate] = useState(initialSettings?.copyTemplateTask || DEFAULT_TASK_TEMPLATE)
    const [subtaskTemplate, setSubtaskTemplate] = useState(initialSettings?.copyTemplateSubtask || DEFAULT_SUBTASK_TEMPLATE)

    // Reset form when modal opens with new settings
    useEffect(() => {
        if (isOpen) {
            setFormat(initialSettings?.copyFormat || 'text')
            setTaskTemplate(initialSettings?.copyTemplateTask || DEFAULT_TASK_TEMPLATE)
            setSubtaskTemplate(initialSettings?.copyTemplateSubtask || DEFAULT_SUBTASK_TEMPLATE)
        }
    }, [isOpen, initialSettings])

    const handleSave = () => {
        onSave({
            copyFormat: format,
            copyTemplateTask: taskTemplate,
            copyTemplateSubtask: subtaskTemplate
        })
        onClose()
    }

    const handleReset = () => {
        setTaskTemplate(DEFAULT_TASK_TEMPLATE)
        setSubtaskTemplate(DEFAULT_SUBTASK_TEMPLATE)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
            <GlassPanel variant="modal" className="w-full max-w-md p-6 rounded-2xl shadow-2xl bg-white/95">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Copy size={18} className="text-blue-500" />
                        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Format Selector */}
                <div className="mb-4">
                    <label className="text-sm font-semibold text-gray-600 mb-2 block">复制格式</label>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {(['text', 'json', 'markdown'] as const).map((fmt) => (
                            <button
                                key={fmt}
                                onClick={() => setFormat(fmt)}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all
                                    ${format === fmt ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {fmt === 'text' ? '中文预设' : fmt === 'json' ? 'JSON' : 'Markdown'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Template Editors (only for text format) */}
                {format === 'text' && (
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-semibold text-gray-600">任务模板</label>
                                <span className="text-[10px] text-gray-400">
                                    支持: {'{{chinese_index}}'}, {'{{title}}'}, {'{{description}}'}, {'{{subtasks}}'}
                                </span>
                            </div>
                            <textarea
                                value={taskTemplate}
                                onChange={(e) => setTaskTemplate(e.target.value)}
                                className="w-full h-24 p-3 bg-white border border-gray-200 rounded-xl text-sm font-mono text-gray-600 outline-none focus:ring-2 focus:ring-blue-400 resize-none leading-relaxed"
                                placeholder="任务模板..."
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-semibold text-gray-600">子任务模板</label>
                                <span className="text-[10px] text-gray-400">
                                    支持: {'{{index}}'}, {'{{title}}'}, {'{{description}}'}
                                </span>
                            </div>
                            <textarea
                                value={subtaskTemplate}
                                onChange={(e) => setSubtaskTemplate(e.target.value)}
                                className="w-full h-20 p-3 bg-white border border-gray-200 rounded-xl text-sm font-mono text-gray-600 outline-none focus:ring-2 focus:ring-blue-400 resize-none leading-relaxed"
                                placeholder="子任务模板..."
                            />
                        </div>
                        <button
                            onClick={handleReset}
                            className="text-xs text-gray-500 hover:text-blue-500 transition-colors"
                        >
                            重置为默认模板
                        </button>
                    </div>
                )}

                {/* Format Preview */}
                {format === 'json' && (
                    <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 font-mono">
                        {'{"title": "任务标题", "description": "描述", "subtasks": [...]}'}
                    </div>
                )}
                {format === 'markdown' && (
                    <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 font-mono whitespace-pre-wrap">
                        {'## 任务标题\n任务描述\n\n### 子任务\n- [x] 子任务1'}
                    </div>
                )}

                {/* Footer Buttons */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
                    >
                        保存
                    </button>
                </div>
            </GlassPanel>
        </div>
    )
}

export default CopyFormatSettingsModal
