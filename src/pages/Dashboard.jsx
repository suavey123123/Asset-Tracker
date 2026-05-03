import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import Inventory from '../components/Inventory'
import Checkout from '../components/Checkout'
import Maintenance from '../components/Maintenance'
import History from '../components/History'
import Users from '../components/Users'
import { useAuth } from '../lib/AuthContext'

const TITLES = {
  inventory: 'Inventory',
  checkout: 'Check In / Out',
  maintenance: 'Maintenance',
  history: 'Activity History',
  users: 'User Management',
}

export default function Dashboard() {
  const [tab, setTab] = useState('inventory')
  const { isAdmin } = useAuth()

  const PAGE = {
    inventory: <Inventory />,
    checkout: <Checkout />,
    maintenance: <Maintenance />,
    history: <History />,
    users: isAdmin ? <Users /> : null,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar active={tab} onNav={setTab} />
      <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem', background: 'var(--bg)' }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>{TITLES[tab]}</h1>
        {PAGE[tab]}
      </main>
    </div>
  )
}
