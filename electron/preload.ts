import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  AppSettings,
  LaunchLogEntry,
  LauncherApi,
  LaunchResult,
  WorkspaceProfile,
} from '../src/types/workspace'

const api: LauncherApi = {
  platform: process.platform,

  getProfiles: (): Promise<WorkspaceProfile[]> => ipcRenderer.invoke('profiles:get'),
  saveProfile: (p): Promise<WorkspaceProfile[]> => ipcRenderer.invoke('profiles:save', p),
  deleteProfile: (id): Promise<WorkspaceProfile[]> => ipcRenderer.invoke('profiles:delete', id),
  duplicateProfile: (id): Promise<WorkspaceProfile[]> =>
    ipcRenderer.invoke('profiles:duplicate', id),
  launchProfile: (id): Promise<LaunchResult> => ipcRenderer.invoke('profiles:launch', id),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (s): Promise<AppSettings> => ipcRenderer.invoke('settings:save', s),

  pickFile: (kind): Promise<string | null> => ipcRenderer.invoke('dialog:pick', kind),

  onLaunchLog: (cb) => {
    const listener = (_e: IpcRendererEvent, entry: LaunchLogEntry) => cb(entry)
    ipcRenderer.on('launch:log', listener)
    return () => ipcRenderer.removeListener('launch:log', listener)
  },

  minimizeToTray: () => ipcRenderer.send('window:minimize-to-tray'),
}

contextBridge.exposeInMainWorld('launcher', api)
