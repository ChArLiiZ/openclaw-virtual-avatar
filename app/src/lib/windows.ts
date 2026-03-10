import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'

export type WindowKind = 'avatar' | 'chat' | 'record' | 'settings'

const labels: Record<WindowKind, string> = {
  avatar: 'avatar',
  chat: 'chat',
  record: 'record',
  settings: 'settings',
}

export function currentWindowKind(): WindowKind {
  const raw = (window.location.hash || '#avatar').replace(/^#/, '')
  if (raw === 'chat' || raw === 'record' || raw === 'settings') return raw
  return 'avatar'
}

export async function showWindow(kind: WindowKind) {
  const label = labels[kind]
  try {
    const existing = await WebviewWindow.getByLabel(label)

    if (!existing) {
      const win = new WebviewWindow(label, { url: `/#${kind}` })
      await win.once('tauri://created', async () => {
        await win.show()
        await win.unminimize()
        await win.setFocus()
      })
      return win
    }

    await existing.show()
    await existing.unminimize()
    await existing.setFocus()
    return existing
  } catch (error) {
    console.error(`[windows] failed to open window: ${kind}`, error)
    throw error
  }
}

export async function focusWindow(kind: WindowKind) {
  return showWindow(kind)
}

export async function hideWindow(kind: WindowKind) {
  try {
    const win = await WebviewWindow.getByLabel(labels[kind])
    if (!win) return
    await win.hide()
  } catch (error) {
    console.error(`[windows] failed to hide window: ${kind}`, error)
    throw error
  }
}

export async function closeCurrentWindow() {
  const current = getCurrentWebviewWindow()
  await current.close()
}

export async function hideCurrentWindow() {
  const current = getCurrentWebviewWindow()
  await current.hide()
}

export async function currentWindowLabel() {
  const current = getCurrentWebviewWindow()
  return current.label
}
