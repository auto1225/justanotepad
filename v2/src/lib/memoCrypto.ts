/**
 * Phase 12 — 단일 메모 비밀번호 보호 (Web Crypto API).
 * AES-GCM 256bit + PBKDF2 (SHA-256, 100k iterations).
 *
 * 암호화된 메모는 콘텐츠 자리에 sentinel HTML 저장:
 *   <div class="jan-locked" data-iv="..." data-salt="..." data-cipher="..."></div>
 * 사용자가 해제하면 base64 복호화 → 원래 HTML 복원.
 */

const ITERATIONS = 100000
const SALT_LEN = 16
const IV_LEN = 12

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as any, iterations: ITERATIONS, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function bytesToB64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s)
}
function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function encryptHtml(html: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const key = await deriveKey(password, salt)
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    new TextEncoder().encode(html) as any
  )
  const cipherB64 = bytesToB64(new Uint8Array(cipher))
  return `<div class="jan-locked" data-iv="${bytesToB64(iv)}" data-salt="${bytesToB64(salt)}" data-cipher="${cipherB64}"><p>비밀번호로 보호된 메모 — 잠금 해제 필요</p></div>`
}

export interface LockedMeta {
  iv: string
  salt: string
  cipher: string
}

export function isLocked(html: string): boolean {
  return /class="jan-locked"/.test(html)
}

export function parseLocked(html: string): LockedMeta | null {
  const div = document.createElement('div')
  div.innerHTML = html
  const el = div.querySelector('.jan-locked') as HTMLElement | null
  if (!el) return null
  const iv = el.dataset.iv
  const salt = el.dataset.salt
  const cipher = el.dataset.cipher
  if (!iv || !salt || !cipher) return null
  return { iv, salt, cipher }
}

export async function decryptHtml(html: string, password: string): Promise<string | null> {
  const meta = parseLocked(html)
  if (!meta) return null
  const salt = b64ToBytes(meta.salt)
  const iv = b64ToBytes(meta.iv)
  const cipher = b64ToBytes(meta.cipher)
  try {
    const key = await deriveKey(password, salt)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      cipher as any
    )
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}
