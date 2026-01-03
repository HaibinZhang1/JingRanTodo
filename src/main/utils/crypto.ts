/**
 * API Key 加密工具
 * 使用 AES-256-GCM + 机器唯一标识
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { machineIdSync } from 'node-machine-id'

const ALGORITHM = 'aes-256-gcm'
const SALT = 'zenhub-capsule-salt'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * 获取加密密钥（基于机器 ID）
 */
function getEncryptionKey(): Buffer {
    try {
        const machineId = machineIdSync()
        return scryptSync(machineId, SALT, 32)
    } catch (error) {
        // 如果无法获取机器 ID，使用备用密钥
        console.warn('[Crypto] Cannot get machine ID, using fallback key')
        return scryptSync('zenhub-fallback-key', SALT, 32)
    }
}

/**
 * 加密 API Key
 * @returns 格式: iv:authTag:encryptedData (Base64)
 */
export function encryptApiKey(plainText: string): string {
    if (!plainText) return ''

    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plainText, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const authTag = cipher.getAuthTag()

    // 组合: iv:authTag:encrypted
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * 解密 API Key
 */
export function decryptApiKey(encryptedData: string): string {
    if (!encryptedData) return ''

    try {
        const parts = encryptedData.split(':')
        if (parts.length !== 3) {
            console.error('[Crypto] Invalid encrypted data format')
            return ''
        }

        const [ivBase64, authTagBase64, encrypted] = parts
        const key = getEncryptionKey()
        const iv = Buffer.from(ivBase64, 'base64')
        const authTag = Buffer.from(authTagBase64, 'base64')

        const decipher = createDecipheriv(ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)

        let decrypted = decipher.update(encrypted, 'base64', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    } catch (error) {
        console.error('[Crypto] Decryption failed:', error)
        return ''
    }
}

/**
 * 检查字符串是否已加密
 */
export function isEncrypted(text: string): boolean {
    if (!text) return false
    const parts = text.split(':')
    return parts.length === 3 && parts[0].length > 10
}
