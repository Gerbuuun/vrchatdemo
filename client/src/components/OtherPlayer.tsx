import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import * as moduleBindings from '../module_bindings/index'
import { useRef, useEffect, useMemo, useState } from 'react'
import { useLoader, useFrame } from '@react-three/fiber'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

// Global debug flag - set to false to disable all debug visualizations
const SHOW_DEBUG = false

interface OtherPlayerProps {
  player: moduleBindings.Player
}

// Separate component for the character model with animations
function CharacterModel({ playerKey, isMoving }: { playerKey: string, isMoving: boolean }) {
  // Load the character model
  const { scene } = useGLTF(`/models/character/XBot.glb#${playerKey}`)
  
  // Load animations separately
  const { animations: idleAnimations } = useGLTF('/models/character/animations/Idle.glb')
  const { animations: walkAnimations } = useGLTF('/models/character/animations/Walking.glb')
  
  // Clone the scene properly with SkeletonUtils to preserve animations and skeleton
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene])
  
  // Create animation mixer
  const mixer = useMemo(() => new THREE.AnimationMixer(clonedScene), [clonedScene])
  
  // Create animation actions
  const idleAction = useMemo(() => 
    mixer.clipAction(idleAnimations[0]), 
    [mixer, idleAnimations]
  )
  
  const walkAction = useMemo(() => 
    mixer.clipAction(walkAnimations[0]), 
    [mixer, walkAnimations]
  )
  
  // Set up animations
  useEffect(() => {
    if (!clonedScene || !idleAnimations[0] || !walkAnimations[0]) return
    
    // Set up initial state - start with idle animation
    idleAction.play()
    
    // Clean up mixer when component unmounts
    return () => {
      mixer.stopAllAction()
    }
  }, [clonedScene, idleAnimations, walkAnimations, idleAction, walkAction])
  
  // Handle animation state changes based on movement
  useEffect(() => {
    if (isMoving) {
      // Transition to walking animation
      idleAction.fadeOut(0.2)
      walkAction.reset().fadeIn(0.2).play()
    } else {
      // Transition to idle animation
      walkAction.fadeOut(0.2)
      idleAction.reset().fadeIn(0.2).play()
    }
  }, [isMoving, idleAction, walkAction])
  
  // Update animation mixer on each frame
  useFrame((_, delta) => {
    mixer.update(delta)
  })
  
  if (SHOW_DEBUG) {
    console.log(`Created character model for player ${playerKey}, isMoving: ${isMoving}`)
  }
  
  return <primitive object={clonedScene} scale={1} />
}

export function OtherPlayer({ player }: OtherPlayerProps) {
  // Create a ref for the group that will move with position updates
  const groupRef = useRef<THREE.Group>(null)
  
  // Generate a player identity for tracking
  const playerIdentity = player.identity.toHexString()
  
  // Store previous position to detect movement
  const prevPosition = useRef<{ x: number, z: number }>({ x: 0, z: 0 })
  
  // State for tracking if player is moving
  const [isMoving, setIsMoving] = useState(false)
  
  // Get position from player data - consistent (x, y, z) format
  // Using DbVector2 where y corresponds to the z-axis in 3D space
  const x = player.position.x
  const y = 0 // Height above ground
  const z = player.position.y
  
  // Get rotation from player data
  const rotation = player.rotationYaw
  
  // Update position when player position changes and detect movement
  useEffect(() => {
    if (groupRef.current) {
      // Use consistent x, y, z ordering here
      groupRef.current.position.set(x, y, z)
      groupRef.current.rotation.set(0, rotation, 0)
      
      // Calculate distance moved since last position update
      const deltaX = x - prevPosition.current.x
      const deltaZ = z - prevPosition.current.z
      const distanceMoved = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ)
      
      // Update movement state if distance is significant
      const MOVEMENT_THRESHOLD = 0.01
      const isCurrentlyMoving = distanceMoved > MOVEMENT_THRESHOLD
      
      if (isCurrentlyMoving !== isMoving) {
        setIsMoving(isCurrentlyMoving)
      }
      
      // Save current position as previous for next update
      prevPosition.current = { x, z }
      
      // Only log when debug is enabled
      if (SHOW_DEBUG) {
        console.log(`Updated player ${playerIdentity} group position to:`, x, y, z, "rotation:", rotation)
        console.log(`Distance moved: ${distanceMoved}, isMoving: ${isCurrentlyMoving}`)
      }
    }
  }, [x, z, rotation, playerIdentity, isMoving])
  
  // Only log when debug is enabled
  if (SHOW_DEBUG) {
    console.log(`Rendering player ${playerIdentity} at position: ${x}, ${y}, ${z} with rotation: ${rotation}`);
  }
  
  // Use the same consistent ordering in the group props
  return (
    <group ref={groupRef} position={[x, y, z]} rotation={[0, rotation, 0]}>
      {/* Debug visualization - only shown when debug is enabled */}
      {SHOW_DEBUG && (
        <>
          <mesh position={[0, 2, 0]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color="red" />
          </mesh>
          <axesHelper args={[2]} />
          
          <mesh position={[0, 1, 0]}>
            <boxGeometry args={[1, 2, 1]} />
            <meshBasicMaterial color="blue" wireframe={true} />
          </mesh>
        </>
      )}
      
      {/* Actual player model with unique key and animation state */}
      <CharacterModel playerKey={playerIdentity} isMoving={isMoving} />
    </group>
  )
} 