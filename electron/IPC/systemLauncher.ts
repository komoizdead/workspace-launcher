import { spawn } from 'child_process'
import net from 'net'
import path from 'path'
import { shell } from 'electron'
import type {
  WorkspaceAction,
  WorkspaceProfile,
  LaunchLogEntry,
  LaunchResult,
  LogStatus,
} from '../../src/types/workspace'

export type LogEmitter = (entry: LaunchLogEntry) => void

const PLATFORM = process.platform

function makeEntry(
  profileId: string,
  action: WorkspaceAction,
  status: LogStatus,
  message?: string,
): LaunchLogEntry {
  return {
    id: crypto.randomUUID(),
    profileId,
    actionId: action.id,
    label: action.label || action.target,
    type: action.type,
    status,
    message,
    timestamp: Date.now(),
  }
}

function runDetached(
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
  onExit?: (code: number | null) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      // On Windows, spawning powershell.exe with detached:true (DETACHED_PROCESS)
      // makes it always report exit code 0, hiding real failures. Do not detach
      // there; windowsHide still prevents console-window flashes. On POSIX,
      // detaching keeps children alive as their own session.
      detached: PLATFORM !== 'win32',
      windowsHide: true,
      stdio: 'ignore',
      env: env ? { ...process.env, ...env } : process.env,
    })
    child.once('error', reject)
    if (onExit) child.once('close', (code) => onExit(code))
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

function runAttached(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    let stderr = ''
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: env ? { ...process.env, ...env } : process.env,
    })
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve('')
      else reject(new Error(stderr.trim() || `Exited with code ${code}`))
    })
  })
}

const windowsQuote = (p: string) => `"${p.replace(/"/g, '\\"')}"`

function openApp(action: WorkspaceAction): Promise<void> {
  const target = action.target.trim()
  if (PLATFORM === 'win32') {
    // start "" "C:\path\to\app.exe" — the empty string is the mandatory window title
    return runDetached('cmd.exe', ['/c', 'start', '""', windowsQuote(target)])
  }
  if (PLATFORM === 'darwin') {
    const looksLikePath = target.endsWith('.app') || target.includes('/')
    const args = looksLikePath ? [target] : ['-a', target]
    return runAttached('open', args).then(() => undefined)
  }
  // Linux: gtk-launch for desktop-entry IDs, xdg-open for direct paths
  const looksLikePath = target.includes('/')
  return looksLikePath
    ? runDetached('xdg-open', [target])
    : runDetached('gtk-launch', [target])
}

function openFolder(action: WorkspaceAction): Promise<void> {
  const target = action.target.trim()
  if (PLATFORM === 'win32') return runDetached('explorer.exe', [target])
  if (PLATFORM === 'darwin') return runAttached('open', [target]).then(() => undefined)
  return runDetached('xdg-open', [target])
}

function runCommand(
  action: WorkspaceAction,
  onLateError: (message: string) => void,
): Promise<void> {
  const command = action.target
  const env = action.env
  const checkExit = (code: number | null) => {
    if (code !== null && code !== 0) onLateError(`Process exited with code ${code}`)
  }
  if (PLATFORM === 'win32') {
    return runDetached(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      env,
      checkExit,
    )
  }
  const shellBin = process.env.SHELL || '/bin/bash'
  return runDetached(shellBin, ['-c', command], env, checkExit)
}

async function openUrl(action: WorkspaceAction): Promise<void> {
  await shell.openExternal(action.target.trim())
}

/** True when a process matching `nameOrPath` is already running. */
export async function isAppRunning(nameOrPath: string): Promise<boolean> {
  const base = path.basename(nameOrPath.trim())
  try {
    if (PLATFORM === 'win32') {
      const out = await runAttached('tasklist', [
        '/FI',
        `IMAGENAME eq ${base}`,
        '/FO',
        'CSV',
        '/NH',
      ])
      return out.toLowerCase().includes(base.toLowerCase())
    }
    const args = PLATFORM === 'darwin' ? ['-x', base] : ['-f', base]
    await runAttached('pgrep', args)
    return true
  } catch {
    return false
  }
}

/** True when something is already listening on localhost:port. */
export function isPortInUse(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket()
    const done = (inUse: boolean) => {
      sock.destroy()
      resolve(inUse)
    }
    sock.setTimeout(800)
    sock.once('connect', () => done(true))
    sock.once('timeout', () => done(false))
    sock.once('error', () => done(false))
    sock.connect(port, host)
  })
}

async function healthCheck(action: WorkspaceAction): Promise<boolean> {
  if (action.type === 'app') return isAppRunning(action.target)
  if (action.type === 'url') {
    try {
      const u = new URL(action.target)
      const isLocal = ['localhost', '127.0.0.1', '::1'].includes(u.hostname)
      if (isLocal && u.port) return await isPortInUse(Number(u.port))
    } catch {
      /* not a checkable URL — proceed */
    }
    return false
  }
  if (action.type === 'command') {
    // heuristic: `npm run dev` style commands — if the folder's dev server port
    // is declared in env we check it; otherwise always run.
    const port = action.env?.PORT
    if (port) return await isPortInUse(Number(port))
    return false
  }
  return false // folders: explorer/finder handles focus gracefully
}

async function executeAction(
  action: WorkspaceAction,
  onLateError: (message: string) => void,
): Promise<void> {
  switch (action.type) {
    case 'app':
      return openApp(action)
    case 'url':
      return openUrl(action)
    case 'command':
      return runCommand(action, onLateError)
    case 'folder':
      return openFolder(action)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function runOne(
  profile: WorkspaceProfile,
  action: WorkspaceAction,
  emit: LogEmitter,
): Promise<LaunchLogEntry> {
  if (!action.enabled) {
    const skipped = makeEntry(profile.id, action, 'skipped', 'Action disabled')
    emit(skipped)
    return skipped
  }

  if (action.skipIfRunning && (await healthCheck(action))) {
    const skipped = makeEntry(profile.id, action, 'skipped', 'Already running — skipped')
    emit(skipped)
    return skipped
  }

  const running = makeEntry(profile.id, action, 'running')
  emit(running)
  try {
    await executeAction(action, (msg) => emit(makeEntry(profile.id, action, 'error', msg)))
    const ok = makeEntry(profile.id, action, 'success')
    emit(ok)
    return ok
  } catch (err) {
    const failed = makeEntry(
      profile.id,
      action,
      'error',
      err instanceof Error ? err.message : String(err),
    )
    emit(failed)
    return failed
  } finally {
    if (action.delayAfterMs && action.delayAfterMs > 0) {
      await sleep(action.delayAfterMs)
    }
  }
}

/**
 * Executes every action of a profile. Individual failures are captured into
 * log entries — this function never rejects, so the main process stays alive.
 */
export async function executeProfile(
  profile: WorkspaceProfile,
  emit: LogEmitter,
): Promise<LaunchResult> {
  const startedAt = Date.now()
  const actions = profile.actions

  const entries =
    profile.mode === 'parallel'
      ? await Promise.all(actions.map((a) => runOne(profile, a, emit)))
      : await (async () => {
          const out: LaunchLogEntry[] = []
          for (const a of actions) out.push(await runOne(profile, a, emit))
          return out
        })()

  return { profileId: profile.id, startedAt, finishedAt: Date.now(), entries }
}

/** File-picker filters used by the preload bridge. */
export const PICK_FILTERS = {
  app:
    PLATFORM === 'win32'
      ? [{ name: 'Executables', extensions: ['exe', 'bat', 'cmd', 'lnk'] }]
      : PLATFORM === 'darwin'
        ? [{ name: 'Applications', extensions: ['app'] }]
        : [{ name: 'All files', extensions: ['*'] }],
}
