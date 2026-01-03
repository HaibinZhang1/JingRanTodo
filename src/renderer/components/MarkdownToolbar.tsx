import React from 'react'
import {
    Bold, Italic, Strikethrough, Code, Link, List, ListOrdered,
    Quote, Minus, Heading1, Heading2, Heading3, Image, CheckSquare
} from 'lucide-react'

interface MarkdownToolbarProps {
    textareaRef: React.RefObject<HTMLTextAreaElement>
    content: string
    onChange: (newContent: string) => void
}

interface ToolbarButton {
    icon: React.ReactNode
    title: string
    action: 'wrap' | 'prefix' | 'insert'
    before?: string
    after?: string
    text?: string
    placeholder?: string
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ textareaRef, content, onChange }) => {

    const buttons: ToolbarButton[] = [
        { icon: <Heading1 size={16} />, title: '一级标题', action: 'prefix', before: '# ', placeholder: '标题' },
        { icon: <Heading2 size={16} />, title: '二级标题', action: 'prefix', before: '## ', placeholder: '标题' },
        { icon: <Heading3 size={16} />, title: '三级标题', action: 'prefix', before: '### ', placeholder: '标题' },
        { icon: <Bold size={16} />, title: '粗体 (Ctrl+B)', action: 'wrap', before: '**', after: '**', placeholder: '粗体文本' },
        { icon: <Italic size={16} />, title: '斜体 (Ctrl+I)', action: 'wrap', before: '*', after: '*', placeholder: '斜体文本' },
        { icon: <Strikethrough size={16} />, title: '删除线', action: 'wrap', before: '~~', after: '~~', placeholder: '删除文本' },
        { icon: <Code size={16} />, title: '行内代码 (Ctrl+`)', action: 'wrap', before: '`', after: '`', placeholder: '代码' },
        { icon: <Link size={16} />, title: '链接 (Ctrl+K)', action: 'insert', text: '[链接文字](https://)', placeholder: '' },
        { icon: <Image size={16} />, title: '图片', action: 'insert', text: '![图片描述](图片路径)', placeholder: '' },
        { icon: <List size={16} />, title: '无序列表', action: 'prefix', before: '- ', placeholder: '列表项' },
        { icon: <ListOrdered size={16} />, title: '有序列表', action: 'prefix', before: '1. ', placeholder: '列表项' },
        { icon: <CheckSquare size={16} />, title: '任务列表', action: 'prefix', before: '- [ ] ', placeholder: '任务' },
        { icon: <Quote size={16} />, title: '引用', action: 'prefix', before: '> ', placeholder: '引用内容' },
        { icon: <Minus size={16} />, title: '分割线', action: 'insert', text: '\n---\n', placeholder: '' },
    ]

    // 使用 execCommand 插入文本以支持原生撤销
    const insertTextWithUndo = (textarea: HTMLTextAreaElement, text: string, selectStart?: number, selectEnd?: number) => {
        textarea.focus()

        // 使用 insertText 命令，这样可以被 Ctrl+Z 撤销
        document.execCommand('insertText', false, text)

        // 如果需要选中特定区域
        if (selectStart !== undefined && selectEnd !== undefined) {
            const currentPos = textarea.selectionStart
            const textLength = text.length
            const basePos = currentPos - textLength
            setTimeout(() => {
                textarea.setSelectionRange(basePos + selectStart, basePos + selectEnd)
            }, 0)
        }
    }

    const handleButtonClick = (button: ToolbarButton) => {
        const textarea = textareaRef.current
        if (!textarea) return

        textarea.focus()

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selectedText = content.substring(start, end)

        switch (button.action) {
            case 'wrap': {
                // 包裹选中文本
                const textToWrap = selectedText || button.placeholder || ''
                const wrappedText = `${button.before}${textToWrap}${button.after}`

                if (selectedText) {
                    // 有选中文本，替换并包裹
                    insertTextWithUndo(textarea, wrappedText)
                } else {
                    // 无选中文本，插入带占位符的文本，并选中占位符
                    insertTextWithUndo(
                        textarea,
                        wrappedText,
                        button.before?.length || 0,
                        (button.before?.length || 0) + textToWrap.length
                    )
                }
                break
            }

            case 'prefix': {
                // 行首添加前缀
                if (selectedText) {
                    // 替换选中文本
                    insertTextWithUndo(textarea, `${button.before}${selectedText}`)
                } else {
                    // 移动到行首插入
                    const lineStart = content.lastIndexOf('\n', start - 1) + 1
                    textarea.setSelectionRange(lineStart, lineStart)
                    insertTextWithUndo(textarea, button.before || '')
                }
                break
            }

            case 'insert': {
                // 直接插入文本
                insertTextWithUndo(textarea, button.text || '')
                break
            }
        }
    }

    // 分组渲染按钮
    const groups = [
        buttons.slice(0, 3),   // 标题
        buttons.slice(3, 7),   // 文本格式
        buttons.slice(7, 9),   // 链接/图片
        buttons.slice(9, 13),  // 列表/引用
        buttons.slice(13),     // 分割线
    ]

    return (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/10 bg-white/10 overflow-x-auto">
            {groups.map((group, groupIdx) => (
                <div key={groupIdx} className="flex items-center gap-0.5">
                    {group.map((btn, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleButtonClick(btn)}
                            title={btn.title}
                            className="p-1.5 rounded hover:bg-white/20 text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            {btn.icon}
                        </button>
                    ))}
                    {groupIdx < groups.length - 1 && (
                        <div className="w-px h-4 bg-gray-300 mx-1" />
                    )}
                </div>
            ))}
        </div>
    )
}

// 快捷键处理 Hook - 使用 execCommand 支持原生撤销
export const useMarkdownShortcuts = (
    textareaRef: React.RefObject<HTMLTextAreaElement>,
    content: string,
    _onChange: (newContent: string) => void // 不再直接使用，改用 execCommand
) => {
    // 使用 execCommand 插入文本以支持原生撤销
    const insertTextWithUndo = (textarea: HTMLTextAreaElement, text: string) => {
        textarea.focus()
        document.execCommand('insertText', false, text)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selectedText = content.substring(start, end)

        // Ctrl+B: 粗体
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault()
            const textToWrap = selectedText || '粗体'
            insertTextWithUndo(textarea, `**${textToWrap}**`)
            if (!selectedText) {
                setTimeout(() => textarea.setSelectionRange(start + 2, start + 4), 0)
            }
            return
        }

        // Ctrl+I: 斜体
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault()
            const textToWrap = selectedText || '斜体'
            insertTextWithUndo(textarea, `*${textToWrap}*`)
            if (!selectedText) {
                setTimeout(() => textarea.setSelectionRange(start + 1, start + 3), 0)
            }
            return
        }

        // Ctrl+K: 链接
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault()
            const linkText = selectedText || '链接文字'
            insertTextWithUndo(textarea, `[${linkText}](https://)`)
            setTimeout(() => {
                const urlStart = start + linkText.length + 3
                textarea.setSelectionRange(urlStart, urlStart + 8)
            }, 0)
            return
        }

        // Ctrl+`: 行内代码
        if (e.ctrlKey && e.key === '`') {
            e.preventDefault()
            const textToWrap = selectedText || '代码'
            insertTextWithUndo(textarea, `\`${textToWrap}\``)
            if (!selectedText) {
                setTimeout(() => textarea.setSelectionRange(start + 1, start + 3), 0)
            }
            return
        }

        // Ctrl+Shift+K: 代码块
        if (e.ctrlKey && e.shiftKey && e.key === 'K') {
            e.preventDefault()
            const codeBlock = selectedText
                ? `\`\`\`\n${selectedText}\n\`\`\``
                : '```\n代码\n```'
            insertTextWithUndo(textarea, codeBlock)
            if (!selectedText) {
                setTimeout(() => textarea.setSelectionRange(start + 4, start + 6), 0)
            }
            return
        }

        // Tab: 缩进 (使用 execCommand)
        if (e.key === 'Tab') {
            e.preventDefault()
            const indent = '    '
            if (e.shiftKey) {
                // Shift+Tab: 取消缩进 - 需要特殊处理
                const lineStart = content.lastIndexOf('\n', start - 1) + 1
                const lineContent = content.substring(lineStart, start)
                if (lineContent.startsWith(indent)) {
                    // 选中缩进部分然后删除
                    textarea.setSelectionRange(lineStart, lineStart + indent.length)
                    insertTextWithUndo(textarea, '')
                }
            } else {
                // Tab: 添加缩进
                insertTextWithUndo(textarea, indent)
            }
            return
        }
    }

    return { handleKeyDown }
}

export default MarkdownToolbar
