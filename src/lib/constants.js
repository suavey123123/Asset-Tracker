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

export const TOOL_CATEGORIES = [
  'Tools & Equipment',
]

export const ALL_CATEGORIES = [...IT_CATEGORIES, ...TOOL_CATEGORIES]

export const STATUSES = [
  'Available',
  'Checked Out',
  'Maintenance',
  'Ordered',
  'Received',
  'Retired',
]

// Spec fields that appear when adding/editing assets by category
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
  ],
}

// Which categories get tech spec fields
export const TECH_SPEC_CATEGORIES = [
  'LAPTOP', 'DESKTOP', 'TABLET', 'PHONE', 'AR HEADSET',
  'HOTSPOT DEVICE', 'ROUTER', 'STREAMING DEVICE', 'VC', 'MONITOR', 'TV', 'PROJECTOR',
]
