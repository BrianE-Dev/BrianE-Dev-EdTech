import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const blockColors = [0x06b6d4, 0x22d3ee, 0x6366f1, 0xa78bfa, 0x14b8a6, 0x67e8f9, 0x818cf8, 0x2dd4bf]

export default function CurriculumAssembly() {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30)
    camera.position.set(0, 0, 6.4)
    const group = new THREE.Group()
    scene.add(group)

    const blocks = blockColors.map((color, index) => {
      const row = Math.floor(index / 4)
      const column = index % 4
      const target = new THREE.Vector3((column - 1.5) * 0.7, (0.5 - row) * 0.7, 0)
      const angle = index * 2.399
      const radius = 1.9 + (index % 3) * 0.22
      const scatter = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72, (index % 2 ? 0.4 : -0.4))
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96 })
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.08), material)
      block.position.copy(scatter)
      block.rotation.z = (index % 2 ? 1 : -1) * (0.45 + (index % 4) * 0.18)
      block.userData = { target, scatter, scatterRotation: block.rotation.z }
      const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xd8fbff, transparent: true, opacity: 0.55 })
      block.add(new THREE.LineSegments(new THREE.EdgesGeometry(block.geometry), edgeMaterial))
      group.add(block)
      return block
    })

    let renderer
    let resizeObserver
    let visibilityObserver
    let usingWindowResize = false
    let frame = 0
    let inside = false
    let disposed = false
    let transition = 0
    let previousTime = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.domElement.className = 'curriculum-assembly-canvas'
      renderer.domElement.setAttribute('aria-hidden', 'true')
      host.appendChild(renderer.domElement)
    } catch {
      host.dataset.fallback = 'true'
      return () => {
        disposed = true
        group.traverse((object) => {
          object.geometry?.dispose()
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
          else object.material?.dispose()
        })
      }
    }

    function resize() {
      const bounds = host.getBoundingClientRect()
      const width = Math.max(bounds.width, 1)
      const height = Math.max(bounds.height, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      if (!frame) renderer.render(scene, camera)
    }

    function applyProgress(progress) {
      const eased = progress * progress * (3 - 2 * progress)
      blocks.forEach((block) => {
        const { target, scatter, scatterRotation } = block.userData
        block.position.lerpVectors(scatter, target, eased)
        block.rotation.z = scatterRotation * (1 - eased)
      })
      renderer.render(scene, camera)
    }

    function render(now) {
      if (disposed) return
      const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 0.016
      previousTime = now
      const destination = inside ? 1 : 0
      const duration = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 2.8)
      transition += (destination - transition) * duration
      if (Math.abs(destination - transition) < 0.004) transition = destination
      applyProgress(transition)
      if ((inside || transition !== destination) && !reducedMotion.matches) frame = window.requestAnimationFrame(render)
      else frame = 0
    }

    function setInside(value) {
      inside = value
      if (reducedMotion.matches) {
        transition = value ? 1 : 0
        applyProgress(transition)
        return
      }
      if (!frame) {
        previousTime = 0
        frame = window.requestAnimationFrame(render)
      }
    }

    function onMotionChange() {
      if (reducedMotion.matches) {
        window.cancelAnimationFrame(frame)
        frame = 0
        transition = inside ? 1 : 0
        applyProgress(transition)
      } else if (!frame) setInside(inside)
    }

    if (typeof window.ResizeObserver === 'function') {
      resizeObserver = new window.ResizeObserver(resize)
      resizeObserver.observe(host)
    } else {
      usingWindowResize = true
      window.addEventListener('resize', resize)
    }
    reducedMotion.addEventListener('change', onMotionChange)
    resize()

    if (typeof window.IntersectionObserver === 'function') {
      visibilityObserver = new window.IntersectionObserver((entries) => {
        const entry = entries?.[0]
        if (entry) setInside(entry.isIntersecting)
      }, { threshold: 0.01 })
      visibilityObserver.observe(host)
    } else setInside(true)

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      visibilityObserver?.disconnect()
      resizeObserver?.disconnect()
      if (usingWindowResize) window.removeEventListener('resize', resize)
      reducedMotion.removeEventListener('change', onMotionChange)
      group.traverse((object) => {
        object.geometry?.dispose()
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
        else object.material?.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={hostRef} className="curriculum-assembly-host" aria-hidden="true">
    <div className="curriculum-assembly-fallback">{blockColors.map((color) => <i key={color}/>)}</div>
  </div>
}
