import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Sidebar from '../components/Sidebar'
import GlobalSearch from '../components/GlobalSearch'
import Home from '../components/Home'
import Inventory from '../components/Inventory'
import Checkout from '../components/Checkout'
import Maintenance from '../components/Maintenance'
import History from '../components/History'
import Users from '../components/Users'
import AssetDetail from '../components/AssetDetail'
import Reports from '../components/Reports'
import Settings from '../components/Settings'
import Transfer from '../components/Transfer'
import Scanner from '../components/Scanner'
import Lifecycle from '../components/Lifecycle'
import Employees from '../components/Employees'
import Offboarding from '../components/Offboarding'
import AssetRequests from '../components/AssetRequests'
import ScheduledMaintenance from '../components/ScheduledMaintenance'
import NotificationCenter from '../components/NotificationCenter'
import QRLabels from '../components/QRLabels'
import ReportBuilder from '../components/ReportBuilder'
import { ToastProvider } from '../components/Toast'
import Tenants from '../components/Tenants'
import ErrorBoundary from '../components/ErrorBoundary'
import Consumables from '../components/Consumables'
import ValueDashboard from '../components/ValueDashboard'
import Sites from '../components/Sites'
import Licenses from '../components/Licenses'
import Compliance from '../components/Compliance'

const TITLES = {
  home:'Dashboard', inventory:'Inventory', checkout:'Check In / Out',
  maintenance:'Maintenance', history:'Activity History', transfer:'Asset Transfer',
  users:'User Management', reports:'Reports', settings:'Settings', scanner:'Scanner',
}

function ShortcutsButton() {
  const [open, setOpen] = React.useState(false)
  const shortcuts = [
    { key: 'N', desc: 'New asset (when on Inventory)' },
    { key: '/', desc: 'Focus search bar' },
    { key: 'Esc', desc: 'Close modal' },
    { key: 'H', desc: 'Go to Dashboard' },
    { key: 'I', desc: 'Go to Inventory' },
    { key: 'M', desc: 'Go to Maintenance' },
    { key: 'S', desc: 'Go to Scanner' },
  ]
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title="Keyboard shortcuts" style={{
        fontSize: 13, color: open ? 'var(--text)' : 'var(--text3)', cursor: 'pointer',
        padding: '5px 9px', border: '1px solid', borderColor: open ? 'var(--border2)' : 'var(--border)',
        borderRadius: 'var(--radius)', background: open ? 'var(--bg3)' : 'none', fontFamily: 'var(--mono)',
      }}>⌨</button>
      {open && (
        <div className="fade-in" style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 280,
          background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 500, overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>Keyboard shortcuts</div>
          {shortcuts.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
              <kbd style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)', minWidth: 28, textAlign: 'center' }}>{s.key}</kbd>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{s.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [tab, setTab] = useState('home')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [viewingAsset, setViewingAsset] = useState(null)
  const [viewingAssetFromTab, setViewingAssetFromTab] = useState('inventory')
  const [editAsset, setEditAsset] = useState(null)
  const [alerts, setAlerts] = useState(0)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light')

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.style.removeProperty('--bg')
      root.style.removeProperty('--bg2')
      root.style.removeProperty('--bg3')
      root.style.removeProperty('--bg4')
      root.style.removeProperty('--text')
      root.style.removeProperty('--text2')
      root.style.removeProperty('--text3')
      root.style.removeProperty('--border')
      root.style.removeProperty('--border2')
      localStorage.setItem('theme', 'dark')
    } else {
      root.style.setProperty('--bg', '#f5f5f5')
      root.style.setProperty('--bg2', '#ffffff')
      root.style.setProperty('--bg3', '#eeeeee')
      root.style.setProperty('--bg4', '#e0e0e0')
      root.style.setProperty('--text', '#0f0f0f')
      root.style.setProperty('--text2', '#333333')
      root.style.setProperty('--text3', '#666666')
      root.style.setProperty('--border', '#cccccc')
      root.style.setProperty('--border2', '#bbbbbb')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isAdmin, tenant } = useAuth()

  useEffect(() => { fetchAlerts() }, [])

  async function fetchAlerts() {
    const today = new Date().toISOString().slice(0,10)
    const { data } = await supabase.from('assets').select('id').eq('status','Checked Out').lt('expected_return',today).not('expected_return','is',null)
    setAlerts((data||[]).length)
  }

  function handleViewAsset(asset) { setViewingAsset(asset); setViewingAssetFromTab(tab); setSidebarOpen(false) }
  function handleNav(newTab) { setViewingAsset(null); setTab(newTab); setSidebarOpen(false) }
  function handleEdit(asset) { setViewingAsset(null); setEditAsset(asset); setTab('inventory') }

  const title = viewingAsset ? (viewingAsset.model || viewingAsset.asset_tag || viewingAsset.name) : TITLES[tab] || 'Asset Tracker'

  const PAGE = {
    home: <Home onNav={handleNav} onViewAsset={handleViewAsset} />,
    inventory: <Inventory onViewAsset={handleViewAsset} editAssetProp={editAsset} onEditDone={()=>setEditAsset(null)} />,
    checkout: <Checkout onViewAsset={handleViewAsset} />,
    transfer: <Transfer onViewAsset={handleViewAsset} />,
    maintenance: <Maintenance />,
    history: <History onViewAsset={handleViewAsset} />,
    users: isAdmin ? <Users /> : null,
    reports: <Reports />,
    settings: <Settings />,
    scanner: <Scanner onViewAsset={handleViewAsset} />,
    lifecycle: <Lifecycle onViewAsset={handleViewAsset} />,
    employees: <Employees onViewAsset={handleViewAsset} />,
    offboarding: <Offboarding />,
    requests: <AssetRequests />,
    scheduled: <ScheduledMaintenance onViewAsset={handleViewAsset} />,
    sites: <Sites />,
    licenses: <Licenses />,
    compliance: <Compliance />,
    tenants: <Tenants />,
    qrlabels: <QRLabels />,
    reportbuilder: <ReportBuilder />,
    consumables: <Consumables />,
    valuedashboard: <ValueDashboard />,

  }

  return (
    <ToastProvider>
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', position:'relative' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={()=>setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:99, display:'none' }} className="mobile-overlay" />
      )}

      <div style={{ position:'relative' }} className={`sidebar-wrapper${sidebarOpen?' sidebar-open':''}`}>
        <Sidebar active={tab} onNav={handleNav} alerts={alerts} />
      </div>

      <main style={{ flex:1, overflow:'auto', background:'var(--bg)', minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0.75rem 1rem', borderBottom:'1px solid var(--border)', background:'var(--bg)', position:'sticky', top:0, zIndex:10 }}>
          <button onClick={()=>setSidebarOpen(s=>!s)} className="mobile-menu-btn" style={{ display:'none', background:'none', border:'none', color:'var(--text)', fontSize:18, cursor:'pointer', padding:'4px', flexShrink:0 }}>☰</button>
          <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
            <h1 style={{ fontSize:15, fontWeight:500, letterSpacing:'-0.02em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', margin:0 }}>{title}</h1>
            {tenant && (
              <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text3)', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:100, padding:'2px 10px', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background: tenant.accent_color || 'var(--accent)', display:'inline-block' }} />
                {tenant.name}
              </span>
            )}
          </div>
          <GlobalSearch onViewAsset={handleViewAsset} />
          {lastRefreshed && (
            <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>
              ↻ {Math.floor((new Date()-lastRefreshed)/60000) < 1 ? 'just now' : `${Math.floor((new Date()-lastRefreshed)/60000)}m ago`}
            </span>
          )}
          <NotificationCenter onNav={handleNav} onViewAsset={handleViewAsset} />
          <button onClick={()=>setShowShortcuts(s=>!s)} title="Keyboard shortcuts" style={{ fontSize:13, color:'var(--text3)', cursor:'pointer', padding:'4px 8px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontFamily:'var(--mono)', background:'none' }}>⌨</button>

          {showShortcuts && (
            <div onClick={()=>setShowShortcuts(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div onClick={e=>e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-lg)', padding:'1.5rem', minWidth:320, boxShadow:'0 16px 48px rgba(0,0,0,0.5)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
                  <div style={{ fontSize:14, fontWeight:500 }}>Keyboard shortcuts</div>
                  <button onClick={()=>setShowShortcuts(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:18, lineHeight:1 }}>×</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    ['N', 'New asset (on Inventory page)'],
                    ['/', 'Focus search bar'],
                    ['H', 'Go to Dashboard'],
                    ['I', 'Go to Inventory'],
                    ['M', 'Go to Maintenance'],
                    ['Esc', 'Close modal / dialog'],
                  ].map(([key, desc]) => (
                    <div key={key} style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <kbd style={{ background:'var(--bg4)', border:'1px solid var(--border2)', borderRadius:4, padding:'3px 8px', fontSize:12, fontFamily:'var(--mono)', fontWeight:600, minWidth:36, textAlign:'center', color:'var(--text)' }}>{key}</kbd>
                      <span style={{ fontSize:13, color:'var(--text2)' }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:'1rem 1rem' }}>
          {viewingAsset ? (
            <AssetDetail assetId={viewingAsset.id} onBack={()=>{ setViewingAsset(null); setTab(viewingAssetFromTab) }} onEdit={handleEdit} />
          ) : PAGE[tab]}
        </div>
      </main>
    </div>
    </ToastProvider>
  )
}
