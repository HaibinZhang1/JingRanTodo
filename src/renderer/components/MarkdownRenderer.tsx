import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface MarkdownRendererProps {
    content: string
    className?: string
    style?: React.CSSProperties
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '', style }) => {
    return (
        <div className={`markdown-preview ${className}`} style={style}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                    // 自定义标题样式
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-gray-800 mt-4 mb-2 pb-2 border-b border-gray-200">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-xl font-bold text-gray-700 mt-3 mb-2">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-lg font-semibold text-gray-700 mt-2 mb-1">
                            {children}
                        </h3>
                    ),
                    // 段落
                    p: ({ children }) => (
                        <p className="text-gray-700 mb-2 leading-relaxed">
                            {children}
                        </p>
                    ),
                    // 列表
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-2 text-gray-700 space-y-1">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-2 text-gray-700 space-y-1">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="ml-2">{children}</li>
                    ),
                    // 代码块
                    code: ({ className, children, ...props }) => {
                        const isInline = !className
                        if (isInline) {
                            return (
                                <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                    {children}
                                </code>
                            )
                        }
                        return (
                            <code className="block bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono overflow-x-auto mb-2" {...props}>
                                {children}
                            </code>
                        )
                    },
                    pre: ({ children }) => (
                        <pre className="mb-2">{children}</pre>
                    ),
                    // 引用
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-400 pl-4 italic text-gray-600 my-2 bg-blue-50/50 py-2 rounded-r">
                            {children}
                        </blockquote>
                    ),
                    // 链接
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            onClick={(e) => {
                                e.preventDefault()
                                if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                                    (window as any).electronAPI?.openExternalUrl?.(href)
                                }
                            }}
                            className="text-blue-500 hover:text-blue-600 underline cursor-pointer"
                        >
                            {children}
                        </a>
                    ),
                    // 图片
                    img: ({ src, alt }) => (
                        <img
                            src={src}
                            alt={alt || ''}
                            className="max-w-full rounded-lg shadow-sm my-2"
                        />
                    ),
                    // 表格
                    table: ({ children }) => (
                        <div className="overflow-x-auto mb-2">
                            <table className="min-w-full border-collapse border border-gray-200 rounded-lg">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-gray-100">{children}</thead>
                    ),
                    th: ({ children }) => (
                        <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="border border-gray-200 px-3 py-2 text-gray-600">
                            {children}
                        </td>
                    ),
                    // 水平线
                    hr: () => <hr className="border-gray-200 my-4" />,
                    // 粗体和斜体
                    strong: ({ children }) => (
                        <strong className="font-bold text-gray-800">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-gray-700">{children}</em>
                    ),
                    // 删除线 (GFM)
                    del: ({ children }) => (
                        <del className="text-gray-400 line-through">{children}</del>
                    ),
                    // 任务列表 (GFM)
                    input: ({ checked, ...props }) => (
                        <input
                            type="checkbox"
                            checked={checked}
                            disabled
                            className="mr-2 accent-blue-500"
                            {...props}
                        />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}

export default MarkdownRenderer
