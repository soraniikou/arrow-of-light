import { useEffect, useRef, useState, useCallback } from 'react'

const SHOOTING = 'shooting'
const WEAPONS  = 'weapons'

// Arrow fires toward screen centre from heroine (upper-right area)
// Origin ~(62%, 44%) → target ~(50%, 55%) → angle slightly down-left
const ANGLE = Math.PI + Math.PI / 8   // ≈ 202° (mostly left, slight downward)

// 9 symbols — label: 'tap' | 'free' | 'plan'
const SYMBOLS = [
  { key: 'spear',   icon: '🗡️',  cls: 'sym-spear',   label: 'tap', msg: '解き放て',        sub: '恐れを手放し、自由になれ' },
  { key: 'shield',  icon: '🛡️',  cls: '',            label: 'tap', msg: 'もう振り返らない',  sub: '前だけを見て歩いていい' },
  { key: 'star',    icon: '⭐',   cls: '',            label: 'tap', msg: '前に進んでみよう',  sub: '一歩が、あなたの星になる' },
  { key: 'heart',   icon: '♥',   cls: 'sym-heart',   label: 'tap', msg: 'アドベンチャー',    sub: '胸の高鳴りを信じて' },
  { key: 'spade',   icon: '♠',   cls: 'sym-spade',   label: 'tap', msg: '新しい一日を',      sub: '今日が、はじまりの日' },
  { key: 'club',    icon: '♣',   cls: 'sym-club',    label: 'tap', msg: '広がる世界へ',      sub: 'まだ見ぬ扉が待っている' },
  { key: 'diamond', icon: '◆',   cls: 'sym-diamond', label: 'tap', msg: 'きらめく未来へ',    sub: 'あなたの光は消えない' },
  { key: 'opal',    icon: '💎',  cls: 'sym-opal',    label: 'free', msg: '自由に思いを記入',  sub: '' },
  { key: 'calendar', icon: '📅', cls: 'sym-calendar', label: 'plan', msg: '目標・計画',       sub: '' },
]

const PLAN_STORAGE_KEY = 'bow-arrow-plans'

function getPlanKey(year, month) {
  return `${PLAN_STORAGE_KEY}-${year}-${month}`
}

function loadPlan(year, month) {
  try {
    const raw = localStorage.getItem(getPlanKey(year, month))
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
      return [String(parsed)]
    } catch {
      return [raw.trim()].filter(Boolean)
    }
  } catch {
    return []
  }
}

function savePlan(year, month, items) {
  try {
    const arr = Array.isArray(items) ? items.filter(s => String(s).trim()) : []
    if (arr.length) {
      localStorage.setItem(getPlanKey(year, month), JSON.stringify(arr))
    } else {
      localStorage.removeItem(getPlanKey(year, month))
    }
  } catch (_) {}
}

// ── Free notes (opal) ──
const FREE_NOTES_PREFIX = 'free-notes-'
function getFreeNoteKey(year, month, day) {
  return `${FREE_NOTES_PREFIX}${year}-${month}-${day}`
}

function loadFreeNote(year, month, day) {
  try {
    return localStorage.getItem(getFreeNoteKey(year, month, day)) || ''
  } catch {
    return ''
  }
}

function saveFreeNote(year, month, day, text) {
  try {
    const t = String(text).trim()
    if (t) {
      localStorage.setItem(getFreeNoteKey(year, month, day), t)
    } else {
      localStorage.removeItem(getFreeNoteKey(year, month, day))
    }
  } catch (_) {}
}

function listFreeNotes() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(FREE_NOTES_PREFIX))
    return keys.map(key => {
      const raw = key.replace(FREE_NOTES_PREFIX, '')
      const [y, m, d] = raw.split('-').map(Number)
      const content = localStorage.getItem(key) || ''
      return { key, year: y, month: m, day: d, content }
    }).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      if (a.month !== b.month) return b.month - a.month
      return b.day - a.day
    })
  } catch {
    return []
  }
}

function deleteFreeNote(key) {
  try {
    localStorage.removeItem(key)
  } catch (_) {}
}

const SYMBOL_POSITIONS = [
  { x: 0.05, y: 0.12 },
  { x: 0.14, y: 0.20 },
  { x: 0.05, y: 0.28 },
  { x: 0.14, y: 0.36 },
  { x: 0.05, y: 0.44 },
  { x: 0.14, y: 0.52 },
  { x: 0.05, y: 0.60 },
  { x: 0.14, y: 0.72 },
  { x: 0.05, y: 0.84 },
]

export default function ArrowShot({ onDismiss }) {
  const canvasRef   = useRef(null)
  const rafRef      = useRef(null)
  const lineRef     = useRef(null)   // { ox, oy, endX, endY, angle } for arrowhead animation
  const [phase, setPhase]         = useState(SHOOTING)
  const [message, setMessage]     = useState(null)
  const [visibleCount, setVisible] = useState(0)
  const [tipPos, setTipPos]       = useState({ x: 0, y: 0 })
  const [freeText, setFreeText]   = useState('')
  const [planYear, setPlanYear]       = useState(new Date().getFullYear())
  const [planMonth, setPlanMonth]     = useState(new Date().getMonth() + 1)
  const [planItems, setPlanItems]     = useState([])
  const [planEditInput, setPlanEditInput] = useState('')
  const [planViewMode, setPlanViewMode]   = useState('edit')  // 'edit' | 'view'
  const [freeNotesView, setFreeNotesView] = useState('write') // 'write' | 'list'
  const [freeNotesList, setFreeNotesList] = useState([])

  // ── Arrow shoot animation (2× slower: 120 frames) ──
  useEffect(() => {
    if (phase !== SHOOTING) return

    const startTimer = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')

      const setSize = () => {
        canvas.width  = window.innerWidth
        canvas.height = window.innerHeight
      }
      setSize()
      window.addEventListener('resize', setSize)

      const ox = window.innerWidth  * 0.62
      const oy = window.innerHeight * 0.44

      // Arrow travels to screen centre area
      const targetX = window.innerWidth  * 0.46
      const targetY = window.innerHeight * 0.50
      const totalLen = Math.hypot(targetX - ox, targetY - oy) * 1.05
      const arrowAngle = Math.atan2(targetY - oy, targetX - ox)

      const tailLen = totalLen * 0.30
      const FRAMES  = 120   // 2× original 60
      let frame = 0

      const tick = () => {
        frame++
        const p = Math.min(frame / FRAMES, 1)
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const tipDist  = p * totalLen
        const tailDist = Math.max(0, tipDist - tailLen)

        const tipX  = ox + Math.cos(arrowAngle) * tipDist
        const tipY  = oy + Math.sin(arrowAngle) * tipDist
        const tailX = ox + Math.cos(arrowAngle) * tailDist
        const tailY = oy + Math.sin(arrowAngle) * tailDist
        const perp  = arrowAngle + Math.PI / 2

        // Glow halo
        ctx.save()
        ctx.filter = 'blur(8px)'
        const glow = ctx.createLinearGradient(tailX, tailY, tipX, tipY)
        glow.addColorStop(0,   'rgba(120,210,255,0)')
        glow.addColorStop(0.5, 'rgba(180,235,255,0.25)')
        glow.addColorStop(1,   'rgba(255,255,255,0.65)')
        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(tipX, tipY)
        ctx.strokeStyle = glow
        ctx.lineWidth = 28
        ctx.lineCap = 'round'
        ctx.stroke()
        ctx.restore()

        // Core bright line
        const core = ctx.createLinearGradient(tailX, tailY, tipX, tipY)
        core.addColorStop(0,    'rgba(200,240,255,0)')
        core.addColorStop(0.55, 'rgba(220,245,255,0.85)')
        core.addColorStop(1,    'rgba(255,255,255,1)')
        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(tipX, tipY)
        ctx.strokeStyle = core
        ctx.lineWidth = 3.5
        ctx.lineCap = 'round'
        ctx.stroke()

        // Arrowhead
        const hw = 11, hl = 24
        ctx.save()
        ctx.shadowColor = 'rgba(160,230,255,0.9)'
        ctx.shadowBlur  = 20
        ctx.beginPath()
        ctx.moveTo(tipX, tipY)
        ctx.lineTo(tipX - Math.cos(arrowAngle)*hl + Math.cos(perp)*hw,
                   tipY - Math.sin(arrowAngle)*hl + Math.sin(perp)*hw)
        ctx.lineTo(tipX - Math.cos(arrowAngle)*hl - Math.cos(perp)*hw,
                   tipY - Math.sin(arrowAngle)*hl - Math.sin(perp)*hw)
        ctx.closePath()
        ctx.fillStyle = 'rgba(255,255,255,0.97)'
        ctx.fill()
        ctx.restore()

        // Sparkle trail
        for (let i = 0; i < 12; i++) {
          const frac = i / 12
          const sx = tailX + (tipX - tailX) * (0.35 + frac * 0.65)
          const sy = tailY + (tipY - tailY) * (0.35 + frac * 0.65)
          const off = (Math.random() - 0.5) * 14
          ctx.beginPath()
          ctx.arc(sx + Math.cos(perp)*off, sy + Math.sin(perp)*off,
                  Math.random() * 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(200,240,255,${frac * 0.8})`
          ctx.fill()
        }

        if (p < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          window.removeEventListener('resize', setSize)
          const extendLen = Math.hypot(canvas.width, canvas.height) * 0.55
          const endX = tipX + Math.cos(arrowAngle) * extendLen
          const endY = tipY + Math.sin(arrowAngle) * extendLen
          lineRef.current = { ox, oy, endX, endY, angle: arrowAngle }
          drawResidual(ctx, ox, oy, endX, endY)
          setTipPos({ x: tipX, y: tipY })
          setPhase(WEAPONS)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
      return () => {
        cancelAnimationFrame(rafRef.current)
        window.removeEventListener('resize', setSize)
      }
    }, 30)

    return () => clearTimeout(startTimer)
  }, [phase])

  // Reveal symbols one by one with 260ms stagger
  useEffect(() => {
    if (phase !== WEAPONS) return
    setVisible(0)
    const timers = SYMBOLS.map((_, i) =>
      setTimeout(() => setVisible(i + 1), 300 + i * 260)
    )
    return () => timers.forEach(clearTimeout)
  }, [phase])

  // Arrowhead moves right→left over 5s, then line fades out over 4s
  useEffect(() => {
    if (phase !== WEAPONS || !lineRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const { ox, oy, endX, endY, angle } = lineRef.current
    const perp = angle + Math.PI / 2
    const hw = 11, hl = 24
    const startTime = performance.now()
    const TRAVEL = 5000
    const FADEOUT = 4000

    const tick = () => {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / TRAVEL, 1)
      const fadeStart = TRAVEL
      const fadeElapsed = Math.max(0, elapsed - fadeStart)
      const fadeProgress = Math.min(fadeElapsed / FADEOUT, 1)
      const alpha = fadeProgress < 1 ? 1 - fadeProgress : 0

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (alpha > 0) {
        ctx.save()
        ctx.globalAlpha = alpha
        drawResidual(ctx, ox, oy, endX, endY)

        const headX = ox + (endX - ox) * progress
        const headY = oy + (endY - oy) * progress

        ctx.shadowColor = 'rgba(160,230,255,0.9)'
        ctx.shadowBlur = 20
        ctx.beginPath()
        ctx.moveTo(headX, headY)
        ctx.lineTo(
          headX - Math.cos(angle) * hl + Math.cos(perp) * hw,
          headY - Math.sin(angle) * hl + Math.sin(perp) * hw,
        )
        ctx.lineTo(
          headX - Math.cos(angle) * hl - Math.cos(perp) * hw,
          headY - Math.sin(angle) * hl - Math.sin(perp) * hw,
        )
        ctx.closePath()
        ctx.fillStyle = 'rgba(255,255,255,0.97)'
        ctx.fill()
        ctx.restore()
      }

      if (fadeProgress < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase])

  const handleSymbol = useCallback((key, e) => {
    e.stopPropagation()
    setMessage(key)
  }, [])

  // Load saved plan when opening or when year/month changes — 保存済みなら見返しモードで表示
  useEffect(() => {
    if (message === 'calendar') {
      const loaded = loadPlan(planYear, planMonth)
      setPlanItems(loaded)
      setPlanEditInput('')
      setPlanViewMode(loaded.length ? 'view' : 'edit')
    }
  }, [message, planYear, planMonth])

  // Load today's free note when opening opal
  useEffect(() => {
    if (message === 'opal') {
      setFreeNotesView('write')
      const d = new Date()
      const loaded = loadFreeNote(d.getFullYear(), d.getMonth() + 1, d.getDate())
      setFreeText(loaded)
    }
  }, [message])

  const handlePlanAdd = useCallback(() => {
    const t = planEditInput.trim()
    if (t) {
      setPlanItems(prev => [...prev, t])
      setPlanEditInput('')
    }
  }, [planEditInput])

  const handlePlanRemoveItem = useCallback((index) => {
    const next = planItems.filter((_, i) => i !== index)
    setPlanItems(next)
    if (planViewMode === 'view') savePlan(planYear, planMonth, next)
  }, [planItems, planViewMode, planYear, planMonth])

  const handlePlanSave = useCallback(() => {
    savePlan(planYear, planMonth, planItems)
    setPlanViewMode('view')
  }, [planYear, planMonth, planItems])

  const handlePlanDelete = useCallback(() => {
    savePlan(planYear, planMonth, [])
    setPlanItems([])
    setPlanViewMode('edit')
  }, [planYear, planMonth])

  const handlePlanBack = useCallback(() => {
    setMessage(null)
    setPlanViewMode('edit')
  }, [])

  const handleOpalSaveAndClose = useCallback(() => {
    const d = new Date()
    saveFreeNote(d.getFullYear(), d.getMonth() + 1, d.getDate(), freeText)
    onDismiss()
  }, [freeText, onDismiss])

  const handleOpalShowList = useCallback(() => {
    setFreeNotesList(listFreeNotes())
    setFreeNotesView('list')
  }, [])

  const handleOpalBackToWrite = useCallback(() => {
    setFreeNotesView('write')
  }, [])

  const handleOpalDeleteNote = useCallback((key) => {
    deleteFreeNote(key)
    setFreeNotesList(listFreeNotes())
  }, [])

  const handleClose = useCallback((e) => {
    e.stopPropagation()
    onDismiss()
  }, [onDismiss])

  const activeSymbol = SYMBOLS.find(s => s.key === message)

  return (
    <>
      <div className="arrowshot-veil" onClick={handleClose} />
      <canvas ref={canvasRef} className="arrowshot-canvas" />

      {phase === WEAPONS && !message && (
        <div className="weapons-wrap">
          <button className="arrowshot-close" onClick={handleClose}>✕</button>

          {SYMBOLS.map((sym, i) => {
            if (i >= visibleCount) return null
            const pos = SYMBOL_POSITIONS[i]
            return (
              <button
                key={sym.key}
                className="weapon-btn symbol-btn"
                onClick={(e) => handleSymbol(sym.key, e)}
                aria-label={sym.msg}
                style={{
                  left: `calc(${pos.x * 100}% - 2rem)`,
                  top:  `calc(${pos.y * 100}% - 2rem)`,
                }}
              >
                <span className={`weapon-icon symbol-icon ${sym.cls}`}>{sym.icon}</span>
                <span className="symbol-tap">{sym.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {message === 'opal' && (
        <div className="message-overlay" onClick={handleClose}>
          <div
            className="message-box message-opal"
            onClick={e => e.stopPropagation()}
          >
            <div className="message-icon sym-opal">💎</div>
            <p className="message-text">
              {freeNotesView === 'write' ? '自由に思いを記入' : '過去のメモ'}
            </p>
            {freeNotesView === 'write' ? (
              <>
                <textarea
                  className="message-textarea"
                  placeholder="思いついたことを自由に書いてください…"
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                  rows={6}
                />
                <div className="message-opal-actions">
                  <button className="message-opal-history" onClick={handleOpalShowList}>
                    過去のメモ
                  </button>
                  <button className="message-close" onClick={handleOpalSaveAndClose}>
                    保存して閉じる
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="free-notes-list">
                  {freeNotesList.length ? (
                    freeNotesList.map(({ key, year, month, day, content }) => (
                      <div key={key} className="free-notes-item">
                        <div className="free-notes-item-header">
                          <span className="free-notes-date">{year}年{month}月{day}日</span>
                          <button
                            type="button"
                            className="free-notes-delete"
                            onClick={() => handleOpalDeleteNote(key)}
                            aria-label="削除"
                          >
                            削除
                          </button>
                        </div>
                        <p className="free-notes-content">{content}</p>
                      </div>
                    ))
                  ) : (
                    <p className="free-notes-empty">（保存されたメモはありません）</p>
                  )}
                </div>
                <div className="message-opal-actions">
                  <button className="message-opal-back" onClick={handleOpalBackToWrite}>
                    戻る
                  </button>
                  <button className="message-close" onClick={handleClose}>
                    閉じる
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {message === 'calendar' && (
        <div className="message-overlay" onClick={handlePlanBack}>
          <div
            className="message-box message-calendar"
            onClick={e => e.stopPropagation()}
          >
            <div className="message-icon sym-calendar">📅</div>
            <p className="message-text">{planYear}年{planMonth}月の目標・計画</p>

            {planViewMode === 'edit' ? (
              <>
                <div className="plan-picker">
                  <select
                    value={planYear}
                    onChange={e => setPlanYear(Number(e.target.value))}
                    className="plan-select"
                  >
                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                      <option key={y} value={y}>{y}年</option>
                    ))}
                  </select>
                  <select
                    value={planMonth}
                    onChange={e => setPlanMonth(Number(e.target.value))}
                    className="plan-select"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </select>
                </div>
                {planItems.length > 0 && (
                  <ul className="plan-list plan-list-edit">
                    {planItems.map((item, i) => (
                      <li key={i} className="plan-list-item">
                        <span>{item}</span>
                        <button type="button" className="plan-item-delete" onClick={() => handlePlanRemoveItem(i)} aria-label="削除">×</button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="plan-add-row">
                  <input
                    type="text"
                    className="plan-input"
                    placeholder={`目標を追加…`}
                    value={planEditInput}
                    onChange={e => setPlanEditInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePlanAdd()}
                  />
                  <button type="button" className="plan-btn plan-btn-add" onClick={handlePlanAdd}>追加</button>
                </div>
              </>
            ) : (
              <div className="plan-saved-wrap">
                {planItems.length ? (
                  <ul className="plan-list plan-list-view">
                    {planItems.map((item, i) => (
                      <li key={i} className="plan-list-item">
                        <span>{item}</span>
                        <button type="button" className="plan-item-delete" onClick={() => handlePlanRemoveItem(i)} aria-label="削除">削除</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="plan-saved">（保存された内容はありません）</div>
                )}
              </div>
            )}

            <div className="plan-actions">
              {planViewMode === 'edit' ? (
                <button className="plan-btn plan-btn-save" onClick={handlePlanSave}>保存して見返す</button>
              ) : (
                <button className="plan-btn plan-btn-edit" onClick={() => setPlanViewMode('edit')}>編集</button>
              )}
              <button className="plan-btn plan-btn-delete" onClick={handlePlanDelete}>削除</button>
              <button className="plan-btn plan-btn-back" onClick={handlePlanBack}>戻る</button>
            </div>
          </div>
        </div>
      )}

      {message && activeSymbol && message !== 'opal' && message !== 'calendar' && (
        <div className="message-overlay" onClick={handleClose}>
          <div
            className={`message-box message-symbol message-${message}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="message-icon">{activeSymbol.icon}</div>
            <p className="message-text">{activeSymbol.msg}</p>
            <p className="message-sub">{activeSymbol.sub}</p>
            <button className="message-close" onClick={handleClose}>閉じる</button>
          </div>
        </div>
      )}
    </>
  )
}

function drawResidual(ctx, ox, oy, endX, endY) {
  ctx.save()
  ctx.filter = 'blur(5px)'
  const res = ctx.createLinearGradient(ox, oy, endX, endY)
  res.addColorStop(0,    'rgba(180,235,255,0)')
  res.addColorStop(0.2,  'rgba(180,235,255,0.22)')
  res.addColorStop(0.85, 'rgba(200,240,255,0.35)')
  res.addColorStop(1,    'rgba(255,255,255,0.15)')
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(endX, endY)
  ctx.strokeStyle = res
  ctx.lineWidth = 12
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()

  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(endX, endY)
  ctx.strokeStyle = 'rgba(220,245,255,0.30)'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.stroke()
}
