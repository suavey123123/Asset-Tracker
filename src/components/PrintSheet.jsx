import { Btn } from './UI'

export default function PrintSheet({ assets }) {
  function print() {
    if (!assets?.length) return

    const rows = assets.map((a, i) => {
      const tag = a.asset_tag || ''
      const cells = [
        `<td style="padding:8px;border:1px solid #ddd;font-family:monospace;font-size:11px;font-weight:700">${tag}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;font-size:11px">${a.model || ''}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;font-size:11px">${a.category || ''}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;font-size:11px;font-family:monospace">${a.serial_number || ''}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;font-size:11px">${a.assigned_to || a.assigned_to_team || ''}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;font-size:11px">${a.location || ''}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;font-size:11px">${a.status || ''}</td>`,
        `<td style="padding:8px;border:1px solid #ddd;width:80px">&nbsp;</td>`,
      ].join('')
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'}">${cells}</tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Asset Audit Sheet</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px }
  .meta { color: #666; font-size: 11px; margin-bottom: 16px }
  table { width: 100%; border-collapse: collapse }
  th { background: #eee; border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em }
  .footer { margin-top: 14px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 8px }
  .print-btn { margin-bottom: 16px; padding: 8px 20px; font-size: 13px; cursor: pointer; background: #d4ff4e; border: none; border-radius: 4px; font-weight: 600 }
  @media print { .print-btn { display: none } body { padding: 8px } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print</button>
<h1>Asset Audit Sheet</h1>
<div class="meta">Generated ${new Date().toLocaleString()} &bull; ${assets.length} asset${assets.length !== 1 ? 's' : ''}</div>
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
      <th style="width:80px">Verified</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">NHN Global IT &bull; Asset Tracker &bull; Printed ${new Date().toLocaleDateString()}</div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) alert('Please allow popups for this site to print.')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return (
    <Btn size="sm" onClick={print} disabled={!assets?.length} title="Print audit sheet">
      🖨 Print sheet
    </Btn>
  )
}
