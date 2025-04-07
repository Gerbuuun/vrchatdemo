import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations, PerspectiveCamera } from '@react-three/drei'
import { useEffect, useState, useRef } from 'react'
import * as THREE from 'three'
import { ConnectionPopup } from './components/ConnectionPopup'
import { OtherPlayer } from './components/OtherPlayer'
import * as moduleBindings from './module_bindings/index'

function Stadium() {
  const { scene } = useGLTF('/models/low_poly_stadium/scene.gltf')
  return <primitive object={scene} scale={4} position={[0, 0, 0]} />
}

function Character({ onPositionChange, isConnected, connection }: { 
  onPositionChange: (position: THREE.Vector3) => void, 
  isConnected: boolean,
  connection: moduleBindings.DbConnection | null 
}) {
  const { camera } = useThree()
  const characterRef = useRef<THREE.Group>(null)
  const position = useRef(new THREE.Vector3(0, 0, 0))
  const keysPressed = useRef<Set<string>>(new Set())
  const isMoving = useRef(false)
  const isPointerLocked = useRef(false)
  const mouseSensitivity = 0.002
  const yaw = useRef(0)
  const pitch = useRef(Math.PI / 2) // Start looking straight ahead
  const lastUpdateTime = useRef(0)
  const UPDATE_INTERVAL = 1000 / 30 // 30 times per second
  const lastSentPosition = useRef({ x: 0, y: 0, rotation: 0 })
  const POSITION_THRESHOLD = 0.01 // Minimum change in position to trigger an update
  const ROTATION_THRESHOLD = 0.01 // Minimum change in rotation to trigger an update
  
  // Movement constants
  const MOVEMENT_SPEED = 0.03
  
  // Camera constants
  const CAMERA_DISTANCE = 2 // Distance behind the character
  const CAMERA_HEIGHT = 1 // Height above the character
  
  // Preload all models and animations
  useGLTF.preload('/models/character/XBot.glb')
  useGLTF.preload('/models/character/animations/Idle.glb')
  useGLTF.preload('/models/character/animations/Walking.glb')
  useGLTF.preload('/models/low_poly_stadium/scene.gltf')
  
  // Load the character model
  const { scene } = useGLTF('/models/character/XBot.glb')
  
  // Load animations separately
  const { animations: idleAnimations } = useGLTF('/models/character/animations/Idle.glb')
  const { animations: walkAnimations } = useGLTF('/models/character/animations/Walking.glb')
  
  // Create animation mixer
  const mixer = useRef<THREE.AnimationMixer>(new THREE.AnimationMixer(scene))
  const idleAction = useRef<THREE.AnimationAction>(mixer.current.clipAction(idleAnimations[0]))
  const walkAction = useRef<THREE.AnimationAction>(mixer.current.clipAction(walkAnimations[0]))
  
  // Track the current animation state
  const currentAnimation = useRef('idle')
  
  // Track the previous position for local movement calculation
  const prevPosition = useRef(new THREE.Vector3(0, 0, 0))
  
  // Track if player is moving backwards
  const isMovingBackwards = useRef(false)
  
  // Normalize angle to be between 0 and 2π - same as in OtherPlayer.tsx
  function normalizeAngle(angle: number): number {
    return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  }
  
  // Set up animations
  useEffect(() => {
    if (!scene || !idleAnimations[0] || !walkAnimations[0]) return
    
    // Configure animations for smooth looping
    walkAction.current.setLoop(THREE.LoopRepeat, Infinity)
    idleAction.current.setLoop(THREE.LoopRepeat, Infinity)
    
    // Ensure animations are properly reset
    walkAction.current.reset()
    idleAction.current.reset()
    
    // Set up initial state
    idleAction.current.fadeIn(0.5).play()
    currentAnimation.current = 'idle'
    
    // Cleanup function
    return () => {
      // Stop all animations when component unmounts
      mixer.current.stopAllAction()
    }
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

    // Store previous position for movement calculation
    const oldPosition = prevPosition.current.clone()

    // Handle movement
    const moveForward = keysPressed.current.has('w')
    const moveBackward = keysPressed.current.has('s')
    const moveLeft = keysPressed.current.has('a')
    const moveRight = keysPressed.current.has('d')

    let moveX = 0;
    let moveZ = 0;

    if (moveForward || moveBackward || moveLeft || moveRight) {
      // Calculate movement direction based on camera yaw
      moveX = Math.sin(yaw.current)
      moveZ = Math.cos(yaw.current)

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
      
      // Calculate world movement since last frame
      const worldMovement = position.current.clone().sub(oldPosition)
      const movementDistance = worldMovement.length()
      
      // Only process significant movement
      if (movementDistance > 0.001) {
        // Normalize the rotation angle
        const normalizedRotation = normalizeAngle(yaw.current + Math.PI)
        
        // Create a rotation quaternion based on the character's yaw
        const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0), // Y-axis
          normalizedRotation
        )
        
        // Create rotation matrix from quaternion
        const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(rotationQuaternion)
        
        // Get the inverse rotation matrix
        const inverseRotationMatrix = new THREE.Matrix4().copy(rotationMatrix).invert()
        
        // Transform world movement to local space
        const localMovement = worldMovement.clone().applyMatrix4(inverseRotationMatrix)
        
        // In local space, -Z is forward, +Z is backward
        const isBackward = localMovement.z < 0
        
        // Transition to walking if not already
        if (!isMoving.current) {
          isMoving.current = true
          
          // Only transition if we're not already in walking state
          if (currentAnimation.current !== 'walking') {
            idleAction.current.fadeOut(0.2)
            walkAction.current.reset().fadeIn(0.2).play()
            currentAnimation.current = 'walking'
          }
        }
        
        // Update animation direction if it changed
        if (isMovingBackwards.current !== isBackward) {
          walkAction.current.timeScale = isBackward ? -1 : 1
          isMovingBackwards.current = isBackward
          
          console.log(`LocalPlayer direction changed: backward=${isBackward}, timescale=${isBackward ? -1 : 1}`)
        }
      }
    } else if (isMoving.current) {
      isMoving.current = false
      
      // Only transition if we're not already in idle state
      if (currentAnimation.current !== 'idle') {
        walkAction.current.fadeOut(0.2)
        idleAction.current.reset().fadeIn(0.2).play()
        currentAnimation.current = 'idle'
      }
    }
    
    // Make sure animations are actually playing
    const ensureIdleIsPlaying = () => {
      if (!isMoving.current && !idleAction.current.isRunning()) {
        // Force restart idle animation if it's stopped unexpectedly
        idleAction.current.reset().fadeIn(0.2).play()
        currentAnimation.current = 'idle'
      }
    }
    
    // Check every 1 second to make sure idle animation is playing when it should be
    const currentTime = performance.now()
    if (currentTime % 1000 < 16.7) { // Run check roughly once per second (16.7ms is one frame at 60fps)
      ensureIdleIsPlaying()
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

    // Update server with position and rotation if enough time has passed and position has changed
    const currentRotation = yaw.current + Math.PI
    
    // Check if position or rotation has changed significantly
    const positionChanged = 
      Math.abs(position.current.x - lastSentPosition.current.x) > POSITION_THRESHOLD ||
      Math.abs(position.current.z - lastSentPosition.current.y) > POSITION_THRESHOLD;
    
    const rotationChanged = 
      Math.abs(currentRotation - lastSentPosition.current.rotation) > ROTATION_THRESHOLD;
    
    if (currentTime - lastUpdateTime.current >= UPDATE_INTERVAL && (positionChanged || rotationChanged)) {
      lastUpdateTime.current = currentTime;
      if (connection) {
        connection.reducers.updatePlayerPosition(
          { x: position.current.x, y: position.current.z }, // DbVector2 for position
          currentRotation // rotation as number
        )
        console.log("Updated player position to ", position.current, currentRotation);
        
        // Update last sent position
        lastSentPosition.current = {
          x: position.current.x,
          y: position.current.z,
          rotation: currentRotation
        };
      }
    }
    
    // Update previous position for next frame
    prevPosition.current.copy(position.current)
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
  const [otherPlayers, setOtherPlayers] = useState<Map<string, moduleBindings.Player>>(new Map());
  const [localIdentity, setLocalIdentity] = useState<string | null>(null);

  // Helper function to get player identity string
  const getPlayerIdentityString = (player: moduleBindings.Player): string => {
    return player.identity.toHexString();
  };

  // Set up subscription when connection is established
  useEffect(() => {
    if (connection) {
      console.log("Setting up subscription with local identity:", localIdentity);
      
      // Subscribe to all tables
      connection.subscriptionBuilder()
        .onApplied((ctx: moduleBindings.SubscriptionEventContext) => {
          console.log("Subscription applied, tables available:", ctx.db);
          // Initialize other players from existing data
          const players = new Map<string, moduleBindings.Player>();
          let playerCount = 0;
          for (const player of ctx.db.player.iter()) {
            playerCount++;
            const playerIdentity = getPlayerIdentityString(player);
            console.log("Found player:", playerIdentity, "position:", player.position);
            
            // Only add player if we have a local identity and this isn't the local player
            if (localIdentity && playerIdentity === localIdentity) {
              console.log("Skipped local player:", playerIdentity);
              continue;
            }
            else
            {
              console.log(`${playerIdentity} does not match local identity ${localIdentity}. Must be other player.`);
            }
            
            players.set(playerIdentity, player);
            console.log("Added other player:", playerIdentity);
          }
          console.log(`Total players found: ${playerCount}, other players: ${players.size}`);
          setOtherPlayers(players);
        })
        .onError((ctx: moduleBindings.ErrorContext) => {
          console.error("Subscription error:", ctx.event);
        })
        .subscribeToAllTables();

      // Set up callbacks for player table changes
      const onInsertCallback = (ctx: moduleBindings.EventContext, player: moduleBindings.Player) => {
        const playerIdentity = getPlayerIdentityString(player);
        console.log("New player joined:", playerIdentity, "position:", player.position);
        
        // Only filter out local player if we have a local identity
        if (!localIdentity || playerIdentity !== localIdentity) {
          console.log("Adding new other player:", playerIdentity);
          setOtherPlayers(prev => {
            const next = new Map(prev);
            next.set(playerIdentity, player);
            console.log("Other players count after insert:", next.size);
            return next;
          });
        } else {
          console.log("Skipped local player insert:", playerIdentity);
        }
      };

      const onDeleteCallback = (ctx: moduleBindings.EventContext, player: moduleBindings.Player) => {
        const playerIdentity = getPlayerIdentityString(player);
        console.log("Player left:", playerIdentity);
        setOtherPlayers(prev => {
          const next = new Map(prev);
          next.delete(playerIdentity);
          console.log("Other players count after delete:", next.size);
          return next;
        });
      };

      const onUpdateCallback = (ctx: moduleBindings.EventContext, oldPlayer: moduleBindings.Player, newPlayer: moduleBindings.Player) => {
        const playerIdentity = getPlayerIdentityString(newPlayer);
        //console.log("Player updated:", playerIdentity, "position:", newPlayer.position);
        
        // Only filter out local player if we have a local identity
        if (!localIdentity || playerIdentity !== localIdentity) {
          //console.log("Updating other player:", playerIdentity);
          setOtherPlayers(prev => {
            const next = new Map(prev);
            next.set(playerIdentity, newPlayer);
            return next;
          });
        } else {
          //console.log("Skipped local player update:", playerIdentity);
        }
      };

      // Register callbacks
      connection.db.player.onInsert(onInsertCallback);
      connection.db.player.onDelete(onDeleteCallback);
      connection.db.player.onUpdate(onUpdateCallback);

      // Cleanup function
      return () => {
        console.log("Cleaning up callbacks");
        connection.db.player.removeOnInsert(onInsertCallback);
        connection.db.player.removeOnDelete(onDeleteCallback);
        connection.db.player.removeOnUpdate(onUpdateCallback);
      };
    }
  }, [connection, localIdentity]);

  const handleConnect = (newConnection: moduleBindings.DbConnection, identity: string) => {
    console.log("Connecting with identity:", identity);
    setConnection(newConnection);
    setLocalIdentity(identity);
  };

  // Debug log for rendering
  console.log("Rendering with other players count:", otherPlayers.size);
  console.log("Other players:", Array.from(otherPlayers.values()).map(p => ({
    identity: getPlayerIdentityString(p),
    position: p.position,
    rotation: p.rotationYaw
  })));

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas>
        {/* Fixed camera for testing */}
        <PerspectiveCamera
          makeDefault
          position={[0, 10, 10]}
          fov={75}
          near={0.1}
          far={1000}
        />
        
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
        <Character onPositionChange={() => {}} isConnected={!!connection} connection={connection} />
        
        {/* Render other players */}
        {Array.from(otherPlayers.values()).map(player => {
          const playerIdentity = getPlayerIdentityString(player);
          console.log("Rendering other player:", playerIdentity, "at position:", player.position);
          return (
            <OtherPlayer key={playerIdentity} player={player} />
          );
        })}
      </Canvas>
      {!connection && <ConnectionPopup onConnect={handleConnect} />}
    </div>
  );
}

export default App
