import { useRef, useState, useEffect } from 'react'
import { Btn, Modal } from './UI'

export default function CheckoutAgreement({ open, onClose, asset, employee, onSign }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [lastPos, setLastPos] = useState(null)

  useEffect(() => {
    if (open) { setHasSignature(false); setAgreed(false); clearSig() }
  }, [open])

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e) {
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    setDrawing(true)
    setLastPos(getPos(e, canvas))
  }

  function draw(e) {
    e.preventDefault()
    if (!drawing) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.x, lastPos.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#d4ff4e'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    setLastPos(pos)
    setHasSignature(true)
  }

  function endDraw(e) { e?.preventDefault(); setDrawing(false); setLastPos(null) }

  function clearSig() {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  function generatePDF() {
    const canvas = canvasRef.current
    const sigDataUrl = canvas.toDataURL('image/png')
    const today = new Date().toLocaleString()
    const win = window.open('', '_blank', 'noopener,noreferrer')
    win.document.write(`
      <html><head><title>Asset Checkout Agreement</title>
      <style>
        body { font-family: Arial, sans-serif; max-width:700px; margin:40px auto; color:#111; font-size:13px }
        h1 { font-size:20px; margin-bottom:4px }
        h2 { font-size:14px; border-bottom:2px solid #d4ff4e; padding-bottom:4px; margin:20px 0 10px }
        .meta { color:#666; font-size:12px; margin-bottom:20px }
        table { width:100%; border-collapse:collapse; margin-bottom:16px }
        td { padding:7px 10px; border:1px solid #ddd; font-size:12px }
        td:first-child { font-weight:600; background:#f9f9f9; width:35% }
        .terms { background:#f9f9f9; border:1px solid #ddd; padding:14px; border-radius:4px; margin:16px 0; font-size:12px; line-height:1.7 }
        .sig-box { border:2px solid #333; border-radius:4px; padding:10px; margin-top:8px; display:inline-block }
        .sig-img { display:block; background:#0f0f0f; border-radius:4px }
        .footer { margin-top:30px; font-size:11px; color:#999; text-align:center }
        @media print { button{display:none} }
      </style></head><body>
      <button onclick="window.print()" style="margin-bottom:20px;padding:8px 20px;cursor:pointer;font-size:13px;background:#d4ff4e;border:none;border-radius:4px;font-weight:600">🖨 Print / Save PDF</button>
      <h1>IT Asset Checkout Agreement</h1>
      <div class="meta">Generated: ${today} · Asset Tracker — NHN Global IT</div>

      <h2>Asset details</h2>
      <table>
        <tr><td>Asset tag</td><td>${asset?.asset_tag||'—'}</td></tr>
        <tr><td>Model</td><td>${asset?.model||asset?.name||'—'}</td></tr>
        <tr><td>Category</td><td>${asset?.category||'—'}</td></tr>
        <tr><td>Serial number</td><td>${asset?.serial_number||'—'}</td></tr>
        <tr><td>Assigned to</td><td>${employee||'—'}</td></tr>
        <tr><td>Checkout date</td><td>${today}</td></tr>
      </table>

      <h2>Terms & conditions</h2>
      <div class="terms">
        By signing below, I acknowledge and agree to the following:<br/><br/>
        1. I have received the asset described above in good working condition.<br/>
        2. I am responsible for the safekeeping and proper use of this asset.<br/>
        3. I will not install unauthorized software or make unauthorized modifications.<br/>
        4. I will report any loss, theft, or damage to the IT department immediately.<br/>
        5. I will return this asset promptly upon request or upon leaving the organization.<br/>
        6. I understand that misuse of company assets may result in disciplinary action.<br/>
        7. I will comply with all company IT policies regarding the use of this asset.
      </div>

      <h2>Signature</h2>
      <p style="margin-bottom:8px"><strong>Employee name:</strong> ${employee||'—'}</p>
      <div class="sig-box">
        <img src="${sigDataUrl}" class="sig-img" width="320" height="100" />
      </div>
      <p style="margin-top:8px; font-size:11px; color:#666">Digitally signed on ${today}</p>

      <div class="footer">This document is a legally binding agreement between the employee and NHN Global IT Department.</div>
      </body></html>
    `)
    win.document.close()
    // Trigger print
    setTimeout(() => win.print(), 500)
  }

  async function handleSign() {
    generatePDF()
    onSign?.()
    onClose?.()
  }

  return (
    <Modal open={open} onClose={onClose} title="Checkout agreement" width={520}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Asset info */}
        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:13 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px' }}>
            {[['Asset tag', asset?.asset_tag], ['Model', asset?.model||asset?.name||'—'], ['Category', asset?.category], ['Assigned to', employee]].map(([l,v])=>(
              <div key={l}><span style={{ color:'var(--text2)' }}>{l}: </span><strong>{v||'—'}</strong></div>
            ))}
          </div>
        </div>

        {/* Terms */}
        <div style={{ background:'var(--bg3)', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:12, color:'var(--text2)', lineHeight:1.7, maxHeight:120, overflowY:'auto' }}>
          By signing, I confirm receipt of this asset in good condition. I agree to use it responsibly, report any loss or damage immediately, and return it upon request. I understand that misuse may result in disciplinary action.
        </div>

        {/* Signature pad */}
        <div>
          <div style={{ fontSize:12, fontWeight:500, marginBottom:6, color:'var(--text2)' }}>Signature <span style={{ color:'var(--red)' }}>*</span></div>
          <div style={{ background:'#0f0f0f', border:'2px solid var(--border2)', borderRadius:'var(--radius)', overflow:'hidden', cursor:'crosshair', touchAction:'none' }}>
            <canvas ref={canvasRef} width={470} height={110}
              style={{ display:'block', width:'100%', height:110 }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
            />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
            <div style={{ fontSize:11, color:'var(--text3)' }}>Draw your signature above</div>
            {hasSignature && <button onClick={clearSig} style={{ fontSize:11, color:'var(--text3)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)' }}>Clear</button>}
          </div>
        </div>

        {/* Agree checkbox */}
        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
          <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ width:'auto', accentColor:'var(--accent)' }} />
          I agree to the terms and conditions above
        </label>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--border)' }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSign} disabled={!hasSignature || !agreed}>
            ✓ Sign & complete checkout
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
