import type { StateStorage } from 'zustand/middleware'

const DB_NAME = 'jan-v2-local-first'
const DB_VERSION = 1
const STORE = 'kv'
const MIGRATION_PREFIX = 'jan:v2:local-first:migrated:'
// IDB 쓰기 실패로 localStorage 에 최신본이 남아있음을 표시 — getItem 이 IDB 의 옛 사본 대신 이걸 읽게 한다
const FALLBACK_PREFIX = 'jan:v2:local-first:fallback:'

let dbPromise: Promise<IDBDatabase> | null = null

function hasBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined'
}

function safeLocalGet(key: string): string | null {
  if (!hasBrowserStorage()) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeLocalSet(key: string, value: string): boolean {
  if (!hasBrowserStorage()) return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeLocalRemove(key: string) {
  if (!hasBrowserStorage()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    return
  }
}

function markMigrated(key: string) {
  safeLocalSet(MIGRATION_PREFIX + key, String(Date.now()))
}

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB is not available'))
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })

  return dbPromise
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const request = run(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || tx.error || new Error('IndexedDB request failed'))
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'))
  })
}

async function idbGet(key: string): Promise<string | null> {
  const value = await withStore<string | undefined>('readonly', (store) => store.get(key))
  return typeof value === 'string' ? value : null
}

async function idbSet(key: string, value: string): Promise<void> {
  await withStore<IDBValidKey>('readwrite', (store) => store.put(value, key))
}

async function idbRemove(key: string): Promise<void> {
  await withStore<undefined>('readwrite', (store) => store.delete(key))
}

export const localFirstStorage: StateStorage<Promise<void>> = {
  async getItem(name) {
    const legacyValue = safeLocalGet(name)
    if (!hasIndexedDb()) return legacyValue

    // 직전 setItem 이 IDB 실패로 localStorage 에 남긴 최신본이 있으면 IDB 의 옛 사본보다 우선한다
    if (legacyValue != null && safeLocalGet(FALLBACK_PREFIX + name) != null) {
      try {
        await idbSet(name, legacyValue)
        safeLocalRemove(name)
        safeLocalRemove(FALLBACK_PREFIX + name)
      } catch {
        // IDB 가 계속 실패하면 fallback 사본을 그대로 둔다
      }
      return legacyValue
    }

    try {
      const stored = await idbGet(name)
      if (stored != null) return stored

      if (legacyValue != null) {
        await idbSet(name, legacyValue)
        safeLocalRemove(name)
        markMigrated(name)
        return legacyValue
      }

      return null
    } catch {
      return legacyValue
    }
  },

  async setItem(name, value) {
    if (!hasIndexedDb()) {
      safeLocalSet(name, value)
      return
    }

    try {
      await idbSet(name, value)
      safeLocalRemove(name)
      safeLocalRemove(FALLBACK_PREFIX + name)
    } catch (error) {
      const ok = safeLocalSet(name, value) && safeLocalSet(FALLBACK_PREFIX + name, String(Date.now()))
      if (!ok) console.error('[localFirstStorage] persist failed for', name, error)
    }
  },

  async removeItem(name) {
    safeLocalRemove(name)
    safeLocalRemove(FALLBACK_PREFIX + name)
    if (!hasIndexedDb()) return
    try {
      await idbRemove(name)
    } catch {
      return
    }
  },
}

export function createLocalFirstStorage(): StateStorage<Promise<void>> {
  return localFirstStorage
}

export async function readPersistedJson<T = unknown>(name: string): Promise<{ state?: T; version?: number } | null> {
  const raw = await localFirstStorage.getItem(name)
  if (!raw) return null
  try {
    return JSON.parse(raw) as { state?: T; version?: number }
  } catch {
    return null
  }
}

export async function getLocalFirstStorageStats(): Promise<{
  backend: 'indexeddb' | 'localStorage'
  keys: Array<{ key: string; bytes: number }>
  totalBytes: number
}> {
  if (!hasIndexedDb()) {
    const keys: Array<{ key: string; bytes: number }> = []
    if (hasBrowserStorage()) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (!key || key.startsWith(MIGRATION_PREFIX)) continue
        const value = safeLocalGet(key) || ''
        keys.push({ key, bytes: key.length + value.length })
      }
    }
    return { backend: 'localStorage', keys, totalBytes: keys.reduce((sum, item) => sum + item.bytes, 0) }
  }

  try {
    const db = await openDb()
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).getAllKeys()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || tx.error)
    })
    const entries: Array<{ key: string; bytes: number }> = []
    for (const rawKey of keys) {
      const key = String(rawKey)
      const value = await idbGet(key)
      entries.push({ key, bytes: key.length + (value?.length || 0) })
    }
    return { backend: 'indexeddb', keys: entries, totalBytes: entries.reduce((sum, item) => sum + item.bytes, 0) }
  } catch {
    return { backend: 'localStorage', keys: [], totalBytes: 0 }
  }
}
