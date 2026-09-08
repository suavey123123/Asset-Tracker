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
 * Memoizes a function with stable deps inference from its closure vars.
 * Useful for inline arrow functions passed as props.
 */
export function useStable(fn) {
  return useCallback(fn, [])
}
