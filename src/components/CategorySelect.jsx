import { IT_CATEGORIES } from '../lib/constants'

const TOOL_CATS = ['Tools & Equipment']
const ALL = [...IT_CATEGORIES, ...TOOL_CATS]

export default function CategorySelect({ value, onChange, style = {} }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={style}>
      <optgroup label="IT Equipment">
        {IT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </optgroup>
      <optgroup label="Other">
        {TOOL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
      </optgroup>
    </select>
  )
}

export { ALL as ALL_CATEGORIES, IT_CATEGORIES }
