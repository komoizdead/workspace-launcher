/* Captures README screenshots from the real app using Electron's native
   capturePage() with software rendering. The CDP Page.captureScreenshot path
   hangs on this machine (frame starvation while the window reports hidden),
   so screenshots are taken in-process instead. */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { randomUUID } = require('crypto')

const repoRoot = path.resolve(__dirname, '..')

const profile = (id, name, description, color, mode, hotkey, actions) => ({
  id,
  name,
  description,
  color,
  mode,
  ...(hotkey ? { hotkey } : {}),
  actions,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

const action = (id, type, label, target, extra = {}) => ({
  id,
  type,
  label,
  target,
  delayAfterMs: 0,
  skipIfRunning: true,
  enabled: true,
  ...extra,
})

const DEMO_PROFILES = [
  profile(
    'demo-start-work-day',
    'Start Work Day',
    'Slack, mail, calendar, notes and the dev server in one click',
    '#6d8dff',
    'sequential',
    'Control+Alt+1',
    [
      action('a-dev-server', 'command', 'Dev server', 'cd C:\\Projects\\acme-web && npm run dev', {
        env: { NODE_ENV: 'development', PORT: '5173' },
      }),
      action('a-slack', 'app', 'Slack', 'C:\\Program Files\\Slack\\Slack.exe'),
      action('a-gmail', 'url', 'Gmail', 'https://mail.google.com'),
      action('a-calendar', 'url', 'Google Calendar', 'https://calendar.google.com'),
      action('a-notes', 'folder', 'Daily notes', 'C:\\Projects\\notes'),
    ],
  ),
  profile(
    'demo-dev-environment',
    'Dev Environment',
    'Editor, local services and the repository folder',
    '#34d399',
    'sequential',
    'Control+Alt+2',
    [
      action('b-code', 'app', 'Visual Studio Code', 'C:\\Program Files\\Microsoft VS Code\\Code.exe'),
      action('b-local', 'url', 'Local app', 'http://localhost:5173'),
      action('b-repo', 'folder', 'Repository', 'C:\\Projects\\acme-web'),
      action('b-storybook', 'command', 'Storybook', 'npm run storybook', {
        env: { STORYBOOK_PORT: '6006' },
      }),
    ],
  ),
  profile(
    'demo-focus-mode',
    'Focus Mode',
    'No notifications: docs, music and a clean desk',
    '#f472b6',
    'parallel',
    'Control+Alt+3',
    [
      action('c-music', 'url', 'Focus playlist', 'https://music.youtube.com'),
      action('c-docs', 'url', 'MDN Docs', 'https://developer.mozilla.org'),
      action('c-notion', 'app', 'Notion', 'C:\\Program Files\\Notion\\Notion.exe'),
      action('c-specs', 'folder', 'Specs', 'C:\\Projects\\specs'),
    ],
  ),
  profile(
    'demo-design-review',
    'Design Review',
    'Figma, the review board and the export folder',
    '#fbbf24',
    'sequential',
    null,
    [
      action('d-figma', 'app', 'Figma', 'C:\\Program Files\\Figma\\Figma.exe'),
      action('d-board', 'url', 'Design board', 'https://www.figma.com/files'),
      action('d-assets', 'folder', 'Exports', 'C:\\Projects\\exports'),
    ],
  ),
  profile(
    'demo-morning-news',
    'Morning News',
    'Reading list before standup',
    '#22d3ee',
    'sequential',
    null,
    [
      action('e-hn', 'url', 'Hacker News', 'https://news.ycombinator.com'),
      action('e-verge', 'url', 'The Verge', 'https://www.theverge.com'),
      action('e-brew', 'url', 'Morning Brew', 'https://www.morningbrew.com'),
    ],
  ),
  profile(
    'demo-wrap-up',
    'Wrap Up',
    'End-of-day routine: commit notes, log time, close the loop',
    '#a78bfa',
    'sequential',
    null,
    [
      action('f-commit', 'command', 'Backup notes', 'git -C C:\\Projects\\notes add -A && git -C C:\\Projects\\notes commit -m "daily notes"'),
      action('f-timelog', 'url', 'Time log', 'https://toggl.com/app/timer'),
      action('f-plan', 'folder', 'Tomorrow', 'C:\\Projects\\planning'),
    ],
  ),
]

const LOG_STORY = [
  { actionId: 'a-slack', status: 'success', message: 'Launched', offsetMs: 4500 },
  { actionId: 'a-gmail', status: 'success', message: 'Opened in default browser', offsetMs: 3600 },
  { actionId: 'a-calendar', status: 'success', message: 'Opened in default browser', offsetMs: 2700 },
  { actionId: 'a-notes', status: 'skipped', message: 'Already open', offsetMs: 1800 },
  { actionId: 'a-dev-server', status: 'running', message: 'Waiting for dev server output…', offsetMs: 0 },
]

const { app, BrowserWindow } = require('electron')

app.getAppPath = () => repoRoot
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

// The real main.js constructs electron-store at require time, so the temp
// userData and its config.json must be in place before it is loaded.
const tmpPrefix = path.join(os.tmpdir(), 'workspace-launcher-shots-')
for (const entry of fs.readdirSync(os.tmpdir())) {
  if (entry.startsWith('workspace-launcher-shots-')) {
    try {
      fs.rmSync(path.join(os.tmpdir(), entry), { recursive: true, force: true })
    } catch {
      // Chromium cache files stay locked until the previous run's process fully exits
    }
  }
}
const userDataDir = fs.mkdtempSync(tmpPrefix)
app.setPath('userData', userDataDir)
fs.writeFileSync(
  path.join(userDataDir, 'config.json'),
  JSON.stringify(
    {
      profiles: DEMO_PROFILES,
      settings: { minimizeToTrayOnClose: true, launchOnBoot: false },
      history: [],
    },
    null,
    2,
  ),
)

const outDir = path.join(repoRoot, 'assets', 'screenshots')
const watchdog = setTimeout(() => {
  console.error('[capture] Fatal: global timeout reached')
  app.exit(1)
}, 90000)

require(path.join(repoRoot, 'dist-electron', 'main.js'))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ])

async function waitFor(win, expression, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const ok = await win.webContents.executeJavaScript(expression).catch(() => false)
    if (ok) return true
    if (Date.now() > deadline) return false
    await sleep(200)
  }
}

function imageStats(image) {
  const { width, height } = image.getSize()
  const bitmap = image.toBitmap()
  const colors = new Set()
  let darkest = 255
  let brightest = 0
  const pixelStep = Math.max(1, Math.floor((width * height) / 4000))
  for (let p = 0; p < width * height; p += pixelStep) {
    const i = p * 4
    const b = bitmap[i]
    const g = bitmap[i + 1]
    const r = bitmap[i + 2]
    colors.add((r << 16) | (g << 8) | b)
    const lum = (r + g + b) / 3
    if (lum < darkest) darkest = lum
    if (lum > brightest) brightest = lum
  }
  return { width, height, uniqueColors: colors.size, luminance: [Math.round(darkest), Math.round(brightest)] }
}

async function capture(win, name) {
  const image = await withTimeout(win.webContents.capturePage(), 15000, `capturePage(${name})`)
  const png = image.toPNG()
  const file = path.join(outDir, name)
  fs.writeFileSync(file, png)
  const stats = imageStats(image)
  console.log(
    `[capture] ${path.relative(repoRoot, file)}  ${stats.width}x${stats.height}  ` +
      `${(png.length / 1024).toFixed(0)} KB  colors=${stats.uniqueColors} luminance=${stats.luminance[0]}..${stats.luminance[1]}`,
  )
  if (stats.uniqueColors < 50 || png.length < 10000) {
    throw new Error(`Capture "${name}" looks blank (single-colour image)`)
  }
  return file
}

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(outDir, { recursive: true })

    const win = BrowserWindow.getAllWindows()[0]
    if (!win) throw new Error('The app created no window (single-instance lock or startup failure)')
    win.webContents.setBackgroundThrottling(false)

    if (win.webContents.isLoading()) {
      await new Promise((resolve) => win.webContents.once('did-finish-load', resolve))
    }
    const rendered = await waitFor(
      win,
      `document.querySelectorAll('button[title="Edit"]').length >= ${DEMO_PROFILES.length}`,
      20000,
    )
    if (!rendered) throw new Error('App UI never rendered the demo profile cards')
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)')

    win.show()
    win.focus()
    win.moveTop()
    win.setAlwaysOnTop(true)
    await sleep(900)

    const results = []
    results.push(await capture(win, 'dashboard.png'))

    const startWorkDay = DEMO_PROFILES[0]
    const now = Date.now()
    // appendLog() prepends, so send newest-first to render top-to-bottom in order
    for (const step of [...LOG_STORY].reverse()) {
      const act = startWorkDay.actions.find((a) => a.id === step.actionId)
      win.webContents.send('launch:log', {
        id: randomUUID(),
        profileId: startWorkDay.id,
        actionId: act.id,
        label: act.label,
        type: act.type,
        status: step.status,
        message: step.message,
        timestamp: now - step.offsetMs,
      })
    }
    await sleep(900)
    results.push(await capture(win, 'launch-log.png'))

    await win.webContents.executeJavaScript(
      `document.querySelectorAll('button[title="Edit"]')[0].click(); true`,
    )
    await sleep(700)
    results.push(await capture(win, 'profile-editor.png'))

    win.setAlwaysOnTop(false)
    clearTimeout(watchdog)
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true })
    } catch {
      // Locked Chromium cache files are swept on the next run
    }
    console.log(`[capture] Done — ${results.length} screenshots in assets/screenshots/`)
    app.exit(0)
  } catch (err) {
    clearTimeout(watchdog)
    console.error('[capture] FAILED:', (err && err.stack) || err)
    console.error(`[capture] Temp userData kept for inspection: ${userDataDir}`)
    app.exit(1)
  }
})
