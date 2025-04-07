import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations, PerspectiveCamera } from '@react-three/drei'
import { useEffect, useState, useRef } from 'react'
import * as THREE from 'three'
import { ConnectionPopup } from './components/ConnectionPopup'
import * as moduleBindings from './module_bindings/index'

function Stadium() {
  const { scene } = useGLTF('/src/assets/models/low_poly_stadium/scene.gltf')
  return <primitive object={scene} scale={4} position={[0, 0, 0]} />
}

function Character({ onPositionChange, isConnected }: { onPositionChange: (position: THREE.Vector3) => void, isConnected: boolean }) {
  const { camera } = useThree()
  const characterRef = useRef<THREE.Group>(null)
  const position = useRef(new THREE.Vector3(0, 0, 0))
  const keysPressed = useRef<Set<string>>(new Set())
  const isMoving = useRef(false)
  const isPointerLocked = useRef(false)
  const mouseSensitivity = 0.002
  const yaw = useRef(0)
  const pitch = useRef(Math.PI / 2) // Start looking straight ahead
  
  // Movement constants
  const MOVEMENT_SPEED = 0.1
  
  // Camera constants
  const CAMERA_DISTANCE = 5 // Distance behind the character
  const CAMERA_HEIGHT = 3 // Height above the character
  
  // Load the character model
  const { scene } = useGLTF('/src/assets/models/character/XBot.glb')
  
  // Load animations separately
  const { animations: idleAnimations } = useGLTF('/src/assets/models/character/animations/Idle.glb')
  const { animations: walkAnimations } = useGLTF('/src/assets/models/character/animations/Walking.glb')
  
  // Create animation mixer
  const mixer = useRef<THREE.AnimationMixer>(new THREE.AnimationMixer(scene))
  const idleAction = useRef<THREE.AnimationAction>(mixer.current.clipAction(idleAnimations[0]))
  const walkAction = useRef<THREE.AnimationAction>(mixer.current.clipAction(walkAnimations[0]))
  
  // Set up animations
  useEffect(() => {
    if (!scene || !idleAnimations[0] || !walkAnimations[0]) return
    
    // Set up initial state
    idleAction.current.play()
  }, [scene, idleAnimations, walkAnimations])
  
  // Handle keyboard input
  useEffect(() => {
    if (!isConnected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase())
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase())
    }
    
    // Handle pointer lock for mouse control
    const handlePointerLockChange = () => {
      isPointerLocked.current = document.pointerLockElement !== null
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPointerLocked.current) return
      
      // Update yaw and pitch based on mouse movement
      yaw.current -= e.movementX * mouseSensitivity
      pitch.current = Math.max(0.1, Math.min(Math.PI - 0.1, pitch.current + e.movementY * mouseSensitivity))
    }
    
    // Request pointer lock on click
    const handleClick = () => {
      if (!isPointerLocked.current) {
        document.body.requestPointerLock()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
    }
  }, [isConnected])
  
  // Update animation mixer and handle movement
  useFrame((_, delta) => {
    if (mixer.current) {
      mixer.current.update(delta)
    }

    if (!isConnected) return;

    // Handle movement
    const moveForward = keysPressed.current.has('w')
    const moveBackward = keysPressed.current.has('s')
    const moveLeft = keysPressed.current.has('a')
    const moveRight = keysPressed.current.has('d')

    if (moveForward || moveBackward || moveLeft || moveRight) {
      if (!isMoving.current) {
        isMoving.current = true
        idleAction.current.fadeOut(0.2)
        walkAction.current.reset().fadeIn(0.2).play()
      }

      // Calculate movement direction based on camera yaw
      const moveX = Math.sin(yaw.current)
      const moveZ = Math.cos(yaw.current)

      // Apply movement
      if (moveForward) {
        position.current.x -= moveX * MOVEMENT_SPEED
        position.current.z -= moveZ * MOVEMENT_SPEED
      }
      if (moveBackward) {
        position.current.x += moveX * MOVEMENT_SPEED
        position.current.z += moveZ * MOVEMENT_SPEED
      }
      if (moveLeft) {
        position.current.x -= moveZ * MOVEMENT_SPEED
        position.current.z += moveX * MOVEMENT_SPEED
      }
      if (moveRight) {
        position.current.x += moveZ * MOVEMENT_SPEED
        position.current.z -= moveX * MOVEMENT_SPEED
      }

      // Update character position
      if (characterRef.current) {
        characterRef.current.position.copy(position.current)
      }
    } else if (isMoving.current) {
      isMoving.current = false
      walkAction.current.fadeOut(0.2)
      idleAction.current.reset().fadeIn(0.2).play()
    }
    
    // Update character rotation to match camera yaw
    if (characterRef.current) {
      characterRef.current.rotation.y = yaw.current + Math.PI
    }
    
    // Update camera position and rotation
    camera.position.copy(position.current)
    camera.position.y += CAMERA_HEIGHT // Camera height above character
    
    // Calculate camera offset based on yaw
    const cameraOffsetX = Math.sin(yaw.current) * CAMERA_DISTANCE
    const cameraOffsetZ = Math.cos(yaw.current) * CAMERA_DISTANCE
    
    // Apply camera offset
    camera.position.x += cameraOffsetX
    camera.position.z += cameraOffsetZ
    
    // Calculate vertical offset based on pitch
    const verticalOffset = Math.sin(pitch.current - Math.PI / 2) * CAMERA_DISTANCE
    camera.position.y += verticalOffset
    
    // Make camera look at character position
    const lookAtPosition = new THREE.Vector3(
      position.current.x,
      position.current.y + 1.5, // Look at character's head
      position.current.z
    )
    camera.lookAt(lookAtPosition)
  })

  return (
    <group position={[0, 0, 0]}>
      <group ref={characterRef}>
        <primitive 
          object={scene} 
          scale={1} 
        />
      </group>
    </group>
  )
}

function App() {
  const [connection, setConnection] = useState<moduleBindings.DbConnection | null>(null);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas>
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
        <Character onPositionChange={() => {}} isConnected={!!connection} />
      </Canvas>
      {!connection && <ConnectionPopup onConnect={setConnection} />}
    </div>
  );
}

export default App
