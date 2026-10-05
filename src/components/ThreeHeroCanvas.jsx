import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RotateCw, Eye, Sparkles, Layers } from 'lucide-react'

export default function ThreeHeroCanvas() {
  const containerRef = useRef(null)
  const [wireframeMode, setWireframeMode] = useState(false)
  const [particleSpeed, setParticleSpeed] = useState(1)
  const [viewMode, setViewMode] = useState('orbit') // 'orbit' | 'explode' | 'rings'

  const stateRef = useRef({
    wireframe: false,
    speed: 1,
    viewMode: 'orbit',
    isDragging: false,
    prevMousePos: { x: 0, y: 0 },
    rotationVelocity: { x: 0.003, y: 0.005 },
    manualRotation: { x: 0.3, y: 0 },
  })

  // Sync state ref
  useEffect(() => {
    stateRef.current.wireframe = wireframeMode
    stateRef.current.speed = particleSpeed
    stateRef.current.viewMode = viewMode
  }, [wireframeMode, particleSpeed, viewMode])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene()
    // Soft deep cosmic fog
    scene.fog = new THREE.FogExp2(0x030712, 0.04)

    const width = container.clientWidth || 600
    const height = container.clientHeight || 500
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(0, 1.2, 7.5)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.3
    container.appendChild(renderer.domElement)

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    const mainLight = new THREE.DirectionalLight(0x00f0ff, 2.5)
    mainLight.position.set(5, 8, 5)
    scene.add(mainLight)

    const purpleLight = new THREE.DirectionalLight(0xec4899, 2.0)
    purpleLight.position.set(-6, -4, 4)
    scene.add(purpleLight)

    const coreLight = new THREE.PointLight(0x008f8b, 4, 15)
    coreLight.position.set(0, 0, 0)
    scene.add(coreLight)

    // 3. Materials
    const tealCapMat = new THREE.MeshStandardMaterial({
      color: 0x008f8b,
      metalness: 0.25,
      roughness: 0.15,
      emissive: 0x004d49,
      emissiveIntensity: 0.2,
    })

    const whiteCapMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.1,
      roughness: 0.2,
    })

    const maroonCapMat = new THREE.MeshStandardMaterial({
      color: 0x5a1836,
      metalness: 0.3,
      roughness: 0.2,
      emissive: 0x2e0618,
      emissiveIntensity: 0.3,
    })

    const goldCapMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.4,
      roughness: 0.15,
      emissive: 0x78350f,
      emissiveIntensity: 0.2,
    })

    const holoRingMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.8,
      roughness: 0.1,
      emissive: 0x008f8b,
      emissiveIntensity: 0.6,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    })

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    })

    // Root Group for interactive rotation
    const mainGroup = new THREE.Group()
    scene.add(mainGroup)

    // Helper: Create dual-colored 3D Capsule
    function createCapsule(matTop, matBottom, radius = 0.45, length = 0.8) {
      const group = new THREE.Group()

      // Top Half
      const topGeo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
      const topMesh = new THREE.Mesh(topGeo, matTop)
      topMesh.position.y = length / 2
      group.add(topMesh)

      // Cylinder Body Top
      const bodyTopGeo = new THREE.CylinderGeometry(radius, radius, length / 2, 32)
      const bodyTop = new THREE.Mesh(bodyTopGeo, matTop)
      bodyTop.position.y = length / 4
      group.add(bodyTop)

      // Cylinder Body Bottom
      const bodyBottomGeo = new THREE.CylinderGeometry(radius, radius, length / 2, 32)
      const bodyBottom = new THREE.Mesh(bodyBottomGeo, matBottom)
      bodyBottom.position.y = -length / 4
      group.add(bodyBottom)

      // Bottom Half
      const botGeo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
      const botMesh = new THREE.Mesh(botGeo, matBottom)
      botMesh.position.y = -length / 2
      group.add(botMesh)

      return group
    }

    // Helper: Create Pharmacy Round Tablet with center division
    function createTablet(color = 0x38bdf8, radius = 0.55, height = 0.22) {
      const group = new THREE.Group()
      const mat = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.2,
        roughness: 0.25,
      })
      const geo = new THREE.CylinderGeometry(radius, radius, height, 32)
      const mesh = new THREE.Mesh(geo, mat)
      group.add(mesh)

      // Score line across tablet
      const lineGeo = new THREE.BoxGeometry(radius * 1.8, height * 1.05, 0.04)
      const lineMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
      const lineMesh = new THREE.Mesh(lineGeo, lineMat)
      group.add(lineMesh)

      return group
    }

    // 4. Build 3D Capsule Cluster & Orbits
    // Hero Central Capsule
    const heroCapsule = createCapsule(tealCapMat, whiteCapMat, 0.65, 1.2)
    heroCapsule.rotation.z = Math.PI / 3.5
    heroCapsule.rotation.x = Math.PI / 6
    mainGroup.add(heroCapsule)

    // Orbiting Satellite Capsules
    const satellite1 = createCapsule(maroonCapMat, whiteCapMat, 0.35, 0.6)
    satellite1.position.set(2.4, 0.8, -0.6)
    mainGroup.add(satellite1)

    const satellite2 = createCapsule(goldCapMat, tealCapMat, 0.38, 0.7)
    satellite2.position.set(-2.2, -1.0, 0.8)
    mainGroup.add(satellite2)

    // Tablets
    const tablet1 = createTablet(0x06b6d4, 0.5, 0.2)
    tablet1.position.set(1.6, -1.6, 1.2)
    tablet1.rotation.x = 0.8
    tablet1.rotation.y = 0.4
    mainGroup.add(tablet1)

    const tablet2 = createTablet(0xa855f7, 0.45, 0.18)
    tablet2.position.set(-1.8, 1.6, -1.0)
    tablet2.rotation.x = -0.5
    tablet2.rotation.z = 0.7
    mainGroup.add(tablet2)

    // Holographic Orbit Rings (DNA / Cloud Sync Data Torus)
    const ring1Geo = new THREE.TorusGeometry(1.85, 0.035, 16, 100)
    const ring1 = new THREE.Mesh(ring1Geo, holoRingMat)
    ring1.rotation.x = Math.PI / 2.3
    ring1.rotation.y = Math.PI / 5
    mainGroup.add(ring1)

    const ring2Geo = new THREE.TorusGeometry(2.6, 0.025, 16, 100)
    const ring2 = new THREE.Mesh(ring2Geo, holoRingMat)
    ring2.rotation.x = -Math.PI / 3
    ring2.rotation.z = Math.PI / 4
    mainGroup.add(ring2)

    // Outer Gyro Ring
    const ring3Geo = new THREE.TorusGeometry(3.3, 0.02, 16, 120)
    const ring3Mat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    })
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat)
    mainGroup.add(ring3)

    // 5. Ambient Floating Star / Medical Node Field
    const particleCount = 450
    const particleGeo = new THREE.BufferGeometry()
    const posArray = new Float32Array(particleCount * 3)
    const colArray = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 14
      posArray[i + 1] = (Math.random() - 0.5) * 12
      posArray[i + 2] = (Math.random() - 0.5) * 14

      // Cyan to Emerald to Violet colors
      if (Math.random() > 0.5) {
        colArray[i] = 0.0
        colArray[i + 1] = 0.94
        colArray[i + 2] = 0.8
      } else {
        colArray[i] = 0.65
        colArray[i + 1] = 0.33
        colArray[i + 2] = 0.97
      }
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colArray, 3))

    const particleMat = new THREE.PointsMaterial({
      size: 0.055,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    })

    const particles = new THREE.Points(particleGeo, particleMat)
    scene.add(particles)

    // Mouse Interaction Handlers
    let isMouseDown = false
    let previousMouseX = 0
    let previousMouseY = 0

    const onMouseDown = (e) => {
      isMouseDown = true
      previousMouseX = e.clientX
      previousMouseY = e.clientY
    }

    const onMouseMove = (e) => {
      if (!isMouseDown) {
        // Subtle Parallax Tilt on Hover
        const rect = container.getBoundingClientRect()
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
        stateRef.current.rotationVelocity.x = mouseY * 0.003
        stateRef.current.rotationVelocity.y = mouseX * 0.004
        return
      }

      const deltaX = e.clientX - previousMouseX
      const deltaY = e.clientY - previousMouseY

      stateRef.current.manualRotation.y += deltaX * 0.008
      stateRef.current.manualRotation.x += deltaY * 0.008

      previousMouseX = e.clientX
      previousMouseY = e.clientY
    }

    const onMouseUp = () => {
      isMouseDown = false
    }

    const domElem = renderer.domElement
    domElem.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    // Touch Support
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isMouseDown = true
        previousMouseX = e.touches[0].clientX
        previousMouseY = e.touches[0].clientY
      }
    }
    const onTouchMove = (e) => {
      if (isMouseDown && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - previousMouseX
        const deltaY = e.touches[0].clientY - previousMouseY
        stateRef.current.manualRotation.y += deltaX * 0.008
        stateRef.current.manualRotation.x += deltaY * 0.008
        previousMouseX = e.touches[0].clientX
        previousMouseY = e.touches[0].clientY
      }
    }
    const onTouchEnd = () => {
      isMouseDown = false
    }

    domElem.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width
        const newHeight = entry.contentRect.height
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight
          camera.updateProjectionMatrix()
          renderer.setSize(newWidth, newHeight)
        }
      }
    })
    resizeObserver.observe(container)

    // 6. Animation Loop
    let animationFrameId
    let clock = new THREE.Clock()

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      const elapsedTime = clock.getElapsedTime()
      const speed = stateRef.current.speed

      // Wireframe toggle handling
      const isWire = stateRef.current.wireframe
      tealCapMat.wireframe = isWire
      whiteCapMat.wireframe = isWire
      maroonCapMat.wireframe = isWire
      goldCapMat.wireframe = isWire

      // Smooth Rotation Interpolation
      mainGroup.rotation.y += (stateRef.current.manualRotation.y + stateRef.current.rotationVelocity.y * 10 - mainGroup.rotation.y) * 0.05
      mainGroup.rotation.x += (stateRef.current.manualRotation.x + stateRef.current.rotationVelocity.x * 10 - mainGroup.rotation.x) * 0.05

      // Continuous Idle Rotation
      stateRef.current.manualRotation.y += 0.0025 * speed

      // Hero Capsule Harmonic Floating
      heroCapsule.position.y = Math.sin(elapsedTime * 1.5 * speed) * 0.15
      heroCapsule.rotation.z += 0.004 * speed
      heroCapsule.rotation.y += 0.006 * speed

      // Satellites Orbital Motion
      const orbit1Time = elapsedTime * 0.8 * speed
      satellite1.position.x = Math.cos(orbit1Time) * 2.5
      satellite1.position.z = Math.sin(orbit1Time) * 1.8
      satellite1.position.y = Math.sin(elapsedTime * 2 * speed) * 0.4 + 0.6
      satellite1.rotation.x += 0.015 * speed
      satellite1.rotation.y += 0.02 * speed

      const orbit2Time = elapsedTime * 0.65 * speed + Math.PI
      satellite2.position.x = Math.cos(orbit2Time) * 2.3
      satellite2.position.z = Math.sin(orbit2Time) * 2.0
      satellite2.position.y = Math.cos(elapsedTime * 1.7 * speed) * 0.3 - 0.7
      satellite2.rotation.z += 0.012 * speed
      satellite2.rotation.x += 0.018 * speed

      // Tablets floating
      tablet1.position.y = Math.sin(elapsedTime * 1.2 * speed + 1) * 0.3 - 1.4
      tablet1.rotation.y += 0.01 * speed

      tablet2.position.y = Math.cos(elapsedTime * 1.4 * speed + 2) * 0.3 + 1.4
      tablet2.rotation.x += 0.008 * speed

      // Rings Rotation
      ring1.rotation.z += 0.008 * speed
      ring1.rotation.x += 0.004 * speed

      ring2.rotation.z -= 0.006 * speed
      ring2.rotation.y += 0.005 * speed

      ring3.rotation.y += 0.003 * speed
      ring3.rotation.x -= 0.002 * speed

      // Particles subtle drift
      particles.rotation.y = elapsedTime * 0.03 * speed

      // ViewMode adjustments (Explode view vs compact)
      const targetExplode = stateRef.current.viewMode === 'explode' ? 1.7 : 1.0
      satellite1.scale.lerp(new THREE.Vector3(targetExplode, targetExplode, targetExplode), 0.05)
      satellite2.scale.lerp(new THREE.Vector3(targetExplode, targetExplode, targetExplode), 0.05)
      ring2.scale.lerp(new THREE.Vector3(targetExplode, targetExplode, targetExplode), 0.05)

      renderer.render(scene, camera)
    }

    animate()

    // 7. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      domElem.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      domElem.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)

      // Dispose Geometries and Materials
      scene.traverse((obj) => {
        if (obj.isMesh || obj.isPoints) {
          if (obj.geometry) obj.geometry.dispose()
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose())
            } else {
              obj.material.dispose()
            }
          }
        }
      })

      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div className="relative w-full h-full min-h-[460px] md:min-h-[580px] rounded-3xl overflow-hidden bg-gradient-to-b from-slate-950/80 via-[#06101e]/90 to-slate-950/95 border border-cyan-500/20 shadow-2xl shadow-cyan-950/50 flex flex-col">
      {/* 3D Canvas Mount Point */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 3D Scene Interactive Control Overlay */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 text-cyan-300 text-xs font-semibold shadow-lg pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Interactive 3D Engine • WebGL</span>
        </div>

        {/* 3D Control Action Pills */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setWireframeMode(!wireframeMode)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 backdrop-blur-md ${
              wireframeMode
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-md shadow-cyan-500/30'
                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:border-cyan-500/50 hover:text-white'
            }`}
            title="Toggle Wireframe Mesh"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Holo Mesh</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'orbit' ? 'explode' : 'orbit')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 backdrop-blur-md ${
              viewMode === 'explode'
                ? 'bg-purple-600 text-white border-purple-400 font-bold shadow-md shadow-purple-600/30'
                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:border-purple-500/50 hover:text-white'
            }`}
            title="Explode 3D Models"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Explode View</span>
          </button>

          <button
            type="button"
            onClick={() => setParticleSpeed((prev) => (prev >= 2 ? 0.5 : prev + 0.5))}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium border bg-slate-900/80 text-slate-300 border-slate-700 hover:border-emerald-500/50 hover:text-emerald-300 transition-all flex items-center gap-1.5 backdrop-blur-md"
            title="Adjust Animation Velocity"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>{particleSpeed}x</span>
          </button>
        </div>
      </div>

      {/* Floating 3D Interaction Hint at Bottom */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10 text-[11px] text-slate-400">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/70 backdrop-blur-md border border-slate-800 text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Click & drag to rotate 360° in 3D space</span>
        </div>
        <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/70 backdrop-blur-md border border-slate-800 text-slate-400">
          <span>60 FPS Hardware Accelerated</span>
        </div>
      </div>
    </div>
  )
}
