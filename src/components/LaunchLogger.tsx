import { useEffect, useRef } from 'react'
import { CheckCircle2, Loader2, ScrollText, SkipForward, XCircle } from 'lucide-react'
import type { LaunchLogEntry, LogStatus } from '../types/workspace'
import { useStore } from '../store/useStore'

const STATUS_STYLE: Record<LogStatus, { icon: JSX.Element; cls: string }> = {
  pending: {
    icon: <Loader2 size={14} className="animate-spin text-slate-400" />,
    cls: 'text-slate-400',
  },
  running: {
    icon: <Loader2 size={14} className="animate-spin text-accent" />,
    cls: 'text-accent',
  },
  success: {
    icon: <CheckCircle2 size={14} className="text-emerald-400" />,
    cls: 'text-emerald-400',
  },
  error: {
    icon: <XCircle size={14} className="text-red-400" />,
    cls: 'text-red-400',
  },
  skipped: {
    icon: <SkipForward size={14} className="text-amber-400" />,
    cls: 'text-amber-400',
  },
}

function time(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour12: false })
}

export default function LaunchLogger() {
  const { logs, clearLogs, profiles } = useStore()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  const nameOf = (profileId: string) => profiles.find((p) => p.id === profileId)?.name

  return (
    <div className="card flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-surface-500/60 px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <ScrollText size={14} /> Live Launch Log
        </h3>
        <button className="btn-ghost text-xs" onClick={clearLogs} disabled={logs.length === 0}>
          Clear
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {logs.length === 0 ? (
          <p className="p-3 text-center text-xs text-slate-500">
            Launch a workspace to see real-time status for each action.
          </p>
        ) : (
          <ul className="space-y-1">
            {logs.map((e: LaunchLogEntry) => {
              const s = STATUS_STYLE[e.status]
              return (
                <li
                  key={e.id}
                  className="animate-fade-in flex items-center gap-2 rounded-md bg-surface-700/60 px-2 py-1.5 text-xs"
                >
                  <span className="shrink-0">{s.icon}</span>
                  <span className={`shrink-0 font-mono text-[10px] ${s.cls}`}>
                    {time(e.timestamp)}
                  </span>
                  <span className="shrink-0 rounded bg-surface-600 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {nameOf(e.profileId) ?? 'workspace'}
                  </span>
                  <span className="truncate font-medium text-slate-200">{e.label}</span>
                  {e.message && (
                    <span className="ml-auto shrink-0 truncate text-[10px] text-slate-500">
                      {e.message}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
