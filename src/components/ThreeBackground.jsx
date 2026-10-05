import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function ThreeBackground() {
  const mountRef = useRef(null)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    // 1. Scene, Camera & Renderer
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x030712, 0.035)

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    camera.position.set(0, 0, 14)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)

    // 2. Dynamic Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)

    const mainDirectional = new THREE.DirectionalLight(0x00f0ff, 2.5)
    mainDirectional.position.set(10, 15, 10)
    scene.add(mainDirectional)

    const secondaryDirectional = new THREE.DirectionalLight(0xec4899, 1.8)
    secondaryDirectional.position.set(-10, -10, -5)
    scene.add(secondaryDirectional)

    // Mouse-Tracking Point Light (Creates interactive specular sheen on pills)
    const mouseLight = new THREE.PointLight(0x008f8b, 4.5, 25)
    mouseLight.position.set(0, 0, 8)
    scene.add(mouseLight)

    // 3. Materials
    const tealMat = new THREE.MeshStandardMaterial({
      color: 0x008f8b,
      metalness: 0.35,
      roughness: 0.15,
      emissive: 0x003d3a,
      emissiveIntensity: 0.3,
    })

    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.15,
      roughness: 0.2,
    })

    const maroonMat = new THREE.MeshStandardMaterial({
      color: 0x5a1836,
      metalness: 0.4,
      roughness: 0.2,
      emissive: 0x220512,
      emissiveIntensity: 0.3,
    })

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.35,
      roughness: 0.2,
    })

    const cyanMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.3,
      roughness: 0.2,
      emissive: 0x083344,
      emissiveIntensity: 0.2,
    })

    // 4. Capsule Generator Helper
    function createCapsule(matTop, matBottom, radius, length) {
      const group = new THREE.Group()

      // Top Dome
      const topGeo = new THREE.SphereGeometry(radius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2)
      const topMesh = new THREE.Mesh(topGeo, matTop)
      topMesh.position.y = length / 2
      group.add(topMesh)

      // Body Top
      const bodyTopGeo = new THREE.CylinderGeometry(radius, radius, length / 2, 24)
      const bodyTop = new THREE.Mesh(bodyTopGeo, matTop)
      bodyTop.position.y = length / 4
      group.add(bodyTop)

      // Body Bottom
      const bodyBotGeo = new THREE.CylinderGeometry(radius, radius, length / 2, 24)
      const bodyBot = new THREE.Mesh(bodyBotGeo, matBottom)
      bodyBot.position.y = -length / 4
      group.add(bodyBot)

      // Bottom Dome
      const botGeo = new THREE.SphereGeometry(radius, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
      const botMesh = new THREE.Mesh(botGeo, matBottom)
      botMesh.position.y = -length / 2
      group.add(botMesh)

      return group
    }

    // Tablet Generator Helper
    function createTablet(color, radius, height) {
      const group = new THREE.Group()
      const mat = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.25,
        roughness: 0.25,
      })
      const geo = new THREE.CylinderGeometry(radius, radius, height, 28)
      const mesh = new THREE.Mesh(geo, mat)
      group.add(mesh)

      // Score divider line
      const lineGeo = new THREE.BoxGeometry(radius * 1.85, height * 1.05, 0.035)
      const lineMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
      group.add(new THREE.Mesh(lineGeo, lineMat))
      return group
    }

    // 5. Populate Floating 3D Medicine Field Across Entire Depth
    const floatingItems = []
    const itemConfigs = [
      // Large Hero Background Elements
      { type: 'cap', mats: [tealMat, whiteMat], r: 0.85, len: 1.5, pos: [-7.5, 3.2, -4], rot: [0.6, 0.4, 0.8], speed: 0.8 },
      { type: 'cap', mats: [maroonMat, whiteMat], r: 0.75, len: 1.3, pos: [8.2, -2.5, -3], rot: [-0.5, 0.8, -0.4], speed: 1.1 },
      { type: 'cap', mats: [goldMat, tealMat], r: 0.65, len: 1.2, pos: [6.8, 4.5, -6], rot: [0.8, -0.6, 0.5], speed: 0.9 },
      { type: 'cap', mats: [cyanMat, whiteMat], r: 0.7, len: 1.3, pos: [-6.5, -5.2, -5], rot: [-0.7, 0.5, 0.9], speed: 1.0 },

      // Midground Ambient Items
      { type: 'tab', col: 0x06b6d4, r: 0.65, h: 0.25, pos: [-4.2, 5.5, -2], rot: [0.9, 0.3, 0.2], speed: 1.2 },
      { type: 'tab', col: 0xa855f7, r: 0.55, h: 0.22, pos: [5.0, 1.8, -1.5], rot: [-0.4, 0.7, 0.6], speed: 0.85 },
      { type: 'tab', col: 0x10b981, r: 0.5, h: 0.2, pos: [-3.8, -2.8, -2.5], rot: [0.5, -0.8, 0.4], speed: 1.3 },
      { type: 'tab', col: 0x38bdf8, r: 0.6, h: 0.24, pos: [3.5, -5.8, -3], rot: [-0.6, -0.5, 0.7], speed: 0.95 },

      // Deeper Subtle Floating Pills
      { type: 'cap', mats: [tealMat, maroonMat], r: 0.5, len: 0.9, pos: [0.5, 6.2, -8], rot: [0.4, 0.9, -0.3], speed: 0.7 },
      { type: 'cap', mats: [whiteMat, cyanMat], r: 0.55, len: 1.0, pos: [-1.2, -6.5, -9], rot: [-0.8, 0.4, 0.5], speed: 0.75 },
      { type: 'tab', col: 0xf59e0b, r: 0.45, h: 0.18, pos: [-8.5, 0.2, -7], rot: [0.7, 0.2, 0.8], speed: 1.1 },
      { type: 'tab', col: 0xec4899, r: 0.4, h: 0.16, pos: [8.8, 1.2, -8], rot: [-0.5, 0.8, -0.6], speed: 0.9 },
    ]

    itemConfigs.forEach((cfg) => {
      let obj
      if (cfg.type === 'cap') {
        obj = createCapsule(cfg.mats[0], cfg.mats[1], cfg.r, cfg.len)
      } else {
        obj = createTablet(cfg.col, cfg.r, cfg.h)
      }
      obj.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2])
      obj.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2])
      scene.add(obj)

      floatingItems.push({
        mesh: obj,
        basePos: { ...cfg.pos },
        rotSpeed: {
          x: (Math.random() - 0.5) * 0.008 * cfg.speed,
          y: (Math.random() - 0.5) * 0.012 * cfg.speed,
          z: (Math.random() - 0.5) * 0.006 * cfg.speed,
        },
        floatSpeed: cfg.speed,
        seed: Math.random() * 100,
      })
    })

    // 6. Interactive 3D Cyber Wave Mesh (Bottom undulating data matrix)
    const waveRows = 45
    const waveCols = 45
    const waveCount = waveRows * waveCols
    const waveGeo = new THREE.BufferGeometry()
    const wavePositions = new Float32Array(waveCount * 3)
    const waveColors = new Float32Array(waveCount * 3)

    let idx = 0
    for (let r = 0; r < waveRows; r++) {
      for (let c = 0; c < waveCols; c++) {
        const x = (c - waveCols / 2) * 0.85
        const z = (r - waveRows / 2) * 0.85 - 2
        const y = -7.5

        wavePositions[idx * 3] = x
        wavePositions[idx * 3 + 1] = y
        wavePositions[idx * 3 + 2] = z

        // Gradient Cyan/Teal Colors
        waveColors[idx * 3] = 0.0 + (c / waveCols) * 0.2
        waveColors[idx * 3 + 1] = 0.7 + (r / waveRows) * 0.3
        waveColors[idx * 3 + 2] = 0.9

        idx++
      }
    }

    waveGeo.setAttribute('position', new THREE.BufferAttribute(wavePositions, 3))
    waveGeo.setAttribute('color', new THREE.BufferAttribute(waveColors, 3))

    const waveMat = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    })

    const waveMesh = new THREE.Points(waveGeo, waveMat)
    scene.add(waveMesh)

    // 7. Ambient Floating Star / Medical Particles
    const starCount = 550
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(starCount * 3)
    const starCol = new Float32Array(starCount * 3)

    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 36
      starPos[i + 1] = (Math.random() - 0.5) * 30
      starPos[i + 2] = (Math.random() - 0.5) * 25 - 5

      if (Math.random() > 0.4) {
        starCol[i] = 0.0
        starCol[i + 1] = 0.85
        starCol[i + 2] = 0.8
      } else {
        starCol[i] = 0.6
        starCol[i + 1] = 0.3
        starCol[i + 2] = 0.95
      }
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))

    const starMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    })

    const stars = new THREE.Points(starGeo, starMat)
    scene.add(stars)

    // 8. Mouse & Scroll Interaction Tracking
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 }
    let scrollY = 0

    const onMouseMove = (e) => {
      mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1
      mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1
    }

    const onScroll = () => {
      scrollY = window.scrollY || window.pageYOffset
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', onResize)

    // 9. Animation Loop
    let animationFrameId
    const clock = new THREE.Clock()

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      const time = clock.getElapsedTime()

      // Smooth mouse interpolation (Lerp)
      mouse.x += (mouse.targetX - mouse.x) * 0.05
      mouse.y += (mouse.targetY - mouse.y) * 0.05

      // Camera Parallax on Mouse & Scroll
      const scrollOffset = scrollY * 0.003
      camera.position.x = mouse.x * 1.8
      camera.position.y = mouse.y * 1.2 - scrollOffset * 0.5
      camera.rotation.y = -mouse.x * 0.08
      camera.rotation.x = mouse.y * 0.06

      // Move point light with mouse
      mouseLight.position.x = mouse.x * 10
      mouseLight.position.y = mouse.y * 8
      mouseLight.position.z = 7

      // Animate Floating 3D Medicine Items
      floatingItems.forEach((item) => {
        const { mesh, basePos, rotSpeed, floatSpeed, seed } = item
        mesh.rotation.x += rotSpeed.x
        mesh.rotation.y += rotSpeed.y
        mesh.rotation.z += rotSpeed.z

        mesh.position.y = basePos.y + Math.sin(time * 0.9 * floatSpeed + seed) * 0.4
        mesh.position.x = basePos.x + Math.cos(time * 0.6 * floatSpeed + seed) * 0.25
      })

      // Animate 3D Undulating Wave Grid
      const posAttr = waveGeo.attributes.position
      const pArray = posAttr.array
      idx = 0
      for (let r = 0; r < waveRows; r++) {
        for (let c = 0; c < waveCols; c++) {
          const x = pArray[idx * 3]
          const z = pArray[idx * 3 + 2]
          // Sine + Cosine height ripples
          pArray[idx * 3 + 1] =
            -7.5 +
            Math.sin(x * 0.35 + time * 1.2) * 0.75 +
            Math.cos(z * 0.35 + time * 0.9) * 0.65
          idx++
        }
      }
      posAttr.needsUpdate = true

      // Gentle Star Drift
      stars.rotation.y = time * 0.015

      renderer.render(scene, camera)
    }

    animate()

    // 10. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)

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
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full pointer-events-none -z-10 overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 20%, #081a2e 0%, #030712 70%)',
      }}
    />
  )
}
