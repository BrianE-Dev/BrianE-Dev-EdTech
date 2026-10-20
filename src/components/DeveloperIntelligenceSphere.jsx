import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function pointsOnSphere(count) {
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / (count - 1)) * 2
    const ring = Math.sqrt(1 - y * y)
    const angle = Math.PI * (3 - Math.sqrt(5)) * index
    return new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring)
  })
}

export default function DeveloperIntelligenceSphere() {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    let renderer
    let resizeObserver
    let visibilityObserver
    let frame = 0
    let visible = false
    let disposed = false
    let startedAt = 0
    let width = 1
    let height = 1
    const pointer = new THREE.Vector2()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50)
    camera.position.set(0, 0, 7.2)

    const root = new THREE.Group()
    scene.add(root)
    const cyan = 0x06b6d4
    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.42, 2),
      new THREE.MeshBasicMaterial({ color: cyan, wireframe: true, transparent: true, opacity: 0.44 }),
    )
    root.add(wire)

    const nodes = pointsOnSphere(92)
    const nodeGeometry = new THREE.BufferGeometry().setFromPoints(nodes)
    const nodeMaterial = new THREE.PointsMaterial({ color: 0x42e8ff, size: 0.035, transparent: true, opacity: 0.9, sizeAttenuation: true })
    const nodeCloud = new THREE.Points(nodeGeometry, nodeMaterial)
    root.add(nodeCloud)

    const segments = []
    nodes.forEach((point, index) => {
      const neighbors = nodes.map((other, otherIndex) => ({ other, otherIndex, distance: point.distanceToSquared(other) }))
        .filter((item) => item.otherIndex !== index)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
      neighbors.forEach(({ other, otherIndex }) => {
        if (otherIndex > index) segments.push(point.x, point.y, point.z, other.x, other.y, other.z)
      })
    })
    const edgeGeometry = new THREE.BufferGeometry()
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3))
    const edgeMaterial = new THREE.LineBasicMaterial({ color: cyan, transparent: true, opacity: 0.18 })
    root.add(new THREE.LineSegments(edgeGeometry, edgeMaterial))

    const particlePositions = new Float32Array(54)
    for (let index = 0; index < 18; index += 1) {
      const point = pointsOnSphere(19)[index + 1].multiplyScalar(1.72 + (index % 3) * 0.12)
      particlePositions.set([point.x, point.y, point.z], index * 3)
    }
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const particleMaterial = new THREE.PointsMaterial({ color: 0xc9fbff, size: 0.045, transparent: true, opacity: 0.75, sizeAttenuation: true })
    root.add(new THREE.Points(particleGeometry, particleMaterial))

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setClearColor(0x0d1929, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.domElement.className = 'developer-intelligence-sphere'
      renderer.domElement.setAttribute('aria-hidden', 'true')
      host.appendChild(renderer.domElement)
    } catch {
      host.dataset.fallback = 'true'
      return () => {
        disposed = true
        nodeGeometry.dispose(); nodeMaterial.dispose(); wire.geometry.dispose(); wire.material.dispose()
        edgeGeometry.dispose(); edgeMaterial.dispose(); particleGeometry.dispose(); particleMaterial.dispose()
      }
    }

    function resize() {
      const bounds = host.getBoundingClientRect()
      width = Math.max(bounds.width, 1)
      height = Math.max(bounds.height, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      if (!visible) renderer.render(scene, camera)
    }

    function render(now) {
      if (disposed || !visible) return
      const elapsed = reducedMotion.matches ? 0 : (now - startedAt) / 1000
      const progress = reducedMotion.matches ? 1 : Math.min(elapsed / 1.4, 1)
      const eased = 1 - ((1 - progress) ** 3)
      root.scale.setScalar(0.72 + eased * 0.28)
      root.rotation.y = reducedMotion.matches ? 0 : elapsed * 0.12 + pointer.x * 0.16
      root.rotation.x = reducedMotion.matches ? 0 : pointer.y * 0.11 + Math.sin(elapsed * 0.35) * 0.025
      root.visible = true
      wire.material.opacity = 0.44 * eased
      nodeMaterial.opacity = 0.9 * eased
      edgeMaterial.opacity = 0.18 * eased
      particleMaterial.opacity = 0.75 * eased
      camera.position.x += (pointer.x * 0.18 - camera.position.x) * 0.035
      camera.position.y += (-pointer.y * 0.12 - camera.position.y) * 0.035
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
      if (!reducedMotion.matches) frame = window.requestAnimationFrame(render)
    }

    function start() {
      if (disposed || visible) return
      visible = true
      startedAt = performance.now()
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(render)
    }

    function stop() {
      visible = false
      window.cancelAnimationFrame(frame)
      frame = 0
    }

    function onPointerMove(event) {
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2)
    }
    function onPointerLeave() { pointer.set(0, 0) }
    function onMotionChange() {
      if (!visible) return
      window.cancelAnimationFrame(frame)
      if (reducedMotion.matches) render(performance.now())
      else { startedAt = performance.now() - 1400; frame = window.requestAnimationFrame(render) }
    }
    function onContextLost(event) { event.preventDefault(); stop(); host.dataset.fallback = 'true' }

    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerleave', onPointerLeave)
    renderer.domElement.addEventListener('webglcontextlost', onContextLost)
    reducedMotion.addEventListener('change', onMotionChange)
    resize()
    if ('IntersectionObserver' in window) {
      visibilityObserver = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) start()
        else if (visible) stop()
      }, { threshold: 0.01, rootMargin: '100px 0px' })
      visibilityObserver.observe(host)
    } else start()

    return () => {
      disposed = true
      stop()
      visibilityObserver?.disconnect()
      resizeObserver?.disconnect()
      reducedMotion.removeEventListener('change', onMotionChange)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      root.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
          else object.material.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={hostRef} className="developer-sphere-host" aria-hidden="true">
    <div className="developer-sphere-fallback"><span/><i/><i/><i/></div>
  </div>
}
