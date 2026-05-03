import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Badge, Spinner } from './UI'

export default function Scanner({ onViewAsset }) {
  const [mode, setMode] = useState('idle') // idle | scanning | result | manual
  const [result, setResult] = useState(null)
  const [manualTag, setManualTag] = useState('')
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scannerRef = useRef(null)

  useEffect(() => {
    return () => stopCamera()
  }, [])

  async function startCamera() {
    setError('')
    setMode('scanning')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      startScanning()
    } catch (e) {
      setError('Camera access denied. Use manual search instead.')
      setMode('idle')
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (scannerRef.current) {
      clearInterval(scannerRef.current)
      scannerRef.current = null
    }
  }

  function startScanning() {
    // Use BarcodeDetector API if available
    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix'] })
      scannerRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue
            stopCamera()
            lookupAsset(code)
          }
        } catch(e) {}
      }, 300)
    } else {
      // Fallback: show manual entry
      setError('Auto-scan not supported on this browser. Use manual search below.')
    }
  }

  async function lookupAsset(tag) {
    setSearching(true)
    setMode('result')
    setError('')

    // Try to match asset_tag, or extract tag from QR URL
    let searchTag = tag
    if (tag.includes('/asset/')) {
      const id = tag.split('/asset/').pop()
      const { data } = await supabase.from('assets').select('*').eq('id', id).single()
      if (data) { setResult(data); setSearching(false); return }
    }

    const { data } = await supabase.from('assets').select('*').ilike('asset_tag', searchTag).single()
    if (data) {
      setResult(data)
    } else {
      setError(`No asset found for "${searchTag}"`)
      setResult(null)
    }
    setSearching(false)
  }

  async function manualSearch() {
    if (!manualTag.trim()) return
    stopCamera()
    await lookupAsset(manualTag.trim())
  }

  function reset() {
    stopCamera()
    setMode('idle')
    setResult(null)
    setError('')
    setManualTag('')
  }

  return (
    <div className="fade-in">
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Idle state */}
        {mode === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Scan asset QR code or barcode</h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.5rem' }}>Point your camera at an asset label to instantly look it up.</p>
              <Btn variant="primary" onClick={startCamera} style={{ width: '100%', justifyContent: 'center' }}>
                📷 Open camera
              </Btn>
            </div>

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Or search by asset tag</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={manualTag}
                  onChange={e => setManualTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && manualSearch()}
                  placeholder="e.g. IT-0042"
                  style={{ flex: 1 }}
                  autoFocus
                />
                <Btn variant="primary" onClick={manualSearch} disabled={!manualTag.trim()}>Search</Btn>
              </div>
            </div>
          </div>
        )}

        {/* Camera scanning */}
        {mode === 'scanning' && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ position: 'relative', aspectRatio: '4/3', background: '#000' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
              {/* Scanner overlay */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 200, height: 200, border: '2px solid var(--accent)', borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }}>
                  {/* Corner marks */}
                  {[['0,0','top left'],['auto,0','top right'],['0,auto','bottom left'],['auto,auto','bottom right']].map(([pos, label]) => (
                    <div key={label} style={{ position: 'absolute', width: 20, height: 20, borderColor: 'var(--accent)', borderStyle: 'solid', borderWidth: pos.startsWith('0') ? '2px 0 0 2px' : pos === 'auto,0' ? '2px 2px 0 0' : pos === '0,auto' ? '0 0 2px 2px' : '0 2px 2px 0' }} />
                  ))}
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px', textAlign: 'center', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                <p style={{ fontSize: 12, color: '#fff', marginBottom: 8 }}>Point camera at asset QR code or barcode</p>
              </div>
            </div>
            <div style={{ padding: '1rem' }}>
              {error && <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 10 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={manualTag} onChange={e => setManualTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && manualSearch()} placeholder="Or type asset tag manually" style={{ flex: 1 }} />
                <Btn size="sm" onClick={manualSearch}>Search</Btn>
              </div>
              <Btn style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={reset}>Cancel</Btn>
            </div>
          </div>
        )}

        {/* Result */}
        {mode === 'result' && (
          <div>
            {searching ? (
              <div style={{ padding: '3rem' }}><Spinner /></div>
            ) : result ? (
              <div className="fade-in">
                <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 13, color: 'var(--green)', marginBottom: '1rem' }}>
                  ✓ Asset found
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{result.name}</h2>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{result.asset_tag}</span>
                        <Badge status={result.status} />
                      </div>
                    </div>
                    <Badge status={result.category} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    {[['Location', result.location], ['Assigned to', result.assigned_to], ['Model', result.model], ['Serial #', result.serial_number]].map(([l, v]) => v ? (
                      <div key={l}>
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 13 }}>{v}</div>
                      </div>
                    ) : null)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="primary" onClick={() => { onViewAsset?.(result); reset() }} style={{ flex: 1, justifyContent: 'center' }}>
                    View full details →
                  </Btn>
                  <Btn onClick={reset}>Scan another</Btn>
                </div>
              </div>
            ) : (
              <div className="fade-in">
                <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: '1rem' }}>
                  {error}
                </div>
                <Btn onClick={reset} style={{ width: '100%', justifyContent: 'center' }}>Try again</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
