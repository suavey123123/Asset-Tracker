import { Btn } from './UI'

export default function PrintSheet({ assets }) {
  function print() {
    if (!assets?.length) return

    const rows = assets.map(a => [
      a.asset_tag || '',
      a.model || '—',
      a.category || '—',
      a.serial_number || '—',
      a.assigned_to || a.assigned_to_team || '—',
      a.location || '—',
      a.status || '—',
    ].map(v => '<td>' + String(v).replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</td>').join(''))

    const tableRows = rows.map((r, i) =>
      '<tr style="background:' + (i % 2 === 0 ? '#ffffff' : '#f9f9f9') + '">' + r + '<td style="border:1px solid #ccc;width:80px;">&nbsp;</td></tr>'
    ).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Asset Audit Sheet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px }
    .header { margin-bottom: 16px }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px }
    .meta { color: #666; font-size: 11px }
    table { width: 100%; border-collapse: collapse; margin-top: 12px }
    th { background: #eeeeee; border: 1px solid #ccc; padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600 }
    td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: middle; font-size: 11px }
    .footer { margin-top: 14px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 8px }
    .print-btn { margin-bottom: 16px; padding: 8px 20px; font-size: 13px; cursor: pointer; background: #d4ff4e; border: none; border-radius: 4px; font-weight: 600 }
    @media print { .print-btn { display: none } body { padding: 8px } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Print</button>
  <div class="header">
    <h1>Asset Audit Sheet</h1>
    <div class="meta">Generated ${new Date().toLocaleString()} &nbsp;·&nbsp; ${assets.length} asset${assets.length !== 1 ? 's' : ''}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Asset Tag</th>
        <th>Model</th>
        <th>Category</th>
        <th>Serial Number</th>
        <th>Assigned To</th>
        <th>Site</th>
        <th>Status</th>
        <th>Verified ✓</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">NHN Global IT &nbsp;·&nbsp; Asset Tracker &nbsp;·&nbsp; Printed ${new Date().toLocaleDateString()}</div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (win) {
      win.addEventListener('load', () => {
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      })
    } else {
      URL.revokeObjectURL(url)
      alert('Please allow popups for this site to print the audit sheet.')
    }
  }

  return (
    <Btn size="sm" onClick={print} disabled={!assets?.length} title="Print audit sheet for selected assets">
      🖨 Print sheet
    </Btn>
  )
}
