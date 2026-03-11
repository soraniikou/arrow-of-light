import { useState, useCallback, useRef, useEffect } from 'react'
import BubbleCanvas from './components/BubbleCanvas'
import ArrowCanvas from './components/ArrowCanvas'
import Heroine from './components/Heroine'
import './App.css'

const PLAN_STORAGE_KEY = 'bow-arrow-plans'
function getPlanKey(year, month) {
  return `${PLAN_STORAGE_KEY}-${year}-${month}`
}

function App() {
  const [bubbles, setBubbles] = useState([])
  const bubbleIdRef = useRef(0)
  const clickCountRef = useRef(0)
  const [goalOverlay, setGoalOverlay] = useState(null)

  useEffect(() => {
    const now = new Date()
    const key = getPlanKey(now.getFullYear(), now.getMonth() + 1)
    try {
      const raw = localStorage.getItem(key) || ''
      if (!raw) return
      let items = []
      try {
        const parsed = JSON.parse(raw)
        items = Array.isArray(parsed) ? parsed.filter(Boolean) : [String(parsed).trim()].filter(Boolean)
      } catch {
        items = [raw.trim()].filter(Boolean)
      }
      if (items.length) {
        setGoalOverlay(items)
        const t = setTimeout(() => setGoalOverlay(null), 3000)
        return () => clearTimeout(t)
      }
    } catch (_) {}
  }, [])

  const handleInteraction = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const getPos = (ev) => {
      if (ev.touches) {
        return {
          x: ev.touches[0].clientX - rect.left,
          y: ev.touches[0].clientY - rect.top,
        }
      }
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
    }
    const { x, y } = getPos(e)

    clickCountRef.current += 1
    // Every 4th click → explosive burst
    const isExplosion = clickCountRef.current % 4 === 0

    const newBubbles = []

    if (isExplosion) {
      // ── Explosive burst — full 360° shockwave ──
      const coreCount = 70 + Math.floor(Math.random() * 25)
      for (let i = 0; i < coreCount; i++) {
        const id = ++bubbleIdRef.current
        const angle = Math.random() * Math.PI * 2
        const dist  = Math.random() * Math.random() * 200
        const bx = x + Math.cos(angle) * dist
        const by = y + Math.sin(angle) * dist
        const radius = 8 + Math.random() * Math.random() * 90
        const hueShift = Math.random() * 360
        // Full-directional launch vector
        const launchAngle = Math.random() * Math.PI * 2
        const speed = 6 + Math.random() * 12
        newBubbles.push({
          id, x: bx, y: by, radius, hueShift,
          driftX: Math.cos(launchAngle) * speed,
          spawnDelay: Math.random() * 100,
          explosive: true,
          vy: Math.sin(launchAngle) * speed - 4,  // biased upward but fires all directions
        })
      }
      // Outer ring — tiny sparks in all directions
      const ringCount = 50 + Math.floor(Math.random() * 20)
      for (let i = 0; i < ringCount; i++) {
        const id = ++bubbleIdRef.current
        const angle = (i / ringCount) * Math.PI * 2 + Math.random() * 0.6
        const dist  = 150 + Math.random() * 180
        const bx = x + Math.cos(angle) * dist
        const by = y + Math.sin(angle) * dist
        const radius = 4 + Math.random() * 28
        const hueShift = Math.random() * 360
        const launchAngle = angle + (Math.random() - 0.5) * 0.8
        const speed = 4 + Math.random() * 10
        newBubbles.push({
          id, x: bx, y: by, radius, hueShift,
          driftX: Math.cos(launchAngle) * speed,
          spawnDelay: 40 + Math.random() * 200,
          explosive: true,
          vy: Math.sin(launchAngle) * speed - 3,
        })
      }
    } else {
      // ── Normal — full 360° scatter, biased upward ──
      const count = 55 + Math.floor(Math.random() * 20)
      for (let i = 0; i < count; i++) {
        const id = ++bubbleIdRef.current
        // Spread origin randomly around tap
        const spreadR = 5 + Math.random() * 120
        const spreadAngle = Math.random() * Math.PI * 2
        const bx = x + Math.cos(spreadAngle) * spreadR
        const by = y + Math.sin(spreadAngle) * spreadR
        const radius = 8 + Math.random() * Math.random() * 75
        const hueShift = Math.random() * 360
        // Launch direction: full 360° but upper half weighted (bias upward)
        const launchAngle = (Math.random() * Math.PI * 2)
        const speed = 2 + Math.random() * 8
        const spawnDelay = Math.random() * 280
        newBubbles.push({
          id, x: bx, y: by, radius, hueShift,
          driftX: Math.cos(launchAngle) * speed,
          spawnDelay,
          vy: Math.sin(launchAngle) * speed - 5,  // upward bias
        })
      }
    }

    setBubbles(prev => [...prev, ...newBubbles])
  }, [])

  const removeBubble = useCallback((id) => {
    setBubbles(prev => prev.filter(b => b.id !== id))
  }, [])

  return (
    <div
      className="scene"
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {goalOverlay && Array.isArray(goalOverlay) && goalOverlay.length > 0 && (
        <div className="goal-overlay">
          <div className="goal-box">
            <span className="goal-label">今月の目標</span>
            <div className="goal-text">
              {goalOverlay.map((item, i) => (
                <p key={i} className="goal-item">{item}</p>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="gradient-bg" />
      <ArrowCanvas />
      <Heroine />
      <BubbleCanvas bubbles={bubbles} onRemove={removeBubble} />
      <div className="title-overlay">
        <h1 className="title">Arrow of Light</h1>
      </div>
      <div className="bubble-hint">
        <span>画面をタッチすると、光の泡が生まれる ✦</span>
      </div>
    </div>
  )
}

export default App
