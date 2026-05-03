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

const TITLES = {
  home:'Dashboard', inventory:'Inventory', checkout:'Check In / Out',
  maintenance:'Maintenance', history:'Activity History',
  users:'User Management', reports:'Reports', settings:'Settings',
}

export default function Dashboard() {
  const [tab, setTab] = useState('home')
  const [viewingAsset, setViewingAsset] = useState(null)
  const [editAsset, setEditAsset] = useState(null)
  const [alerts, setAlerts] = useState(0)
  const { isAdmin } = useAuth()

  useEffect(() => { fetchAlerts() }, [])

  async function fetchAlerts() {
    const today = new Date().toISOString().slice(0,10)
    const { data } = await supabase.from('assets').select('id').eq('status','Checked Out').lt('expected_return',today).not('expected_return','is',null)
    setAlerts((data||[]).length)
  }

  function handleViewAsset(asset) { setViewingAsset(asset) }
  function handleNav(newTab) { setViewingAsset(null); setTab(newTab) }
  function handleEdit(asset) { setViewingAsset(null); setEditAsset(asset); setTab('inventory') }

  const title = viewingAsset ? viewingAsset.name : TITLES[tab] || 'Asset Tracker'

  const PAGE = {
    home: <Home onNav={handleNav} onViewAsset={handleViewAsset} />,
    inventory: <Inventory onViewAsset={handleViewAsset} editAssetProp={editAsset} onEditDone={()=>setEditAsset(null)} />,
    checkout: <Checkout onViewAsset={handleViewAsset} />,
    maintenance: <Maintenance />,
    history: <History onViewAsset={handleViewAsset} />,
    users: isAdmin ? <Users /> : null,
    reports: <Reports />,
    settings: <Settings />,
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar active={tab} onNav={handleNav} alerts={alerts} />
      <main style={{ flex:1, overflow:'auto', background:'var(--bg)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0.75rem 1.5rem', borderBottom:'1px solid var(--border)', background:'var(--bg)', position:'sticky', top:0, zIndex:10 }}>
          <h1 style={{ fontSize:16, fontWeight:500, letterSpacing:'-0.02em', whiteSpace:'nowrap' }}>{title}</h1>
          <GlobalSearch onViewAsset={handleViewAsset} />
        </div>
        <div style={{ padding:'1.25rem 1.5rem' }}>
          {viewingAsset ? (
            <AssetDetail assetId={viewingAsset.id} onBack={()=>setViewingAsset(null)} onEdit={handleEdit} />
          ) : PAGE[tab]}
        </div>
      </main>
    </div>
  )
}
