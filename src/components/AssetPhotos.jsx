import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Spinner } from './UI'

export default function AssetPhotos({ assetId, assetTag }) {
  const { isAdmin } = useAuth()
  const [fetchError, setFetchError] = useState('')
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => { fetchPhotos() }, [assetId])

  async function fetchPhotos() {
    setLoading(true)
    const { data } = await supabase.storage.from('asset-photos').list(`${assetId}/`)
    if (data) {
      const urls = data.map(f => ({
        name: f.name,
        url: supabase.storage.from('asset-photos').getPublicUrl(`${assetId}/${f.name}`).data.publicUrl
      }))
      setPhotos(urls)
    }
    setLoading(false)
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const name = `${Date.now()}.${ext}`
      await supabase.storage.from('asset-photos').upload(`${assetId}/${name}`, file)
    }
    setUploading(false)
    fetchPhotos()
    e.target.value = ''
  }

  async function deletePhoto(name) {
    if (!confirm('Delete this photo?')) return
    await supabase.storage.from('asset-photos').remove([`${assetId}/${name}`])
    fetchPhotos()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>Photos ({photos.length})</div>
        {isAdmin && (
          <>
            <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
            <Btn size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : '+ Add photos'}
            </Btn>
          </>
        )}
      </div>

      {loading ? <Spinner size={16} /> : photos.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '1rem 0' }}>No photos yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {photos.map(p => (
            <div key={p.name} style={{ position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden', aspectRatio: '1', border: '1px solid var(--border)' }}>
              <img
                src={p.url} alt="asset"
                onClick={() => setLightbox(p.url)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
              />
              {isAdmin && (
                <button
                  onClick={() => deletePhoto(p.name)}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '2rem' }}>
          <img src={lightbox} alt="asset" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 'var(--radius)' }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'fixed', top: 16, right: 16, color: '#fff', fontSize: 24, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  )
}
