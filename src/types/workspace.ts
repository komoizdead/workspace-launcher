export type ActionType = 'app' | 'url' | 'command' | 'folder'

export type LaunchMode = 'sequential' | 'parallel'

export interface WorkspaceAction {
  id: string
  type: ActionType
  /** Human-friendly label shown in the UI */
  label: string
  /**
   * app    -> absolute path to binary / .app bundle / desktop entry name
   * url    -> https://... URL
   * command-> shell command to execute
   * folder -> absolute path to a directory
   */
  target: string
  /** Optional environment variables injected for command actions */
  env?: Record<string, string>
  /** Milliseconds to wait AFTER this action before the next one runs */
  delayAfterMs?: number
  /** When true, the launcher skips this if the process/port is already running */
  skipIfRunning?: boolean
  enabled: boolean
}

export interface WorkspaceProfile {
  id: string
  name: string
  description?: string
  icon?: string
  color?: string
  mode: LaunchMode
  actions: WorkspaceAction[]
  /** Global shortcut accelerator, e.g. "Control+Alt+1" / "CommandOrControl+Alt+1" */
  hotkey?: string
  createdAt: number
  updatedAt: number
}

export type LogStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'

export interface LaunchLogEntry {
  id: string
  profileId: string
  actionId: string
  label: string
  type: ActionType
  status: LogStatus
  message?: string
  timestamp: number
}

export interface LaunchResult {
  profileId: string
  startedAt: number
  finishedAt: number
  entries: LaunchLogEntry[]
}

export interface AppSettings {
  minimizeToTrayOnClose: boolean
  launchOnBoot: boolean
}

/** API surface exposed by electron/preload.ts via contextBridge */
export interface LauncherApi {
  platform: NodeJS.Platform
  getProfiles: () => Promise<WorkspaceProfile[]>
  saveProfile: (profile: WorkspaceProfile) => Promise<WorkspaceProfile[]>
  deleteProfile: (id: string) => Promise<WorkspaceProfile[]>
  duplicateProfile: (id: string) => Promise<WorkspaceProfile[]>
  launchProfile: (id: string) => Promise<LaunchResult>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<AppSettings>
  pickFile: (kind: 'app' | 'folder') => Promise<string | null>
  onLaunchLog: (cb: (entry: LaunchLogEntry) => void) => () => void
  minimizeToTray: () => void
}

declare global {
  interface Window {
    launcher: LauncherApi
  }
}
