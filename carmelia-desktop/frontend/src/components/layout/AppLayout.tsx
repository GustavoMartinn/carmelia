import { useCallback, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { Sidebar } from './Sidebar'
import { MainPanel } from './MainPanel'

export function AppLayout() {
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth)
  const dragging = useRef(false)

  const onMouseDown = useCallback(() => {
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const newWidth = Math.max(180, Math.min(500, e.clientX))
      setSidebarWidth(newWidth)
    }

    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [setSidebarWidth])

  return (
    <div className="flex h-full">
      <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="flex-shrink-0">
        <Sidebar />
      </div>
      <div className="resize-handle" onMouseDown={onMouseDown} />
      <div className="flex-1 min-w-0">
        <MainPanel />
      </div>
    </div>
  )
}
