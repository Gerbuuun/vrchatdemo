import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, useAnimations } from '@react-three/drei'
import { useEffect, useState, useRef } from 'react'
import * as THREE from 'three'

function Stadium() {
  const { scene } = useGLTF('/src/assets/models/low_poly_stadium/scene.gltf')
  return <primitive object={scene} scale={4} position={[0, 0, 0]} />
}

function Character() {
  // State for movement
  const [isMoving, setIsMoving] = useState(false)
  const [position, setPosition] = useState(new THREE.Vector3(0, 0, 0))
  const [rotation, setRotation] = useState(0)
  const rotationRef = useRef(0)
  
  // Movement constants
  const MOVEMENT_SPEED = 0.02
  const ROTATION_SPEED = 0.05
  
  // Load the character model
  const { scene } = useGLTF('/src/assets/models/character/XBot.glb')
  
  // Load animations separately
  const { animations: idleAnimations } = useGLTF('/src/assets/models/character/animations/Idle.glb')
  const { animations: walkAnimations } = useGLTF('/src/assets/models/character/animations/Walking.glb')
  
  // Create animation mixer
  const mixer = useRef<THREE.AnimationMixer>()
  const idleAction = useRef<THREE.AnimationAction>()
  const walkAction = useRef<THREE.AnimationAction>()
  
  // Movement state
  const keysPressed = useRef<Set<string>>(new Set())
  
  // Set up animations
  useEffect(() => {
    if (!scene || !idleAnimations[0] || !walkAnimations[0]) return
    
    // Create mixer
    mixer.current = new THREE.AnimationMixer(scene)
    
    // Create actions
    idleAction.current = mixer.current.clipAction(idleAnimations[0])
    walkAction.current = mixer.current.clipAction(walkAnimations[0])
    
    // Set up initial state
    idleAction.current.play()
    
    console.log('Animations set up:', {
      idle: idleAction.current?.getClip().name,
      walk: walkAction.current?.getClip().name
    })
  }, [scene, idleAnimations, walkAnimations])
  
  // Handle animation switching
  useEffect(() => {
    if (!idleAction.current || !walkAction.current) return
    
    if (isMoving) {
      idleAction.current.fadeOut(0.2)
      walkAction.current.reset().fadeIn(0.2).play()
    } else {
      walkAction.current.fadeOut(0.2)
      idleAction.current.reset().fadeIn(0.2).play()
    }
  }, [isMoving])
  
  // Update animation mixer and position
  useEffect(() => {
    if (!mixer.current) return
    
    const updateMixer = () => {
      // Update animation
      mixer.current?.update(0.016)
      
      // Handle rotation (A and D keys)
      if (keysPressed.current.has('a')) {
        rotationRef.current += ROTATION_SPEED
        setRotation(rotationRef.current)
      }
      if (keysPressed.current.has('d')) {
        rotationRef.current -= ROTATION_SPEED
        setRotation(rotationRef.current)
      }
      
      // Handle forward movement (W key)
      if (keysPressed.current.has('w')) {
        setPosition(prev => {
          const newPos = prev.clone()
          // Calculate forward direction based on current rotation
          newPos.x += Math.sin(rotationRef.current) * MOVEMENT_SPEED
          newPos.z += Math.cos(rotationRef.current) * MOVEMENT_SPEED
          return newPos
        })
      }
      
      requestAnimationFrame(updateMixer)
    }
    
    updateMixer()
  }, [])
  
  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (['w', 'a', 'd'].includes(key)) {
        keysPressed.current.add(key)
        // Only set isMoving to true if W is pressed
        if (key === 'w') {
          setIsMoving(true)
        }
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (['w', 'a', 'd'].includes(key)) {
        keysPressed.current.delete(key)
        // Only set isMoving to false if W is released
        if (key === 'w') {
          setIsMoving(false)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <primitive 
      object={scene} 
      scale={1} 
      position={position}
      rotation={[0, rotation, 0]}
    />
  )
}

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        camera={{
          position: [10, 10, 10],
          fov: 75,
          near: 0.1,
          far: 1000
        }}
      >
        {/* Ambient light for general illumination */}
        <ambientLight intensity={0.9} />
        
        {/* Directional light simulating sunlight */}
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={1} 
          castShadow 
        />
        
        {/* Additional point light for better detail */}
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        
        <Stadium />
        <Character />
        <OrbitControls />
      </Canvas>
    </div>
  )
}

export default App
