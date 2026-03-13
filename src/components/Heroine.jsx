import { useEffect, useRef, useState } from 'react'
import ArrowShot from './ArrowShot'

export default function Heroine() {
  const wrapRef   = useRef(null)
  const canvasRef = useRef(null)
  const [arrowActive, setArrowActive] = useState(false)

  // Remove white/near-white background pixels and paint onto canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const img = new Image()
    img.src = '/heroine.png'
    img.onload = () => {
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = data.data
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2]
        const brightness = (r + g + b) / 3
        if (brightness > 235 && r > 220 && g > 220 && b > 220) {
          const fade = Math.max(0, (brightness - 235) / 20)
          d[i + 3] = Math.round(d[i + 3] * (1 - fade))
        }
      }
      ctx.putImageData(data, 0, 0)
    }
  }, [])

  // Parallax tilt on mouse move
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onMove = (e) => {
      const dx = (e.clientX / window.innerWidth  - 0.5) * 8
      const dy = (e.clientY / window.innerHeight - 0.5) * 4
      // Apply tilt while keeping the translateX(-50%) centering
      el.style.transform = `translateX(-50%) rotateY(${dx}deg) rotateX(${-dy}deg)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const handleArrowClick = (e) => {
    e.stopPropagation()
    setArrowActive(true)
  }

  return (
    <>
      <div className="heroine-wrap" ref={wrapRef}>
        <div className="heroine-cloud-glow" />

        {/* Heroine image rendered on canvas (white background removed) */}
        <canvas
          ref={canvasRef}
          className="heroine-img"
          aria-label="heroine"
        />

        {/*
          Arrow hit-zone button — always rendered.
          Positioned over the bow & arrow in the upper-right of the image.
          pointer-events: all overrides the parent's none.
        */}
        <button
          className="heroine-arrow-btn"
          onClick={handleArrowClick}
          aria-label="光の矢を放つ"
        >
          <span className="heroine-arrow-glow" />
        </button>

        {/* Persistent click hint near the bow hand */}
        <div className="heroine-arrow-hint">
          <img src="/yumi2.png" style={{width:'160px',marginRight:'6px',marginBottom:'200px'}} />
        </div>
      </div>

      {arrowActive && (
        <ArrowShot onDismiss={() => setArrowActive(false)} />
      )}
    </>
  )
}
