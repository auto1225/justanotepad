// Vitest setup — jsdom 환경에서 globals 노출.
import '@testing-library/react'

// localStorage 모킹은 jsdom 이 기본 제공.
if (typeof window !== 'undefined' && !window.matchMedia) {
  // jsdom 은 matchMedia 를 제공하지 않음 → polyfill
  ;(window as unknown as { matchMedia: () => unknown }).matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}
