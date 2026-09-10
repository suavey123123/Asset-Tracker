// ── Categories & Statuses ────────────────────────────────────────────
export const IT_CATEGORIES = [
  'AIR CONDITIONER',
  'AIR PURIFIER',
  'AR HEADSET',
  'CAMERA',
  'DESKTOP',
  'EV CHARGER',
  'FAN',
  'HAND DRYER',
  'HOTSPOT DEVICE',
  'KEYBOARD',
  'LAPTOP',
  'LENS',
  'LIGHTING',
  'MICROPHONE',
  'MONITOR',
  'MOUSE',
  'PHONE',
  'PORTABLE STORAGE',
  'PRINTER',
  'PROJECTOR',
  'RECORDER',
  'REFRIGERATOR',
  'ROUTER',
  'SCANNER',
  'SHREDDER',
  'SPEAKERS',
  'STREAMING DEVICE',
  'TABLET',
  'TRASHCAN',
  'TV',
  'USB HUB',
  'VC',
  'WEBCAM',
]

export const TOOL_CATEGORIES = ['Tools & Equipment']
export const ALL_CATEGORIES = [...IT_CATEGORIES, ...TOOL_CATEGORIES]

export const STATUSES = [
  'Available',
  'Checked Out',
  'Maintenance',
  'Ordered',
  'Received',
  'Retired',
]

// ── Spec fields for tech categories ──────────────────────────────────
export const SPEC_FIELDS = {
  default: [],
  tech: [
    { key: 'CPU',        placeholder: 'e.g. Intel Core i7-13700H' },
    { key: 'GPU',        placeholder: 'e.g. NVIDIA RTX 4060' },
    { key: 'RAM',        placeholder: 'e.g. 16GB DDR5' },
    { key: 'SSD',        placeholder: 'e.g. 512GB NVMe' },
    { key: 'HDD',        placeholder: 'e.g. 1TB HDD' },
    { key: 'MAC ADDRESS (WIFI)', placeholder: 'e.g. 00:1A:2B:3C:4D:5E' },
    { key: 'MAC ADDRESS (LAN)',  placeholder: 'e.g. 00:1A:2B:3C:4D:5F' },
    { key: 'OS VERSION', placeholder: 'e.g. Windows 11 Pro 23H2' },
    { key: 'RESOLUTION', placeholder: 'e.g. 2560x1440 QHD, 3840x2160 4K' },
    { key: 'SIZE', placeholder: 'e.g. 27", 32", 55"' },
  ],
}

export const TECH_SPEC_CATEGORIES = [
  'LAPTOP', 'DESKTOP', 'TABLET', 'PHONE', 'AR HEADSET',
  'HOTSPOT DEVICE', 'ROUTER', 'STREAMING DEVICE', 'VC', 'MONITOR', 'TV', 'PROJECTOR',
]

// ── Storage key prefixes ─────────────────────────────────────────────
// All app localStorage/sessionStorage keys live here to avoid duplication.
export const STORAGE_KEYS = {
  // Inventory
  inv_search: 'inv_search',
  inv_status: 'inv_status',
  inv_cat: 'inv_cat',
  inv_site: 'inv_site',
  inv_assigned: 'inv_assigned',
  inv_models: 'inv_models',
  inv_page: 'inv_page',
  inv_sort_col: 'inv_sort_col',
  inv_sort_dir: 'inv_sort_dir',
  inventory_filters: 'inventory_filters',
  inventory_cols: 'inventory_cols',
  // Employees
  emp_cols: 'emp_cols',
  // Home / Dashboard
  dashboard_widgets: 'dashboard_widgets_v1',
  emp_lookup: 'home_emp_lookup',
  // Theme
  theme: 'theme',
  // Asset tags
  asset_tags: 'asset_tags',
}

// ── App-wide constants ───────────────────────────────────────────────
export const SEARCH_DEBOUNCE_MS = 300
export const EMPLOYEE_REFRESH_INTERVAL_MS = 300000
export const PAGE_SIZE = 25
export const RESPONSIVE_BREAKPOINT = 768
export const INTERSECTION_ROOT_MARGIN = '100px'
export const PRINT_URL_REVOKE_MS = 10000
export const NOTE_SAVED_REVEAL_MS = 2000
export const ALERT_POLL_MS = 60000
