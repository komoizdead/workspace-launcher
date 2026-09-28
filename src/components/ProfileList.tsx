import {
  AppWindow,
  Copy,
  Folder,
  Globe,
  Loader2,
  Pencil,
  Play,
  Plus,
  Rocket,
  Terminal,
  Trash2,
} from 'lucide-react'
import type { WorkspaceProfile } from '../types/workspace'
import { useStore } from '../store/useStore'

const TYPE_ICONS = { app: AppWindow, url: Globe, command: Terminal, folder: Folder }

function ProfileCard({ profile }: { profile: WorkspaceProfile }) {
  const { launch, launchingIds, startEdit, deleteProfile, duplicateProfile } = useStore()
  const launching = launchingIds.includes(profile.id)
  const counts = profile.actions.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + (a.enabled ? 1 : 0)
    return acc
  }, {})

  return (
    <div className="card animate-fade-in p-4 transition-colors hover:border-accent/60">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: profile.color ?? '#6d8dff' }}
          />
          <h3 className="truncate font-semibold text-white">{profile.name}</h3>
        </div>
        <span className="rounded bg-surface-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
          {profile.mode}
        </span>
      </div>

      {profile.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-400">{profile.description}</p>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
        {Object.entries(counts).map(([type, n]) => {
          const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS]
          return (
            <span key={type} className="flex items-center gap-1">
              <Icon size={13} /> {n}
            </span>
          )
        })}
        {profile.hotkey && (
          <span className="ml-auto rounded border border-surface-500 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
            {profile.hotkey}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        <button
          className="btn-primary flex-1"
          disabled={launching}
          onClick={() => void launch(profile.id)}
        >
          {launching ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          {launching ? 'Launching…' : 'Launch'}
        </button>
        <button className="btn-ghost" title="Edit" onClick={() => startEdit(profile)}>
          <Pencil size={15} />
        </button>
        <button
          className="btn-ghost"
          title="Duplicate"
          onClick={() => void duplicateProfile(profile.id)}
        >
          <Copy size={15} />
        </button>
        <button
          className="btn-ghost hover:text-red-400"
          title="Delete"
          onClick={() => {
            if (confirm(`Delete workspace "${profile.name}"?`)) void deleteProfile(profile.id)
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

export default function ProfileList() {
  const profiles = useStore((s) => s.profiles)
  const startEdit = useStore((s) => s.startEdit)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <Rocket size={15} /> Workspaces
          <span className="rounded-full bg-surface-600 px-2 py-0.5 text-xs text-slate-300">
            {profiles.length}
          </span>
        </h2>
        <button
          className="btn-primary"
          onClick={() =>
            startEdit({
              id: crypto.randomUUID(),
              name: '',
              description: '',
              color: '#6d8dff',
              mode: 'sequential',
              actions: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            })
          }
        >
          <Plus size={15} /> New Workspace
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <Rocket size={32} className="text-slate-500" />
          <p className="text-sm text-slate-400">No workspaces yet.</p>
          <p className="text-xs text-slate-500">
            Create one to launch your apps, tabs, commands and folders in a single click.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </div>
  )
}
