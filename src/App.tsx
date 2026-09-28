import { useEffect } from 'react'
import { Minus, Rocket } from 'lucide-react'
import ProfileList from './components/ProfileList'
import ProfileEditor from './components/ProfileEditor'
import LaunchLogger from './components/LaunchLogger'
import { useStore } from './store/useStore'

export default function App() {
  const { init, editing, settings } = useStore()

  useEffect(() => {
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-2 border-b border-surface-500/60 bg-surface-800 px-4 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white">
          <Rocket size={14} />
        </span>
        <h1 className="text-sm font-semibold text-white">Workspace Launcher</h1>
        <span className="rounded bg-surface-600 px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-400">
          {window.launcher.platform}
        </span>

        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={settings.minimizeToTrayOnClose}
            onChange={(e) => {
              const next = { ...settings, minimizeToTrayOnClose: e.target.checked }
              useStore.setState({ settings: next })
              void window.launcher.saveSettings(next)
            }}
          />
          Minimize to tray on close
        </label>

        <button
          className="btn-ghost"
          title="Minimize to tray"
          onClick={() => window.launcher.minimizeToTray()}
        >
          <Minus size={15} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          <ProfileList />
        </main>
        <aside className="hidden w-80 border-l border-surface-500/60 bg-surface-800/40 md:block">
          <LaunchLogger />
        </aside>
      </div>

      {editing && <ProfileEditor />}
    </div>
  )
}
