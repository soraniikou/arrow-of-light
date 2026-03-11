import { useRef, useEffect } from 'react'

// Perspective road of white light — hand front to deep vanishing point
export default function ArrowCanvas() {
  const canvasRef = useRef(null)

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

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      drawRoad(ctx, W, H)

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,          // behind bubbles (zIndex 10) but above gradient (0)
      }}
    />
  )
}

// Build a curved road shape using quadratic bezier edges.
// The road curves gently to the right (~20°) as it recedes into the distance.
function roadPath(W, H) {
  // Vanishing point — shifted right to imply a left-curving road viewed from slightly left
  const vpX = W * 0.62
  const vpY = H * 0.40

  // Foreground road bottom — wide, centred slightly left so the bend reads naturally
  const foreLeft  = { x: W * 0.05, y: H }
  const foreRight = { x: W * 0.95, y: H }

  // Control points for the bezier edges — pulling the edges toward the curve
  // Left edge curves inward (right), right edge curves inward (left) with the bend
  const ctrlLeft  = { x: W * 0.30, y: H * 0.68 }
  const ctrlRight = { x: W * 0.82, y: H * 0.62 }

  // Vanishing ends — both edges converge to a narrow gap around vpX
  const vanLeft  = { x: vpX - 2, y: vpY }
  const vanRight = { x: vpX + 2, y: vpY }

  return { vpX, vpY, foreLeft, foreRight, ctrlLeft, ctrlRight, vanLeft, vanRight }
}

function drawRoad(ctx, W, H) {
  const { vpX, vpY, foreLeft, foreRight, ctrlLeft, ctrlRight, vanLeft, vanRight } = roadPath(W, H)

  ctx.save()

  // ── Build the curved road outline ──
  ctx.beginPath()
  ctx.moveTo(vanLeft.x, vanLeft.y)
  // Left edge: bezier from vanishing → foreground left
  ctx.quadraticCurveTo(ctrlLeft.x, ctrlLeft.y, foreLeft.x, foreLeft.y)
  // Bottom edge
  ctx.lineTo(foreRight.x, foreRight.y)
  // Right edge: bezier back to vanishing
  ctx.quadraticCurveTo(ctrlRight.x, ctrlRight.y, vanRight.x, vanRight.y)
  ctx.closePath()

  // Road surface fill — radial glow from vanishing point
  const roadGrad = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, H * 0.78)
  roadGrad.addColorStop(0,    'rgba(255,255,255,0.70)')
  roadGrad.addColorStop(0.10, 'rgba(240,248,255,0.42)')
  roadGrad.addColorStop(0.32, 'rgba(200,230,255,0.16)')
  roadGrad.addColorStop(0.60, 'rgba(160,210,255,0.06)')
  roadGrad.addColorStop(1,    'rgba(100,170,255,0.0)')
  ctx.fillStyle = roadGrad
  ctx.fill()

  // ── Soft edge glow strips along both curved edges ──
  // Left edge glow
  ;(() => {
    const eg = ctx.createLinearGradient(foreLeft.x, H, foreLeft.x + W * 0.10, H)
    eg.addColorStop(0, 'rgba(200,235,255,0.32)')
    eg.addColorStop(1, 'rgba(200,235,255,0)')
    ctx.beginPath()
    ctx.moveTo(vanLeft.x, vanLeft.y)
    ctx.quadraticCurveTo(ctrlLeft.x, ctrlLeft.y, foreLeft.x, foreLeft.y)
    ctx.lineTo(foreLeft.x + W * 0.10, foreLeft.y)
    ctx.quadraticCurveTo(ctrlLeft.x + W * 0.09, ctrlLeft.y, vanLeft.x + W * 0.012, vanLeft.y)
    ctx.closePath()
    ctx.fillStyle = eg
    ctx.fill()
  })()

  // Right edge glow
  ;(() => {
    const eg = ctx.createLinearGradient(foreRight.x, H, foreRight.x - W * 0.10, H)
    eg.addColorStop(0, 'rgba(200,235,255,0.32)')
    eg.addColorStop(1, 'rgba(200,235,255,0)')
    ctx.beginPath()
    ctx.moveTo(vanRight.x, vanRight.y)
    ctx.quadraticCurveTo(ctrlRight.x, ctrlRight.y, foreRight.x, foreRight.y)
    ctx.lineTo(foreRight.x - W * 0.10, foreRight.y)
    ctx.quadraticCurveTo(ctrlRight.x - W * 0.09, ctrlRight.y, vanRight.x - W * 0.012, vanRight.y)
    ctx.closePath()
    ctx.fillStyle = eg
    ctx.fill()
  })()

  // ── Horizon bloom at vanishing point ──
  const horizonGlow = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, W * 0.30)
  horizonGlow.addColorStop(0,    'rgba(255,255,255,0.58)')
  horizonGlow.addColorStop(0.15, 'rgba(220,242,255,0.30)')
  horizonGlow.addColorStop(0.40, 'rgba(170,220,255,0.10)')
  horizonGlow.addColorStop(1,    'rgba(100,180,255,0.0)')
  ctx.beginPath()
  ctx.ellipse(vpX, vpY, W * 0.30, H * 0.16, 0, 0, Math.PI * 2)
  ctx.fillStyle = horizonGlow
  ctx.fill()

  ctx.restore()
}
