import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AppWindow,
  Folder,
  Globe,
  GripVertical,
  Plus,
  Save,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import type { ActionType, WorkspaceAction, WorkspaceProfile } from '../types/workspace'
import { useStore } from '../store/useStore'

const ACTION_TYPES: { type: ActionType; label: string; icon: typeof AppWindow; hint: string }[] = [
  { type: 'app', label: 'Application', icon: AppWindow, hint: 'C:\\Apps\\code.exe or "Visual Studio Code" (macOS)' },
  { type: 'url', label: 'Web Page', icon: Globe, hint: 'https://github.com or http://localhost:3000' },
  { type: 'command', label: 'Terminal Command', icon: Terminal, hint: 'cd ~/app && npm run dev' },
  { type: 'folder', label: 'Folder', icon: Folder, hint: 'C:\\Projects\\app or ~/projects/app' },
]

function newAction(type: ActionType): WorkspaceAction {
  return {
    id: crypto.randomUUID(),
    type,
    label: '',
    target: '',
    delayAfterMs: 0,
    skipIfRunning: true,
    enabled: true,
  }
}

function EnvEditor({
  env,
  onChange,
}: {
  env: Record<string, string>
  onChange: (env: Record<string, string>) => void
}) {
  const entries = Object.entries(env)
  return (
    <div className="space-y-1">
      {entries.map(([k, v], i) => (
        <div key={i} className="flex gap-1.5">
          <input
            className="input flex-1 font-mono text-xs"
            value={k}
            placeholder="KEY"
            onChange={(e) => {
              const next = { ...env }
              delete next[k]
              next[e.target.value] = v
              onChange(next)
            }}
          />
          <input
            className="input flex-1 font-mono text-xs"
            value={v}
            placeholder="value"
            onChange={(e) => onChange({ ...env, [k]: e.target.value })}
          />
          <button
            className="btn-ghost px-2 hover:text-red-400"
            onClick={() => {
              const next = { ...env }
              delete next[k]
              onChange(next)
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        className="btn-ghost text-xs"
        onClick={() => onChange({ ...env, [`VAR_${entries.length + 1}`]: '' })}
      >
        <Plus size={13} /> Add env var
      </button>
    </div>
  )
}

function ActionRow({
  action,
  onChange,
  onRemove,
}: {
  action: WorkspaceAction
  onChange: (a: WorkspaceAction) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: action.id,
  })
  const meta = ACTION_TYPES.find((t) => t.type === action.type)!
  const Icon = meta.icon
  const platform = window.launcher.platform

  const pick = async (kind: 'app' | 'folder') => {
    const p = await window.launcher.pickFile(kind)
    if (p) onChange({ ...action, target: p })
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card space-y-2 p-3 ${isDragging ? 'z-10 border-accent opacity-90' : ''} ${
        action.enabled ? '' : 'opacity-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          className="cursor-grab touch-none text-slate-500 hover:text-slate-300 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>
        <Icon size={15} className="shrink-0 text-accent" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {meta.label}
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={action.enabled}
            onChange={(e) => onChange({ ...action, enabled: e.target.checked })}
          />
          Enabled
        </label>
        <button className="btn-ghost px-1.5 hover:text-red-400" onClick={onRemove}>
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          className="input"
          placeholder="Label (e.g. VS Code)"
          value={action.label}
          onChange={(e) => onChange({ ...action, label: e.target.value })}
        />
        <div className="flex gap-1.5">
          <input
            className="input font-mono text-xs"
            placeholder={meta.hint}
            value={action.target}
            onChange={(e) => onChange({ ...action, target: e.target.value })}
          />
          {action.type === 'app' && (
            <button className="btn-ghost shrink-0" title="Browse" onClick={() => void pick('app')}>
              …
            </button>
          )}
          {action.type === 'folder' && (
            <button className="btn-ghost shrink-0" title="Browse" onClick={() => void pick('folder')}>
              …
            </button>
          )}
        </div>
      </div>

      {action.type === 'command' && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
            Environment variables
          </p>
          <EnvEditor env={action.env ?? {}} onChange={(env) => onChange({ ...action, env })} />
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-slate-400">
        <label className="flex items-center gap-1.5">
          Delay after (ms)
          <input
            type="number"
            min={0}
            step={100}
            className="input w-24"
            value={action.delayAfterMs ?? 0}
            onChange={(e) =>
              onChange({ ...action, delayAfterMs: Math.max(0, Number(e.target.value) || 0) })
            }
          />
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={action.skipIfRunning ?? false}
            onChange={(e) => onChange({ ...action, skipIfRunning: e.target.checked })}
          />
          Skip if already running
        </label>
        {platform === 'darwin' && action.type === 'app' && (
          <span className="text-[10px] text-slate-500">Tip: use the app name, e.g. “Figma”</span>
        )}
      </div>
    </div>
  )
}

export default function ProfileEditor() {
  const { editing, startEdit, saveProfile } = useStore()
  const [draft, setDraft] = useState<WorkspaceProfile>(() => editing!)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  if (!editing) return null

  const update = (patch: Partial<WorkspaceProfile>) => setDraft({ ...draft, ...patch })

  const updateAction = (a: WorkspaceAction) =>
    update({ actions: draft.actions.map((x) => (x.id === a.id ? a : x)) })

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = draft.actions.map((a) => a.id)
    update({
      actions: arrayMove(draft.actions, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
    })
  }

  const valid = draft.name.trim().length > 0

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <div className="card animate-slide-up flex max-h-[90vh] w-full max-w-2xl flex-col">
        <div className="flex items-center justify-between border-b border-surface-500/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">
            {useStore.getState().profiles.some((p) => p.id === draft.id)
              ? 'Edit Workspace'
              : 'New Workspace'}
          </h2>
          <button className="btn-ghost px-1.5" onClick={() => startEdit(null)}>
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-slate-400">Name *</label>
              <input
                className="input"
                placeholder="Web Dev — Project A"
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Color</label>
            <input
                type="color"
                className="input h-[34px] cursor-pointer p-1"
                value={draft.color ?? '#6d8dff'}
                onChange={(e) => update({ color: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Description</label>
            <input
              className="input"
              placeholder="Opens editor, dev server, Jira and the project folder"
              value={draft.description ?? ''}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Execution order</label>
              <select
                className="input"
                value={draft.mode}
                onChange={(e) => update({ mode: e.target.value as WorkspaceProfile['mode'] })}
              >
                <option value="sequential">Sequential (one by one)</option>
                <option value="parallel">Parallel (all at once)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Global hotkey (e.g. Control+Alt+1)
              </label>
              <input
                className="input font-mono text-xs"
                placeholder="Control+Alt+1"
                value={draft.hotkey ?? ''}
                onChange={(e) => update({ hotkey: e.target.value || undefined })}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Actions ({draft.actions.length})
              </label>
              <div className="flex gap-1">
                {ACTION_TYPES.map((t) => (
                  <button
                    key={t.type}
                    className="btn-ghost text-xs"
                    onClick={() => update({ actions: [...draft.actions, newAction(t.type)] })}
                  >
                    <Plus size={12} /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            {draft.actions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-surface-500 p-4 text-center text-xs text-slate-500">
                No actions yet — add apps, web pages, terminal commands or folders above.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                  items={draft.actions.map((a) => a.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {draft.actions.map((a) => (
                      <ActionRow
                        key={a.id}
                        action={a}
                        onChange={updateAction}
                        onRemove={() =>
                          update({ actions: draft.actions.filter((x) => x.id !== a.id) })
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-surface-500/60 px-4 py-3">
          <button className="btn-ghost" onClick={() => startEdit(null)}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!valid}
            onClick={() => void saveProfile({ ...draft, name: draft.name.trim() })}
          >
            <Save size={15} /> Save Workspace
          </button>
        </div>
      </div>
    </div>
  )
}
