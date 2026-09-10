import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Returns value debounced by `delay` ms.
 */
export function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

/**
 * Runs the fetch function with an AbortController.
 * Returns [data, error, abortFn].
 * AbortController is recreated when `deps` change.
 */
export function useAbortableFetch(fn, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  // Re-create AbortController when deps change
  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, deps)

  async function run(input) {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    try {
      setError(null)
      setData(null)
      const result = await fn(input, { signal })
      if (!signal.aborted) setData(result)
    } catch (e) {
      if (e.name !== 'AbortError') setError(e)
    }
  }

  return { data, error, run }
}

/**
 * Runs a callback every `ms` ms. Pass `null` to disable.
 * Safe cleanup on unmount.
 */
export function useInterval(callback, ms) {
  const savedCallback = useRef(callback)
  useEffect(() => { savedCallback.current = callback }, [callback])
  useEffect(() => {
    if (ms == null) return
    const id = setInterval(savedCallback.current, ms)
    return () => clearInterval(id)
  }, [ms])
}

/**
 * Memoizes a function with the given dependency array (defaults to []).
 * Useful for inline arrow functions passed as props.
 * If the function references state that changes, pass those vars in `deps`.
 */
export function useStable(fn, deps = []) {
  return useCallback(fn, deps)
}

/**
 * Centralizes theme state (dark/light) between Dashboard and Settings.
 * Writes CSS custom properties to :root on change.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  useEffect(() => {
    localStorage.setItem('theme', theme)
    const vars = theme === 'light' ? {
      '--bg': '#f5f5f5', '--bg2': '#ffffff', '--bg3': '#f0f0f0', '--bg4': '#e8e8e8',
      '--border': '#e0e0e0', '--border2': '#d0d0d0',
      '--text': '#111111', '--text2': '#555555', '--text3': '#999999',
    } : {
      '--bg': '#0f0f0f', '--bg2': '#161616', '--bg3': '#1e1e1e', '--bg4': '#262626',
      '--border': '#2a2a2a', '--border2': '#333',
      '--text': '#e8e8e8', '--text2': '#999', '--text3': '#555',
    }
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
  }, [theme])
  return { theme, setTheme }
}
