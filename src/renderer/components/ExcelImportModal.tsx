/**
 * Excel 任务导入弹窗组件
 */
import React, { useState, useCallback } from 'react'
import { X, FileUp, Download, AlertCircle, CheckCircle, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { GlassPanel } from './GlassPanel'
import { useTranslation } from 'react-i18next'

// 解析后的子任务类型
interface ParsedSubtask {
    id: string
    title: string
    description?: string
    priority: string
    reminder_enabled: boolean
    reminder_date?: string
    reminder_hour?: number
    reminder_minute?: number
}

// 解析后的任务类型
interface ParsedTask {
    id: string
    title: string
    description?: string
    priority: string
    start_date?: string   // 开始日期 (跨天任务)
    due_date?: string
    panel_id?: string
    panel_name?: string
    reminder_enabled: boolean
    reminder_date?: string
    reminder_hour?: number
    reminder_minute?: number
    subtasks: ParsedSubtask[]
}

// 解析错误类型
interface ParseError {
    row: number
    reason: string
}

// 面板信息
interface PanelInfo {
    id: string
    title: string
}

interface ExcelImportModalProps {
    isOpen: boolean
    onClose: () => void
    existingPanels: PanelInfo[]
    isDark?: boolean
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
    isOpen,
    onClose,
    existingPanels,
    isDark = false
}) => {
    const { t } = useTranslation()

    const [filePath, setFilePath] = useState<string | null>(null)
    const [fileName, setFileName] = useState<string>('')
    const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([])
    const [parseErrors, setParseErrors] = useState<ParseError[]>([])
    const [targetPanelId, setTargetPanelId] = useState<string>('') // 目标任务卡片ID
    const [newPanelName, setNewPanelName] = useState<string>('') // 新建任务卡片名称
    const [isLoading, setIsLoading] = useState(false)
    const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set()) // 展开的任务ID

    // 监听 isOpen 变化，关闭时重置状态
    React.useEffect(() => {
        if (!isOpen) {
            setFilePath(null)
            setFileName('')
            setParsedTasks([])
            setParseErrors([])
            setTargetPanelId('')
            setNewPanelName('')
            setExpandedTasks(new Set())
            setImportResult(null)
            setIsLoading(false)
        }
    }, [isOpen])

    // 计算是否可以新建任务卡片（最多6个）
    const canCreateNewPanel = existingPanels.length < 6
    const isCreatingNewPanel = targetPanelId === '__new__'

    // 切换任务展开/收起
    const toggleTaskExpand = (taskId: string) => {
        setExpandedTasks(prev => {
            const next = new Set(prev)
            if (next.has(taskId)) {
                next.delete(taskId)
            } else {
                next.add(taskId)
            }
            return next
        })
    }

    // 选择文件
    const handleSelectFile = useCallback(async () => {
        setIsLoading(true)
        setImportResult(null)

        try {
            const path = await window.electronAPI?.excelSelectFile()
            if (!path) {
                setIsLoading(false)
                return
            }

            setFilePath(path)
            setFileName(path.split(/[\\/]/).pop() || '')

            // 解析文件
            const result = await window.electronAPI?.excelParse(path)

            if (result?.success && result.data) {
                const tasks = result.data.success || []
                setParsedTasks(tasks)
                setParseErrors(result.data.errors || [])
                // 默认展开所有有子任务的任务
                const tasksWithSubtasks = tasks.filter((t: ParsedTask) => t.subtasks.length > 0).map((t: ParsedTask) => t.id)
                setExpandedTasks(new Set(tasksWithSubtasks))
            } else {
                setParseErrors([{ row: 0, reason: result?.error || '解析失败' }])
            }
        } catch (error: any) {
            setParseErrors([{ row: 0, reason: error.message || '读取文件失败' }])
        } finally {
            setIsLoading(false)
        }
    }, [])

    // 下载模板
    const handleDownloadTemplate = useCallback(async () => {
        try {
            await window.electronAPI?.excelDownloadTemplate()
        } catch (error) {
            console.error('Download template failed:', error)
        }
    }, [])

    // 验证是否可以导入：必须有解析的任务，且必须选择已有面板或新建面板（带名称）
    const canImport = parsedTasks.length > 0 && (
        // 选择了已有面板
        (targetPanelId && targetPanelId !== '__new__') ||
        // 或者选择新建面板且填写了名称
        (isCreatingNewPanel && newPanelName.trim().length > 0)
    )

    // 执行导入
    const handleImport = useCallback(async () => {
        if (!canImport) return

        setIsLoading(true)
        setImportResult(null)

        try {
            // 准备新建任务卡片数据
            const newPanels = isCreatingNewPanel && newPanelName.trim()
                ? [{ name: newPanelName.trim(), create: true }]
                : []

            // 准备任务数据
            const tasksToImport = parsedTasks.map(task => ({
                ...task,
                panel_id: isCreatingNewPanel ? undefined : (targetPanelId || undefined)
            }))

            // 执行导入
            const result = await window.electronAPI?.excelImport(tasksToImport, newPanels)

            if (result?.success) {
                setImportResult({
                    success: true,
                    message: `成功导入 ${result.data.createdTasks} 个任务，${result.data.createdSubtasks} 个子任务`
                })
                // 成功后重置内部状态，以便下次打开或是继续使用
                setFilePath(null)
                setFileName('')
                setParsedTasks([])
                setParseErrors([])
                setTargetPanelId('')
                setNewPanelName('')
                setExpandedTasks(new Set())

                // 延迟关闭
                setTimeout(() => {
                    onClose()
                    setImportResult(null) // 关闭后重置结果
                }, 1500)
            } else {
                setImportResult({
                    success: false,
                    message: result?.error || '导入失败'
                })
            }
        } catch (error: any) {
            setImportResult({
                success: false,
                message: error.message || '导入失败'
            })
        } finally {
            setIsLoading(false)
        }
    }, [canImport, parsedTasks, targetPanelId, isCreatingNewPanel, newPanelName, onClose])

    // 重置状态
    const handleClose = useCallback(() => {
        setFilePath(null)
        setFileName('')
        setParsedTasks([])
        setParseErrors([])
        setTargetPanelId('') // 重置为空
        setNewPanelName('')
        setExpandedTasks(new Set())
        setImportResult(null)
        onClose()
    }, [onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <GlassPanel isDark={isDark} variant="modal" className="w-[700px] max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
                {/* 标题栏 */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {t('excelImport.title', '导入 Excel 任务')}
                    </h3>
                    <button
                        onClick={handleClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 内容区域 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* 文件选择区域 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('excelImport.selectFile', '选择文件')}
                            </label>
                            <button
                                onClick={handleDownloadTemplate}
                                className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                            >
                                <Download size={14} />
                                {t('excelImport.downloadTemplate', '下载模板')}
                            </button>
                        </div>

                        <div
                            onClick={handleSelectFile}
                            className={`
                                border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
                                transition-colors
                                ${filePath
                                    ? 'border-green-300 bg-green-50/50 dark:bg-green-900/20 dark:border-green-500/50'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/20'}
                            `}
                        >
                            {filePath ? (
                                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                                    <CheckCircle size={20} />
                                    <span className="font-medium">{fileName}</span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <FileUp size={32} className="mx-auto text-gray-400" />
                                    <p className="text-gray-600 dark:text-gray-300">
                                        {t('excelImport.dragOrClick', '点击选择 Excel 文件')}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {t('excelImport.supportedFormats', '支持 .xlsx, .xls 格式')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 解析错误提示 */}
                    {parseErrors.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium">
                                <AlertCircle size={18} />
                                <span>解析错误</span>
                            </div>
                            <ul className="text-sm text-red-500 dark:text-red-400 space-y-1">
                                {parseErrors.map((error, i) => (
                                    <li key={i}>
                                        {error.row > 0 ? `第 ${error.row} 行: ` : ''}{error.reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* 任务预览 */}
                    {parsedTasks.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('excelImport.preview', '预览')} ({parsedTasks.length} 个任务，{parsedTasks.reduce((sum, t) => sum + t.subtasks.length, 0)} 个子任务)
                                </label>
                            </div>

                            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700/50">
                                {parsedTasks.map((task, i) => {
                                    const hasSubtasks = task.subtasks.length > 0
                                    const isExpanded = expandedTasks.has(task.id)

                                    return (
                                        <div key={task.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                            {/* 主任务 */}
                                            <div className="p-3">
                                                <div className="flex items-start gap-2">
                                                    {/* 展开/收起按钮 */}
                                                    {hasSubtasks ? (
                                                        <button
                                                            onClick={() => toggleTaskExpand(task.id)}
                                                            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors mt-0.5"
                                                        >
                                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        </button>
                                                    ) : (
                                                        <span className="w-5" />
                                                    )}
                                                    <span className="text-xs text-gray-400 mt-0.5">{i + 1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                                                                {task.title}
                                                            </span>
                                                            <span className={`
                                                                text-xs px-1.5 py-0.5 rounded
                                                                ${task.priority === 'high' || task.priority === 'very-high'
                                                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                                                    : task.priority === 'medium'
                                                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}
                                                            `}>
                                                                {task.priority}
                                                            </span>
                                                            {hasSubtasks && (
                                                                <span className="text-xs text-gray-400">
                                                                    ({task.subtasks.length} 个子任务)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {task.due_date && (
                                                        <span className="text-xs text-gray-400 shrink-0">
                                                            {task.due_date}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 子任务列表 */}
                                            {hasSubtasks && isExpanded && (
                                                <div className="pl-10 pr-3 pb-3 space-y-1">
                                                    {task.subtasks.map((subtask, si) => (
                                                        <div key={subtask.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-white/5 rounded-lg px-2 py-1.5">
                                                            <span className="text-xs text-gray-400">└</span>
                                                            <span className="flex-1 truncate">{subtask.title}</span>
                                                            <span className={`
                                                                text-xs px-1 py-0.5 rounded
                                                                ${subtask.priority === 'high' || subtask.priority === 'very-high'
                                                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
                                                                    : subtask.priority === 'medium'
                                                                        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500 dark:text-yellow-400'
                                                                        : 'bg-gray-100 dark:bg-gray-800/50 text-gray-400'}
                                                            `}>
                                                                {subtask.priority}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* 目标任务卡片选择 */}
                    {parsedTasks.length > 0 && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                任务卡片
                            </label>

                            <div className="space-y-2">
                                {/* 已有任务卡片 */}
                                {existingPanels.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {existingPanels.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    setTargetPanelId(p.id)
                                                    setNewPanelName('')
                                                }}
                                                className={`
                                                    px-3 py-2 text-sm rounded-lg border transition-all text-left truncate
                                                    ${targetPanelId === p.id
                                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400/30'
                                                        : 'bg-white dark:bg-white/5 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-white/10'}
                                                `}
                                            >
                                                {p.title}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* 新建任务卡片选项 */}
                                {canCreateNewPanel && (
                                    <button
                                        onClick={() => setTargetPanelId('__new__')}
                                        className={`
                                            w-full px-3 py-2 text-sm rounded-lg border transition-all flex items-center gap-2
                                            ${isCreatingNewPanel
                                                ? 'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-500 text-green-700 dark:text-green-300 ring-2 ring-green-400/30'
                                                : 'bg-white dark:bg-white/5 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-white/10'}
                                        `}
                                    >
                                        <Plus size={14} className={isCreatingNewPanel ? 'text-green-600 dark:text-green-400' : 'text-gray-400'} />
                                        新建任务卡片
                                    </button>
                                )}
                            </div>

                            {/* 新建任务卡片名称输入 */}
                            {isCreatingNewPanel && (
                                <div className="flex items-center gap-2">
                                    <Plus size={16} className="text-blue-500 shrink-0" />
                                    <input
                                        type="text"
                                        value={newPanelName}
                                        onChange={(e) => setNewPanelName(e.target.value)}
                                        placeholder="输入新任务卡片名称..."
                                        className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800/50 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* 导入结果 */}
                    {importResult && (
                        <div className={`
                            p-4 rounded-xl flex items-center gap-2
                            ${importResult.success
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}
                        `}>
                            {importResult.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                            <span>{importResult.message}</span>
                        </div>
                    )}
                </div>

                {/* 底部按钮 */}
                <div className="flex justify-end gap-3 p-4 border-t border-white/10 shrink-0">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        {t('common.cancel', '取消')}
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!canImport || isLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                处理中...
                            </>
                        ) : (
                            <>
                                <FileUp size={16} />
                                {t('excelImport.import', '导入')}
                            </>
                        )}
                    </button>
                </div>
            </GlassPanel >
        </div >
    )
}

export default ExcelImportModal
