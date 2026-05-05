import { useState, useEffect, createContext, useContext, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'error', duration = 4000) => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{ position:'fixed', bottom:24, right:24, zIndex:99999, display:'flex', flexDirection:'column', gap:8, maxWidth:380 }}>
        {toasts.map(t => (
          <div key={t.id} className="fade-in" style={{
            padding:'12px 16px', borderRadius:'var(--radius)', fontSize:13, fontWeight:500,
            background: t.type==='success'?'var(--green-bg)': t.type==='warn'?'rgba(251,191,36,0.15)':'var(--red-bg)',
            border:`1px solid ${t.type==='success'?'var(--green)':t.type==='warn'?'var(--amber)':'var(--red)'}`,
            color: t.type==='success'?'var(--green)':t.type==='warn'?'var(--amber)':'var(--red)',
            boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
            display:'flex', alignItems:'center', gap:10,
          }}>
            <span>{t.type==='success'?'✓':t.type==='warn'?'⚠':'✕'}</span>
            <span style={{ flex:1 }}>{t.message}</span>
            <button onClick={()=>setToasts(t2=>t2.filter(x=>x.id!==t.id))} style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', fontSize:16, lineHeight:1, opacity:0.6 }}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
