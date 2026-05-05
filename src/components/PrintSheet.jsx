import { Btn } from './UI'

export default function PrintSheet({ assets, onClose }) {
  function print() {
    const rows = assets.map(a => `
      <tr>
        <td>${a.asset_tag || ''}</td>
        <td>${a.model || '—'}</td>
        <td>${a.category || '—'}</td>
        <td>${a.serial_number || '—'}</td>
        <td>${a.assigned_to || a.assigned_to_team || '—'}</td>
        <td>${a.location || '—'}</td>
        <td>${a.status || '—'}</td>
        <td style="width:80px;border:1px solid #ccc;">&nbsp;</td>
      </tr>`).join('')

    const win = window.open('', '_blank', 'noopener,noreferrer')
    win.document.write(`
      <html><head><title>Asset Audit Sheet</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 20px }
        h1 { font-size: 16px; margin-bottom: 4px }
        .meta { color: #666; font-size: 11px; margin-bottom: 16px }
        table { width: 100%; border-collapse: collapse }
        th { background: #f0f0f0; border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em }
        td { border: 1px solid #ddd; padding: 5px 8px; vertical-align: middle }
        tr:nth-child(even) td { background: #fafafa }
        .footer { margin-top: 16px; font-size: 10px; color: #999 }
        @media print { button { display: none } body { margin: 10px } }
      </style></head>
      <body>
      <button onclick="window.print()" style="margin-bottom:16px;padding:8px 20px;font-size:13px;cursor:pointer;background:#d4ff4e;border:none;border-radius:4px;font-weight:600">🖨 Print</button>
      <h1>Asset Audit Sheet</h1>
      <div class="meta">Generated ${new Date().toLocaleString()} · ${assets.length} assets</div>
      <table>
        <thead><tr>
          <th>Asset Tag</th><th>Model</th><th>Category</th><th>Serial #</th>
          <th>Assigned To</th><th>Site</th><th>Status</th><th>Verified ✓</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">NHN Global IT · Asset Tracker · Printed ${new Date().toLocaleDateString()}</div>
      </body></html>
    `)
    win.document.close()
  }

  return <Btn size="sm" onClick={print} disabled={!assets.length} title="Print audit sheet for selected assets">🖨 Print sheet</Btn>
}
