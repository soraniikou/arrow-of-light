import { useEffect, useRef, useState } from 'react'
import ArrowShot from './ArrowShot'

export default function Heroine() {
  const wrapRef   = useRef(null)
  const [arrowActive, setArrowActive] = useState(false)

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
          <img src="/golden-bow-arrow.svg" alt="" className="heroine-arrow-hint-icon" />
          <span>弓をクリック</span>
        </div>
      </div>

      {arrowActive && (
        <ArrowShot onDismiss={() => setArrowActive(false)} />
      )}
    </>
  )
}
