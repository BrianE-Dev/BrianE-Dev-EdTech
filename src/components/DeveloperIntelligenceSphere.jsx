import { useEffect, useRef } from 'react'

const cyan = '#06b6d4'

function makePoints(count = 92) {
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / (count - 1)) * 2
    const radius = Math.sqrt(1 - y * y)
    const angle = Math.PI * (3 - Math.sqrt(5)) * index
    return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, phase: (index * 0.73) % (Math.PI * 2) }
  })
}

export default function DeveloperIntelligenceSphere({ active = true }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const points = makePoints()
    const links = []
    for (let i = 0; i < points.length; i += 1) {
      const nearest = points.map((point, index) => ({ index, distance: Math.hypot(point.x - points[i].x, point.y - points[i].y, point.z - points[i].z) }))
        .filter((point) => point.index !== i).sort((a, b) => a.distance - b.distance).slice(0, 3)
      nearest.forEach(({ index }) => { if (index > i) links.push([i, index]) })
    }
    const particles = Array.from({ length: 18 }, (_, index) => ({ angle: index * 2.4, radius: 1.13 + (index % 4) * 0.07, y: Math.sin(index * 8.1) * 0.72, phase: index * 0.31 }))
    const pointer = { x: 0, y: 0 }
    let width = 0
    let height = 0
    let frame = 0
    let startedAt = 0
    let running = false
    let disposed = false
    let resizeObserver

    function resize() {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      width = Math.max(bounds.width, 1)
      height = Math.max(bounds.height, 1)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      if (!running) draw(performance.now())
    }

    function draw(now) {
      if (disposed) return
      context.clearRect(0, 0, width, height)
      const elapsed = reducedMotion.matches ? 1 : (now - startedAt) / 1000
      const entrance = reducedMotion.matches ? 1 : Math.min(elapsed / 1.5, 1)
      const eased = 1 - ((1 - entrance) ** 3)
      const radius = Math.min(width, height) * 0.34 * eased
      const rotation = reducedMotion.matches ? 0 : elapsed * 0.18
      const tilt = pointer.x * 0.12
      const centerX = width * (0.5 + pointer.x * 0.035)
      const centerY = height * (0.5 + pointer.y * 0.035)
      const projected = points.map((point) => {
        const x = point.x * Math.cos(rotation) - point.z * Math.sin(rotation)
        const z = point.x * Math.sin(rotation) + point.z * Math.cos(rotation)
        const y = point.y * Math.cos(tilt) - z * Math.sin(tilt)
        const depth = point.y * Math.sin(tilt) + z * Math.cos(tilt)
        const perspective = 1 / (1.65 - depth * 0.34)
        return { x: centerX + x * radius * perspective, y: centerY + y * radius * perspective, depth, perspective }
      })

      context.save()
      context.globalAlpha = eased
      const glow = context.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius * 1.2)
      glow.addColorStop(0, 'rgba(6,182,212,0.1)')
      glow.addColorStop(0.7, 'rgba(6,182,212,0.025)')
      glow.addColorStop(1, 'rgba(6,182,212,0)')
      context.fillStyle = glow
      context.beginPath(); context.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2); context.fill()

      context.lineWidth = 0.7
      context.strokeStyle = cyan
      links.forEach(([a, b]) => {
        const first = projected[a]
        const second = projected[b]
        const depthAlpha = Math.max(0.08, (first.depth + second.depth + 2) / 4) * 0.48
        context.globalAlpha = eased * depthAlpha
        context.beginPath(); context.moveTo(first.x, first.y); context.lineTo(second.x, second.y); context.stroke()
      })
      projected.forEach((point, index) => {
        const pulse = 0.62 + Math.sin(elapsed * 1.25 + points[index].phase) * 0.22
        const size = (1.1 + pulse * 1.15) * point.perspective
        context.globalAlpha = eased * Math.max(0.22, (point.depth + 1.6) / 2.6)
        context.fillStyle = cyan
        context.beginPath(); context.arc(point.x, point.y, size, 0, Math.PI * 2); context.fill()
      })
      particles.forEach((particle) => {
        const angle = particle.angle + (reducedMotion.matches ? 0 : elapsed * (0.035 + (particle.phase % 0.04)))
        const x = centerX + Math.cos(angle) * radius * particle.radius
        const y = centerY + (particle.y + Math.sin(angle * 0.55) * 0.08) * radius
        const twinkle = 0.3 + (Math.sin(elapsed * 1.7 + particle.phase) + 1) * 0.26
        context.globalAlpha = eased * twinkle
        context.fillStyle = '#ffffff'
        context.beginPath(); context.arc(x, y, 0.8 + twinkle * 1.2, 0, Math.PI * 2); context.fill()
      })
      context.restore()
    }

    function animate(now) {
      if (!running || disposed) return
      draw(now)
      frame = window.requestAnimationFrame(animate)
    }

    function start() {
      window.cancelAnimationFrame(frame)
      running = true
      startedAt = performance.now()
      frame = window.requestAnimationFrame(animate)
    }

    function stop() {
      running = false
      window.cancelAnimationFrame(frame)
      frame = 0
    }

    function onPointerMove(event) {
      const bounds = canvas.getBoundingClientRect()
      pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    }
    function onPointerLeave() { pointer.x = 0; pointer.y = 0 }
    function onMotionChange() { if (active) start(); else { stop(); draw(performance.now()) } }

    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)
    reducedMotion.addEventListener('change', onMotionChange)
    resize()
    if (active) start()

    return () => {
      disposed = true
      stop()
      resizeObserver?.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      reducedMotion.removeEventListener('change', onMotionChange)
    }
  }, [active])

  return <canvas ref={canvasRef} className="developer-intelligence-sphere" aria-hidden="true" />
}
