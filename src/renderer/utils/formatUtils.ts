/**
 * 格式化工具函数
 */

/**
 * 数字转中文序号
 * @param num - 要转换的数字
 * @returns 中文数字字符串
 */
export function toChineseNum(num: number): string {
    const chars = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
    if (num <= 10) return chars[num]
    if (num < 20) return '十' + (num % 10 === 0 ? '' : chars[num % 10])
    return num.toString()
}

/**
 * 获取优先级对应的 Tailwind CSS 颜色类
 * @param priority - 优先级字符串
 * @returns Tailwind 背景颜色类名
 */
export function getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
        'very-low': 'bg-gray-400',
        'low': 'bg-green-500',
        'medium': 'bg-yellow-500',
        'high': 'bg-red-500',
        'very-high': 'bg-red-800'
    }
    return colors[priority] || 'bg-gray-400'
}
