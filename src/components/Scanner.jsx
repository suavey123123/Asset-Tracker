import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Badge, Spinner } from './UI'

export default function Scanner({ onViewAsset }) {
  const [manualTag, setManualTag] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => () => stopCamera(), [])

  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const onOnline = () => setIsOffline(false)
    const onOffline = () => setIsOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  async function lookup(tag) {
    if (!tag.trim()) return
    setLoading(true); setError(''); setResult(null)

    try {
      const { data } = await supabase.from('assets').select('*')
        .or(`asset_tag.ilike.${tag.trim()},id.eq.${tag.trim().match(/^[0-9a-f-]{36}$/) ? tag.trim() : '00000000-0000-0000-0000-000000000000'}`)
        .limit(1).maybeSingle()
      setLoading(false)
      if (!data) { setError(`No asset found for tag: "${tag.trim()}"`); return }
      setResult(data)
    setPulse(true); setTimeout(()=>setPulse(false), 600)
    // Play success beep
    try { const ctx=new AudioContext(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value=880; g.gain.setValueAtTime(0.3,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3); o.start(ctx.currentTime); o.stop(ctx.currentTime+0.3) } catch {}
    } catch(e) {
      // Try offline cache
      try {
        const cached = localStorage.getItem('offline_assets')
        if (cached) {
          const assets = JSON.parse(cached)
          const found = assets.find(a => a.asset_tag?.toLowerCase() === tag.trim().toLowerCase())
          setLoading(false)
          if (found) { setResult(found); return }
        }
      } catch {}
      setLoading(false)
      setError(isOffline ? `Offline — no cached data for "${tag.trim()}"` : `No asset found for tag: "${tag.trim()}"`)
    }
  }

  async function startCamera() {
    setCameraError(''); setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      // Load barcode detector
      startScanning()
    } catch(e) {
      setCameraError('Camera access denied. Please allow camera permissions.')
      setScanning(false)
    }
  }

  function stopCamera() {
    clearInterval(intervalRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    setScanning(false)
  }

  function startScanning() {
    // Use BarcodeDetector if available (Chrome 83+, Android)
    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({ formats: ['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e','data_matrix','pdf417','aztec'] })
      intervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            const raw = codes[0].rawValue
            stopCamera()
            setManualTag(raw)
            lookup(raw)
          }
        } catch(e) {}
      }, 300)
    } else {
      // Fallback: use canvas + ZXing via CDN
      loadZXing()
    }
  }

  function loadZXing() {
    if (window.ZXing) { initZXing(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.20.0/umd/index.min.js'
    s.onload = initZXing
    s.onerror = () => setCameraError('Barcode library failed to load. Try manual entry.')
    document.head.appendChild(s)
  }

  function initZXing() {
    try {
      const hints = new Map()
      const reader = new window.ZXing.MultiFormatReader()
      reader.setHints(hints)
      intervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        ctx.drawImage(videoRef.current, 0, 0)
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const source = new window.ZXing.RGBLuminanceSource(imageData.data, canvas.width, canvas.height)
          const bmp = new window.ZXing.BinaryBitmap(new window.ZXing.HybridBinarizer(source))
          const result = reader.decode(bmp)
          if (result) { stopCamera(); setManualTag(result.getText()); lookup(result.getText()) }
        } catch(e) {}
      }, 300)
    } catch(e) { setCameraError('Scanner init failed. Try manual entry.') }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.5rem', marginBottom:'1rem' }}>
        <div style={{ fontSize:14, fontWeight:500, marginBottom:'1rem' }}>Scan or enter asset tag</div>

        {/* Manual entry */}
        <div style={{ display:'flex', gap:8, marginBottom:'1rem' }}>
          <input value={manualTag} onChange={e=>setManualTag(e.target.value)} onKeyDown={e=>e.key==='Enter'&&lookup(manualTag)} placeholder="Enter asset tag or scan…" style={{ flex:1, fontSize:14 }} autoFocus />
          <Btn variant="primary" onClick={()=>lookup(manualTag)} disabled={loading || !manualTag.trim()}>
            {loading ? <Spinner size={14} /> : 'Look up'}
          </Btn>
        </div>

        {/* Camera scanner */}
        {!scanning ? (
          <Btn onClick={startCamera} style={{ width:'100%', justifyContent:'center' }}>
            📷 Start camera scanner
          </Btn>
        ) : (
          <div>
            <div style={{ position:'relative', borderRadius:'var(--radius)', overflow:'hidden', background:'#000', marginBottom:8 }}>
              <video ref={videoRef} style={{ width:'100%', display:'block', maxHeight:300, objectFit:'cover' }} playsInline muted />
              <canvas ref={canvasRef} style={{ display:'none' }} />
              {/* Scan overlay */}
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <div style={{ width:200, height:150, border:'2px solid var(--accent)', borderRadius:8, boxShadow:'0 0 0 9999px rgba(0,0,0,0.4)' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'var(--accent)', animation:'scan 2s linear infinite', opacity:0.8 }} />
                </div>
              </div>
            </div>
            <Btn onClick={stopCamera} style={{ width:'100%', justifyContent:'center' }}>Stop camera</Btn>
          </div>
        )}

        {cameraError && <div style={{ color:'var(--amber)', fontSize:13, marginTop:8 }}>⚠ {cameraError}</div>}

        {/* Supported formats */}
        <div style={{ marginTop:12, fontSize:11, color:'var(--text3)' }}>
          Supports: QR Code, Code 128, Code 39, EAN-13, EAN-8, UPC-A, UPC-E, Data Matrix, PDF417
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:'var(--radius)', padding:'12px 16px', fontSize:13, color:'var(--red)', marginBottom:'1rem' }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ background:'var(--bg2)', border:`2px solid ${pulse?'var(--accent)':'var(--green)'}`, borderRadius:'var(--radius-lg)', padding:'1.25rem', transition:'border-color 0.3s', boxShadow:pulse?'0 0 20px rgba(212,255,78,0.3)':'none' }} className="fade-in">
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1rem' }}>
            <div style={{ fontSize:20 }}>✓</div>
            <div>
              <div style={{ fontSize:15, fontWeight:500 }}>{result.model || result.asset_tag}</div>
              <div style={{ fontSize:12, fontFamily:'var(--mono)', color:'var(--text2)' }}>{result.asset_tag}</div>
            </div>
            <div style={{ marginLeft:'auto' }}><Badge status={result.status} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px', fontSize:13, marginBottom:'1rem' }}>
            {[['Category', result.category], ['Status', result.status], ['Assigned to', result.assigned_to||'—'], ['Location', result.location||'—'], ['Serial', result.serial_number||'—'], ['Purchase cost', result.purchase_cost?'$'+parseFloat(result.purchase_cost).toFixed(2):'—']].map(([l,v])=>(
              <div key={l}><div style={{ fontSize:11, color:'var(--text2)', marginBottom:2 }}>{l}</div><div>{v}</div></div>
            ))}
          </div>
          {result.quick_note && (
            <div style={{ background:'rgba(212,255,78,0.05)', border:'1px solid rgba(212,255,78,0.2)', borderRadius:'var(--radius)', padding:'8px 12px', fontSize:12, color:'var(--text2)', marginBottom:'1rem' }}>
              📝 {result.quick_note}
            </div>
          )}
          <Btn variant="primary" onClick={()=>onViewAsset?.(result)} style={{ width:'100%', justifyContent:'center' }}>
            Open full asset record →
          </Btn>
        </div>
      )}

      <style>{`@keyframes scan { 0%{top:0} 100%{top:calc(100% - 2px)} }`}</style>
    </div>
  )
}
