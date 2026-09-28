import { create } from 'zustand'
import type {
  AppSettings,
  LaunchLogEntry,
  WorkspaceProfile,
} from '../types/workspace'

interface LauncherState {
  profiles: WorkspaceProfile[]
  selectedId: string | null
  editing: WorkspaceProfile | null
  logs: LaunchLogEntry[]
  settings: AppSettings
  launchingIds: string[]
  sidebarOpen: boolean

  init: () => Promise<void>
  select: (id: string | null) => void
  startEdit: (profile: WorkspaceProfile | null) => void
  saveProfile: (p: WorkspaceProfile) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  duplicateProfile: (id: string) => Promise<void>
  launch: (id: string) => Promise<void>
  appendLog: (entry: LaunchLogEntry) => void
  clearLogs: () => void
  toggleSidebar: () => void
}

export const useStore = create<LauncherState>((set, get) => ({
  profiles: [],
  selectedId: null,
  editing: null,
  logs: [],
  settings: { minimizeToTrayOnClose: true, launchOnBoot: false },
  launchingIds: [],
  sidebarOpen: true,

  init: async () => {
    const [profiles, settings] = await Promise.all([
      window.launcher.getProfiles(),
      window.launcher.getSettings(),
    ])
    set({ profiles, settings })
    const off = window.launcher.onLaunchLog((entry) => get().appendLog(entry))
    // keep listener alive for app lifetime; cleanup on window unload
    window.addEventListener('beforeunload', off)
  },

  select: (id) => set({ selectedId: id }),
  startEdit: (profile) => set({ editing: profile }),

  saveProfile: async (p) => {
    const profiles = await window.launcher.saveProfile(p)
    set({ profiles, editing: null })
  },

  deleteProfile: async (id) => {
    const profiles = await window.launcher.deleteProfile(id)
    set((s) => ({
      profiles,
      selectedId: s.selectedId === id ? null : s.selectedId,
      editing: s.editing?.id === id ? null : s.editing,
    }))
  },

  duplicateProfile: async (id) => {
    const profiles = await window.launcher.duplicateProfile(id)
    set({ profiles })
  },

  launch: async (id) => {
    if (get().launchingIds.includes(id)) return
    set((s) => ({ launchingIds: [...s.launchingIds, id] }))
    try {
      await window.launcher.launchProfile(id)
    } finally {
      set((s) => ({ launchingIds: s.launchingIds.filter((x) => x !== id) }))
    }
  },

  appendLog: (entry) =>
    set((s) => {
      const next = [entry, ...s.logs].slice(0, 300)
      return { logs: next }
    }),

  clearLogs: () => set({ logs: [] }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
