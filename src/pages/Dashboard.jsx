import { useState, useEffect } from 'react'
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

const TITLES = {
  home:'Dashboard', inventory:'Inventory', checkout:'Check In / Out',
  maintenance:'Maintenance', history:'Activity History', transfer:'Asset Transfer',
  users:'User Management', reports:'Reports', settings:'Settings', scanner:'Scanner',
}

export default function Dashboard() {
  const [tab, setTab] = useState('home')
  const [viewingAsset, setViewingAsset] = useState(null)
  const [editAsset, setEditAsset] = useState(null)
  const [alerts, setAlerts] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isAdmin } = useAuth()

  useEffect(() => { fetchAlerts() }, [])

  async function fetchAlerts() {
    const today = new Date().toISOString().slice(0,10)
    const { data } = await supabase.from('assets').select('id').eq('status','Checked Out').lt('expected_return',today).not('expected_return','is',null)
    setAlerts((data||[]).length)
  }

  function handleViewAsset(asset) { setViewingAsset(asset); setSidebarOpen(false) }
  function handleNav(newTab) { setViewingAsset(null); setTab(newTab); setSidebarOpen(false) }
  function handleEdit(asset) { setViewingAsset(null); setEditAsset(asset); setTab('inventory') }

  const title = viewingAsset ? viewingAsset.name : TITLES[tab] || 'Asset Tracker'

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
    employees: <Employees />,

  }

  return (
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
          {/* Mobile menu button */}
          <button onClick={()=>setSidebarOpen(s=>!s)} className="mobile-menu-btn" style={{ display:'none', background:'none', border:'none', color:'var(--text)', fontSize:18, cursor:'pointer', padding:'4px', flexShrink:0 }}>☰</button>
          <h1 style={{ fontSize:15, fontWeight:500, letterSpacing:'-0.02em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</h1>
          <GlobalSearch onViewAsset={handleViewAsset} />
        </div>
        <div style={{ padding:'1rem 1rem' }}>
          {viewingAsset ? (
            <AssetDetail assetId={viewingAsset.id} onBack={()=>setViewingAsset(null)} onEdit={handleEdit} />
          ) : PAGE[tab]}
        </div>
      </main>
    </div>
  )
}
