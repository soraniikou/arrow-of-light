import { useRef, useEffect } from 'react'

// Global wind state — shifts slowly over time, shared across all bubbles
const wind = { vx: 0, target: 0.4, t: 0 }

export default function BubbleCanvas({ bubbles, onRemove }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({})
  const onRemoveRef = useRef(onRemove)
  useEffect(() => { onRemoveRef.current = onRemove }, [onRemove])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    bubbles.forEach(b => {
      if (!stateRef.current[b.id]) {
        const baseHue = b.hueShift
        const palette = [
          baseHue,
          (baseHue + 40  + Math.random() * 40)  % 360,
          (baseHue + 140 + Math.random() * 80)  % 360,
          (baseHue + 200 + Math.random() * 60)  % 360,
          (baseHue + 280 + Math.random() * 40)  % 360,
        ]
        const opacity = b.explosive
          ? 0.55 + Math.random() * 0.40   // more vivid on explosion
          : 0.28 + Math.random() * 0.52

        // Rotation: each bubble spins; explosion bubbles spin faster
        const spinSpeed = (Math.random() - 0.5) * (b.explosive ? 0.08 : 0.025)

        // Wind-drift multiplier — each bubble catches wind a little differently
        const windSensitivity = 0.6 + Math.random() * 0.8

        stateRef.current[b.id] = {
          // vy/vx from App already encode full directional launch vector
          vy: b.vy ?? -(5.25 + Math.random() * 8.25),
          vx: b.driftX ?? 0,
          cx: b.x,
          cy: b.y,
          alpha: 0,
          phase: Math.random() * 100,
          angle: Math.random() * Math.PI * 2,   // current rotation angle
          spinSpeed,
          windSensitivity,
          palette,
          opacity,
          born: Date.now() + (b.spawnDelay ?? 0),
          active: (b.spawnDelay ?? 0) === 0,
          removing: false,
          explosive: !!b.explosive,
        }
      }
    })

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const now = Date.now()
      const H = canvas.height

      // ── Advance global wind ──
      wind.t += 0.008
      // Wind target oscillates like gusts — slow sine with occasional sign flip
      wind.target = Math.sin(wind.t * 0.7) * 1.2 + Math.sin(wind.t * 0.23) * 0.5
      wind.vx += (wind.target - wind.vx) * 0.012   // smooth lag

      const ids = new Set(bubbles.map(b => b.id))
      Object.keys(stateRef.current).forEach(k => {
        if (!ids.has(Number(k))) delete stateRef.current[k]
      })

      bubbles.forEach(b => {
        const s = stateRef.current[b.id]
        if (!s) return

        if (!s.active) {
          if (now >= s.born) s.active = true
          else return
        }

        // ── Physics — full 2D ──
        const windForce = wind.vx * s.windSensitivity
        const sway = Math.sin(s.phase * 0.035) * (0.18 + Math.abs(wind.vx) * 0.12)

        s.cy += s.vy
        s.cx += s.vx + sway + windForce * 0.05
        s.phase++

        // Gravity + drag: pull toward upward drift over time
        const drag = s.explosive ? 0.10 : 0.06
        s.vy += drag          // gravity drag slows downward / accelerates upward settle
        s.vx *= 0.985         // horizontal friction

        // Spin
        s.angle += s.spinSpeed
        s.spinSpeed += wind.vx * 0.0004
        s.spinSpeed *= 0.998  // spin friction

        // Fade: ease-in over first 40px traveled in ANY direction, fade-out near screen edges
        const W = canvas.width
        const dx = s.cx - b.x
        const dy = s.cy - b.y
        const traveled = Math.sqrt(dx * dx + dy * dy)
        const fadeInZone = s.explosive ? 20 : 40
        const fadeIn = Math.min(1, traveled / fadeInZone)
        // Fade near all four edges
        const edgeMargin = b.radius + 20
        const fadeEdgeX = Math.min(
          Math.max(0, (s.cx - edgeMargin) / (edgeMargin * 2)),
          Math.max(0, (W - s.cx - edgeMargin) / (edgeMargin * 2)),
          1
        )
        const fadeEdgeY = Math.max(0, Math.min(1, (s.cy + b.radius) / (H * 0.12)))
        s.alpha = s.opacity * fadeIn * Math.min(fadeEdgeX * 3, 1) * fadeEdgeY

        // Remove when fully off-screen in any direction
        const offScreen =
          s.cy + b.radius < -20 ||
          s.cy - b.radius > H + 20 ||
          s.cx + b.radius < -20 ||
          s.cx - b.radius > W + 20
        if (offScreen && !s.removing) {
          s.removing = true
          onRemoveRef.current(b.id)
        }

        if (s.alpha > 0.005) {
          drawBubble(ctx, s.cx, s.cy, b.radius, s.alpha, s.palette, s.angle, s.explosive)
        }
      })

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [bubbles])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  )
}

function drawBubble(ctx, cx, cy, r, alpha, palette, angle, explosive) {
  if (r < 1 || alpha <= 0) return
  ctx.save()
  ctx.globalAlpha = alpha

  // Apply rotation around bubble centre
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.translate(-cx, -cy)

  // Extra outer glow for explosive bubbles
  if (explosive) {
    const glowR = r * 1.55
    const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, glowR)
    glow.addColorStop(0, `hsla(${palette[0]}, 90%, 85%, 0.22)`)
    glow.addColorStop(0.5, `hsla(${palette[2]}, 80%, 80%, 0.10)`)
    glow.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()
  }

  // Clip to sphere
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()

  // 1. Hollow glass base
  const voidGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  voidGrad.addColorStop(0,    `hsla(${palette[0]}, 30%, 20%, 0.04)`)
  voidGrad.addColorStop(0.75, `hsla(${palette[1]}, 40%, 30%, 0.0)`)
  voidGrad.addColorStop(1,    `hsla(${palette[2]}, 50%, 50%, 0.15)`)
  ctx.fillStyle = voidGrad
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  // 2. Iridescent shimmer layers — rotate with the bubble
  const t = Date.now() * 0.00045
  palette.forEach((h, i) => {
    // shimmer angle includes bubble's rotation angle for co-rotation effect
    const shimAngle = t * (0.3 + i * 0.15) + i * 1.26 + angle * 0.5
    const ox = Math.cos(shimAngle) * r * 0.4
    const oy = Math.sin(shimAngle * 0.8) * r * 0.4
    const sat = explosive ? 85 + (i % 3) * 8 : 70 + (i % 3) * 10
    const lit = explosive ? 70 + (i % 2) * 10 : 65 + (i % 2) * 12
    const sg = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r * 1.1)
    sg.addColorStop(0,    `hsla(${h}, ${sat}%, ${lit}%, ${explosive ? 0.55 : 0.45})`)
    sg.addColorStop(0.45, `hsla(${(h + 30) % 360}, ${sat - 5}%, ${lit + 5}%, 0.18)`)
    sg.addColorStop(1,    `hsla(${(h + 60) % 360}, ${sat}%, ${lit}%, 0.0)`)
    ctx.fillStyle = sg
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  })

  // 3. Rim colour glow
  const rimGrad = ctx.createRadialGradient(cx, cy, r * 0.68, cx, cy, r)
  rimGrad.addColorStop(0,   'rgba(0,0,0,0)')
  rimGrad.addColorStop(0.7, `hsla(${palette[1]}, 70%, 80%, 0.18)`)
  rimGrad.addColorStop(1,   `hsla(${palette[2]}, 80%, 88%, ${explosive ? 0.70 : 0.52})`)
  ctx.fillStyle = rimGrad
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  // 4. Inner depth shadow
  const shadowGrad = ctx.createRadialGradient(cx, cy + r * 0.55, 0, cx, cy + r * 0.3, r * 0.9)
  shadowGrad.addColorStop(0, `hsla(${palette[3]}, 50%, 15%, 0.18)`)
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = shadowGrad
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  // Unclip for outline + specular
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.translate(-cx, -cy)

  // 5. Rim outline
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = `hsla(${palette[0]}, 75%, 92%, ${explosive ? 0.75 : 0.55})`
  ctx.lineWidth = Math.max(0.8, r * 0.025)
  ctx.stroke()

  // Clip for specular highlights
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()

  // 6. Primary glare — rotates with bubble
  const hx1 = cx + Math.cos(angle + Math.PI * 1.25) * r * 0.32
  const hy1 = cy + Math.sin(angle + Math.PI * 1.25) * r * 0.32
  const spec1 = ctx.createRadialGradient(hx1, hy1, 0, hx1, hy1, r * 0.52)
  spec1.addColorStop(0,    'rgba(255,255,255,0.82)')
  spec1.addColorStop(0.35, 'rgba(255,255,255,0.28)')
  spec1.addColorStop(0.7,  'rgba(255,255,255,0.06)')
  spec1.addColorStop(1,    'rgba(255,255,255,0)')
  ctx.fillStyle = spec1
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  // 7. Micro glint
  const hx2 = cx + Math.cos(angle + Math.PI * 1.45) * r * 0.46
  const hy2 = cy + Math.sin(angle + Math.PI * 1.45) * r * 0.46
  const spec2 = ctx.createRadialGradient(hx2, hy2, 0, hx2, hy2, r * 0.14)
  spec2.addColorStop(0,   'rgba(255,255,255,0.95)')
  spec2.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  spec2.addColorStop(1,   'rgba(255,255,255,0)')
  ctx.fillStyle = spec2
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  // 8. Bottom bounce reflection
  const hx3 = cx + Math.cos(angle) * r * 0.3
  const hy3 = cy + Math.sin(angle) * r * 0.55
  const spec3 = ctx.createRadialGradient(hx3, hy3, 0, hx3, hy3, r * 0.32)
  spec3.addColorStop(0,   `hsla(${palette[1]}, 90%, 95%, 0.38)`)
  spec3.addColorStop(0.6, 'rgba(255,255,255,0.08)')
  spec3.addColorStop(1,   'rgba(255,255,255,0)')
  ctx.fillStyle = spec3
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  ctx.restore()
}
