import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import * as moduleBindings from '../module_bindings/index'
import { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

// Global debug flag - set to true for easier debugging
const SHOW_DEBUG = true

// Animation states for better type safety
enum AnimationState {
  IDLE = 'idle',
  WALKING = 'walking',
}

interface OtherPlayerProps {
  player: moduleBindings.Player
}

// Normalize angle to be between 0 and 2π
function normalizeAngle(angle: number): number {
  // Ensure angle is between 0 and 2π
  return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

// Separate component for the character model with animations
function CharacterModel({ playerKey, position, rotation, otherPlayer }: { 
  playerKey: string,
  position: THREE.Vector3,
  rotation: number,
  otherPlayer: moduleBindings.Player
}) {
  // Load the model and animations with unique cache keys to prevent sharing instances
  const { scene: originalScene } = useGLTF(`/models/character/XBot.glb?player=${playerKey}`)
  const { animations: idleAnimations } = useGLTF(`/models/character/animations/Idle.glb?player=${playerKey}`)
  const { animations: walkAnimations } = useGLTF(`/models/character/animations/Walking.glb?player=${playerKey}`)
  
  // Clone the scene properly with SkeletonUtils to preserve animations and skeleton
  const scene = useMemo(() => SkeletonUtils.clone(originalScene), [originalScene])
  
  // Create animation mixer
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene])
  
  // Create animation actions - defined after mixer is created
  const [actions] = useState(() => {
    return {
      idle: mixer.clipAction(idleAnimations[0].clone()),
      walk: mixer.clipAction(walkAnimations[0].clone())
    }
  })
  
  // Store the previous position for movement calculation
  const prevPosition = useRef(new THREE.Vector3().copy(position))
  
  // Track movement
  const isMoving = useRef(false)
  const isMovingBackwards = useRef(false)
  const movementTimer = useRef<number | null>(null)
  const movementData = useRef({
    dx: 0,
    dz: 0,
    distance: 0
  })
  
  // Track the current animation state
  const currentAnimation = useRef(AnimationState.IDLE)
  
  // Set up animations only once
  useEffect(() => {
    if (SHOW_DEBUG) {
      console.log(`Setting up animations for player ${playerKey}`)
    }
    
    // Make sure animations loop
    actions.idle.setLoop(THREE.LoopRepeat, Infinity)
    actions.walk.setLoop(THREE.LoopRepeat, Infinity)
    
    // Start with idle animation
    actions.idle.reset().play()
    actions.walk.stop()
    
    currentAnimation.current = AnimationState.IDLE
    
    // Clean up on unmount
    return () => {
      if (movementTimer.current) {
        clearTimeout(movementTimer.current)
      }
      mixer.stopAllAction()
    }
  }, [actions, mixer, playerKey])
  
  // Update animation mixer on each frame
  useFrame((_, delta) => {
    // First update the mixer
    mixer.update(delta)
    
    // Calculate world movement
    const worldMovement = new THREE.Vector3().copy(position).sub(prevPosition.current)
    const movementDistance = worldMovement.length()
    
    // Store movement data
    movementData.current.dx = worldMovement.x;
    movementData.current.dz = worldMovement.z;
    movementData.current.distance = movementDistance;
    
    // Only process significant movement
    if (movementDistance > 0.005) {
      // Normalize the rotation angle to avoid issues at the 0/2π boundary
      const normalizedRotation = normalizeAngle(rotation);
      
      // Method 1: Use a quaternion for precise rotation
      const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), // Y-axis
        normalizedRotation
      );
      
      // Create rotation matrix from quaternion
      const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(rotationQuaternion);
      
      // Get the inverse rotation matrix
      const inverseRotationMatrix = new THREE.Matrix4().copy(rotationMatrix).invert();
      
      // Method 2: Use direct vector transformation (backup calculation)
      // Get the forward and right vectors in world space
      const forwardVector = new THREE.Vector3(
        Math.sin(normalizedRotation), 
        0, 
        -Math.cos(normalizedRotation)
      ).normalize();
      
      const rightVector = new THREE.Vector3(
        Math.cos(normalizedRotation), 
        0, 
        Math.sin(normalizedRotation)
      ).normalize();
      
      // Project world movement onto these vectors to get local coordinates
      const forwardAmount = worldMovement.dot(forwardVector);
      const rightAmount = worldMovement.dot(rightVector);
      
      // Transform world movement to local space using the matrix
      const localMovement = worldMovement.clone().applyMatrix4(inverseRotationMatrix);
      
      // FIXED: Invert the condition as the animation is playing in reverse
      // In local space, -Z is forward, +Z is backward
      const isBackward = localMovement.z < 0;
      
      // Verify with our direct calculation (for debug purposes)
      // FIXED: Invert this condition as well
      const isBackwardDirect = forwardAmount > 0;
      
      // Log detailed debug info
      if (SHOW_DEBUG) {
        console.log(`OtherPlayer ${playerKey} movement:
          World: (${worldMovement.x.toFixed(3)}, ${worldMovement.z.toFixed(3)})
          Local (matrix): (${localMovement.x.toFixed(3)}, ${localMovement.z.toFixed(3)})
          Local (direct): forward=${forwardAmount.toFixed(3)}, right=${rightAmount.toFixed(3)}
          Direction: ${isBackward ? 'BACKWARD' : 'FORWARD'}, direct=${isBackwardDirect ? 'BACKWARD' : 'FORWARD'}
          Rotation: ${rotation.toFixed(2)}, normalized=${normalizedRotation.toFixed(2)}`);
      }
      
      // Clear any existing timer
      if (movementTimer.current) {
        clearTimeout(movementTimer.current);
      }
      
      // Handle animation transitions
      if (!isMoving.current || isMovingBackwards.current !== isBackward) {
        // Start walking animation if needed
        if (currentAnimation.current === AnimationState.IDLE) {
          actions.idle.fadeOut(0.2);
          actions.walk.reset().fadeIn(0.2).play();
          currentAnimation.current = AnimationState.WALKING;
          
          if (SHOW_DEBUG) {
            console.log(`OtherPlayer ${playerKey} started walking, isBackward: ${isBackward}`);
          }
        }
        
        // Update animation direction if it changed
        if (isMovingBackwards.current !== isBackward) {
          actions.walk.timeScale = isBackward ? -1 : 1;
          
          if (SHOW_DEBUG) {
            console.log(`OtherPlayer ${playerKey} direction changed: backward=${isBackward}, timescale=${isBackward ? -1 : 1}`);
          }
        }
      }
      
      // Update movement state
      isMoving.current = true;
      isMovingBackwards.current = isBackward;
      
      // Set timer to return to idle if movement stops
      movementTimer.current = window.setTimeout(() => {
        if (isMoving.current && currentAnimation.current === AnimationState.WALKING) {
          // Transition to idle
          actions.walk.fadeOut(0.2);
          actions.idle.reset().fadeIn(0.2).play();
          currentAnimation.current = AnimationState.IDLE;
          isMoving.current = false;
          
          if (SHOW_DEBUG) {
            console.log(`OtherPlayer ${playerKey} stopped moving, returning to idle`);
          }
        }
      }, 150) as unknown as number;
    }
    
    // Store current position for next frame
    prevPosition.current.copy(position);
  });
  
  return <primitive object={scene} scale={1} />
}

export function OtherPlayer({ player }: OtherPlayerProps) {
  // Create a ref for the group that will move with position updates
  const groupRef = useRef<THREE.Group>(null)
  
  // Generate a player identity for tracking
  const playerIdentity = player.identity.toHexString()
  
  // Get position from player data - consistent (x, y, z) format
  // Using DbVector2 where y corresponds to the z-axis in 3D space
  const x = player.position.x
  const y = 0 // Height above ground
  const z = player.position.y
  
  // Create a THREE.Vector3 for the position
  const position = useMemo(() => new THREE.Vector3(x, y, z), [x, y, z])
  
  // Get rotation from player data
  const rotation = player.rotationYaw
  
  // Update position when player data changes
  useEffect(() => {
    if (groupRef.current) {
      // Update the group's position and rotation
      groupRef.current.position.copy(position)
      groupRef.current.rotation.set(0, rotation, 0)
    }
  }, [position, rotation])
  
  // Only log when debug is enabled
  if (SHOW_DEBUG) {
    console.log(`Rendering other player ${playerIdentity} at position: ${x}, ${y}, ${z}, rotation: ${rotation.toFixed(2)}`)
  }
  
  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
      {/* Debug visualization - only shown when debug is enabled */}
      {SHOW_DEBUG && (
        <>
          <mesh position={[0, 2, 0]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color="red" />
          </mesh>
          <axesHelper args={[2]} />
        </>
      )}
      
      {/* Character model with unique key for this player */}
      <CharacterModel 
        playerKey={playerIdentity} 
        position={position}
        rotation={rotation}
        otherPlayer={player}
      />
    </group>
  )
} 