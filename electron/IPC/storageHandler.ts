import Store from 'electron-store'
import { globalShortcut, BrowserWindow, dialog, ipcMain, Tray } from 'electron'
import type {
  AppSettings,
  WorkspaceProfile,
} from '../../src/types/workspace'
import { executeProfile, PICK_FILTERS } from './systemLauncher'

interface StoreSchema {
  profiles: WorkspaceProfile[]
  settings: AppSettings
  history: unknown[]
}

const defaults: StoreSchema = {
  profiles: [],
  settings: { minimizeToTrayOnClose: true, launchOnBoot: false },
  history: [],
}

export const store = new Store<StoreSchema>({ defaults })

/* ------------------------------- CRUD ----------------------------------- */

export function getProfiles(): WorkspaceProfile[] {
  return store.get('profiles')
}

function persist(profiles: WorkspaceProfile[]): WorkspaceProfile[] {
  store.set('profiles', profiles)
  refreshHotkeys(profiles)
  refreshTray()
  return profiles
}

export function saveProfile(profile: WorkspaceProfile): WorkspaceProfile[] {
  const profiles = getProfiles()
  const idx = profiles.findIndex((p) => p.id === profile.id)
  const next = { ...profile, updatedAt: Date.now() }
  if (idx >= 0) profiles[idx] = next
  else profiles.push(next)
  return persist(profiles)
}

export function deleteProfile(id: string): WorkspaceProfile[] {
  return persist(getProfiles().filter((p) => p.id !== id))
}

export function duplicateProfile(id: string): WorkspaceProfile[] {
  const profiles = getProfiles()
  const src = profiles.find((p) => p.id === id)
  if (!src) return profiles
  const copy: WorkspaceProfile = {
    ...src,
    id: crypto.randomUUID(),
    name: `${src.name} (copy)`,
    actions: src.actions.map((a) => ({ ...a, id: crypto.randomUUID() })),
    hotkey: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  return persist([...profiles, copy])
}

export function getProfileById(id: string): WorkspaceProfile | undefined {
  return getProfiles().find((p) => p.id === id)
}

export function getSettings(): AppSettings {
  return store.get('settings')
}

export function saveSettings(settings: AppSettings): AppSettings {
  store.set('settings', settings)
  return settings
}

/* ---------------------------- Hotkey manager ----------------------------- */

let registeredHotkeys: Record<string, string> = {} // accelerator -> profileId

function refreshHotkeys(profiles: WorkspaceProfile[]): void {
  for (const acc of Object.keys(registeredHotkeys)) {
    globalShortcut.unregister(acc)
  }
  registeredHotkeys = {}
  for (const p of profiles) {
    if (!p.hotkey) continue
    try {
      const ok = globalShortcut.register(p.hotkey, () => {
        const profile = getProfileById(p.id)
        if (profile) void launchProfile(profile.id)
      })
      if (ok) registeredHotkeys[p.hotkey] = p.id
      else console.warn(`[hotkeys] failed to register "${p.hotkey}"`)
    } catch (err) {
      console.warn(`[hotkeys] invalid accelerator "${p.hotkey}":`, err)
    }
  }
}

export function refreshHotkeysFromStore(): void {
  refreshHotkeys(getProfiles())
}

/* ------------------------------- Tray ----------------------------------- */

let trayRef: Tray | null = null
let rebuildTrayMenu: (() => void) | null = null

export function bindTray(tray: Tray, rebuild: () => void): void {
  trayRef = tray
  rebuildTrayMenu = rebuild
}

function refreshTray(): void {
  if (trayRef && rebuildTrayMenu) rebuildTrayMenu()
}

/* --------------------------- Launch helper ------------------------------- */

export async function launchProfile(profileId: string) {
  const profile = getProfileById(profileId)
  if (!profile) throw new Error(`Profile ${profileId} not found`)
  const emit = (entry: Parameters<Parameters<typeof executeProfile>[1]>[0]) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('launch:log', entry)
    }
  }
  return executeProfile(profile, emit)
}

/* --------------------------- IPC registration ---------------------------- */

export function registerIpcHandlers(): void {
  ipcMain.handle('profiles:get', () => getProfiles())
  ipcMain.handle('profiles:save', (_e, p: WorkspaceProfile) => saveProfile(p))
  ipcMain.handle('profiles:delete', (_e, id: string) => deleteProfile(id))
  ipcMain.handle('profiles:duplicate', (_e, id: string) => duplicateProfile(id))
  ipcMain.handle('profiles:launch', (_e, id: string) => launchProfile(id))
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_e, s: AppSettings) => saveSettings(s))
  ipcMain.handle('dialog:pick', async (_e, kind: 'app' | 'folder') => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win) return null
    const opts =
      kind === 'app'
        ? { properties: ['openFile' as const], filters: PICK_FILTERS.app }
        : { properties: ['openDirectory' as const] }
    const res = await dialog.showOpenDialog(win, opts)
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })
}
