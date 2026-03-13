import { EXTENSION_MENUS, PERM_MENUS, NEW_EXTENSION_MENUS, NEW_PERM_MENUS } from './constants.js'

export function isPermMenu(menuType) {
  return PERM_MENUS.includes(menuType) || (NEW_PERM_MENUS && NEW_PERM_MENUS.includes(menuType))
}

export function isExtensionMenu(menuType) {
  return EXTENSION_MENUS.includes(menuType) || (NEW_EXTENSION_MENUS && NEW_EXTENSION_MENUS.includes(menuType))
}

export function getTodayString() {
  const d = new Date()
  const yyyy = String(d.getFullYear())
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

