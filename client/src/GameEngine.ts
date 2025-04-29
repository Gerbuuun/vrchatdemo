// client/src/GameEngine.ts
import * as THREE from 'three';
import * as moduleBindings from './module_bindings/index';
import { InputManager, InputState, InputUpdateCallback, MOUSE_SENSITIVITY, PITCH_LIMIT_LOW, PITCH_LIMIT_HIGH } from './InputManager';
import { SceneManager, AnimationName, LocalPlayerRenderData, RemotePlayerRenderData, AnimationState } from './SceneManager';

// --- Constants ---
const UPDATE_INTERVAL = 1000 / 30; // 30 times per second (ms)
const ROTATION_THRESHOLD = 0.01; // Min rotation change to send update

// --- Immutable Game State Definition ---
interface LocalPlayerState {
  readonly identity: string;
  readonly position: Readonly<THREE.Vector3>;
  readonly rotationY: number;
  readonly pitch: number;
  readonly input: InputState;
  readonly animationState: AnimationState;
  readonly hexColor?: string; // Player's hex color from database
}

interface GameState {
  readonly localPlayer: LocalPlayerState | null;
  readonly players: ReadonlyMap<string, moduleBindings.Player>;
  readonly collisionMeshes: ReadonlyMap<number, moduleBindings.Collider>;
}

// Update player rotation based on mouse movement
function updatePlayerRotation(player: LocalPlayerState, deltaX: number, deltaY: number): LocalPlayerState {
    const newRotationY = player.rotationY - deltaX * MOUSE_SENSITIVITY;
    const newPitch = Math.max(PITCH_LIMIT_LOW, Math.min(PITCH_LIMIT_HIGH, player.pitch + deltaY * MOUSE_SENSITIVITY));

    // Only update if there's a change
    if (newRotationY === player.rotationY && newPitch === player.pitch) {
        return player;
    }

    return {
        ...player,
        rotationY: newRotationY,
        pitch: newPitch,
    };
}

// Update remote players map based on database events
function updateRemotePlayersMap(
    currentPlayers: ReadonlyMap<string, moduleBindings.Player>,
    event: { type: 'insert' | 'update' | 'delete' | 'initial', data: any, localId: string }
): ReadonlyMap<string, moduleBindings.Player> {
    const nextPlayers = new Map(currentPlayers);

    switch (event.type) {
        case 'initial':
            nextPlayers.clear();
            for (const player of event.data as moduleBindings.Player[]) {
                 const playerId = player.identity.toHexString();
                 if (playerId !== event.localId) {
                     nextPlayers.set(playerId, player);
                 }
            }
            break;
        case 'insert':
        case 'update': {
            const player = event.data as moduleBindings.Player;
            const playerId = player.identity.toHexString();
            if (playerId !== event.localId) {
                nextPlayers.set(playerId, player);
            }
            break;
        }
        case 'delete': {
            const player = event.data as moduleBindings.Player;
            const playerId = player.identity.toHexString();
            if (playerId !== event.localId) {
                nextPlayers.delete(playerId);
            }
            break;
        }
    }
    return nextPlayers; // Return the new map (which becomes readonly on assignment)
}

// --- Initial State ---
const initialInputState: InputState = {
    forward: false, backward: false, left: false, right: false, jump: false, isPointerLocked: false
};

const initialGameState: GameState = {
  localPlayer: null,
  players: new Map(),
  collisionMeshes: new Map(),
};

export class GameEngine {
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private canvasContainer: HTMLDivElement;

  // Immutable Game State
  private state: GameState;
  
  // Debug state
  private isDebugActive: boolean = false;

  // Connection related
  private connection: moduleBindings.DbConnection | null = null;
  private lastUpdateTime: number = 0; // For throttling server updates
  private lastSentInput: InputState & { rotation: number };
  private dbCallbacks: { onInsert: any, onDelete: any, onUpdate: any } | null = null;

  private isDisposed: boolean = false;
  private inputManager: InputManager;
  private sceneManager: SceneManager;

  constructor(canvasContainer: HTMLDivElement) {
    this.canvasContainer = canvasContainer;

    // Basic State Init (Immutable)
    this.state = initialGameState;
    this.lastSentInput = { ...initialInputState, rotation: 0 };

    // Initialize Input Manager
    this.inputManager = new InputManager(this.canvasContainer, this.handleInputUpdate.bind(this));

    // Initialize Scene Manager
    this.sceneManager = new SceneManager(this.canvasContainer);
    this.sceneManager.loadAssets(() => {
      // If we have a local player but no model yet, trigger an update
      if (this.state.localPlayer) {
        this.updateSceneFromState(this.state);
      }
    });

    // Add keydown listener specifically for debug toggle ('P')
    window.addEventListener('keydown', this.handleDebugToggleKey);

    // Start the loop
    this.lastTimestamp = performance.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }
  
  // Handle debug toggle key ('P')
  private handleDebugToggleKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === 'p') {
      this.toggleDebugMode();
    }
    if (e.key.toLowerCase() === '[') {
      this.sceneManager.setNextVisibleCollisionMesh();
    }
    if (e.key.toLowerCase() === ']') {
      this.sceneManager.setPreviousVisibleCollisionMesh();
    }
  };

  // Callback function passed to InputManager to handle state updates
  private handleInputUpdate(update: Parameters<InputUpdateCallback>[0]): void {
    if (!this.state.localPlayer) return;

    let nextPlayerState = this.state.localPlayer;

    switch (update.type) {
        case 'key':
            if (nextPlayerState.input[update.key] !== update.pressed) {
                nextPlayerState = {
                    ...nextPlayerState,
                    input: { ...nextPlayerState.input, [update.key]: update.pressed }
                };
            }
            break;
        case 'pointerLock':
             if (nextPlayerState.input.isPointerLocked !== update.isLocked) {
                nextPlayerState = {
                    ...nextPlayerState,
                    input: { ...nextPlayerState.input, isPointerLocked: update.isLocked }
                };
             }
            break;
        case 'rotation':
            // Apply rotation update with proper clamping and sensitivity
            nextPlayerState = updatePlayerRotation(nextPlayerState, update.deltaX, update.deltaY);
            break;
    }

    // Only update the main state if the player state actually changed
    if (nextPlayerState !== this.state.localPlayer) {
        this.state = { ...this.state, localPlayer: nextPlayerState };
    }
  }

  // --- Core Game Loop ---
  private gameLoop = (timestamp: number) => {
    if (this.isDisposed) return;
    this.animationFrameId = requestAnimationFrame(this.gameLoop);

    const deltaTime = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // Avoid large jumps or negative delta
    if (deltaTime <= 0 || deltaTime > 0.5) {
      return;
    }

    // Make a deep copy of the current state BEFORE any updates
    const previousState = this.deepCopyState(this.state);
    
    // 1a. Apply pending mouse movement (handled by InputManager, triggers callback)
    this.inputManager.applyPendingMouseMovement();

    // 2. Now log state changes (comparing against the copy made before any updates)
    if (this.isDebugActive) {
      this.logStateChanges(previousState, this.state);
    }

    // 3. Update the scene based on new state
    this.updateSceneFromState(this.state);

    // 4. Update animations
    this.sceneManager.updateAnimations(deltaTime);
    
    // 5. Send updates to server based on the new state
    this.sendServerUpdates();

    // 5.5 Update debug info if active
    if (this.isDebugActive) {
      this.updateDebugInfo();
    }

    // 6. Render the scene
    this.sceneManager.render();
  };
  
  // Update scene with current game state
  private updateSceneFromState(state: GameState): void {
    // Update local player render data
    const localRenderData = state.localPlayer ? this.createLocalPlayerRenderData(state.localPlayer) : null;
    this.sceneManager.updateLocalPlayer(localRenderData);
    
    // Create remote player render data
    const remotePlayersData = new Map<string, RemotePlayerRenderData>();
    
    state.players.forEach((player, id) => {
      remotePlayersData.set(id, {
        identity: id,
        position: player.position,
        rotationYaw: player.rotationYaw,
        animationState: player.animationState as AnimationState,
        hexColor: player.hexColor
      });
    });
    
    // Update remote players
    this.sceneManager.updateRemotePlayers(remotePlayersData);
  }
  
  // Convert local player state to render data for SceneManager
  private createLocalPlayerRenderData(player: LocalPlayerState): LocalPlayerRenderData {
    return {
      identity: player.identity,
      position: player.position,
      rotationY: player.rotationY,
      pitch: player.pitch,
      animationState: player.animationState,
      hexColor: player.hexColor || "#3498db" // Use player's color or fallback to blue
    };
  }
  
  // Update debug info in SceneManager
  private updateDebugInfo(): void {
    const localRenderData = this.state.localPlayer ? this.createLocalPlayerRenderData(this.state.localPlayer) : null;
    
    const remotePlayersData = new Map<string, RemotePlayerRenderData>();
    this.state.players.forEach((player, id) => {
      remotePlayersData.set(id, {
        identity: id,
        position: player.position,
        rotationYaw: player.rotationYaw,
        animationState: player.animationState as AnimationState
      });
    });
    
    this.sceneManager.updateDebugInfo(localRenderData, remotePlayersData);
  }
  
  // Deep copy the state to avoid reference issues
  private deepCopyState(state: GameState): GameState {
    const result: GameState = {
      players: new Map(state.players),
      localPlayer: state.localPlayer ? {
        ...state.localPlayer,
        position: state.localPlayer.position.clone(),
        input: { ...state.localPlayer.input },
      } : null,
      collisionMeshes: new Map(state.collisionMeshes),
    };
    return result;
  }
  
  // Log changes between states for debugging
  private logStateChanges(oldState: GameState, newState: GameState) {
    if (this.hasStateChanged(oldState, newState)) {
      console.log('=== GAME STATE CHANGED ===');
      console.log('New State', newState);
      
      if (oldState.localPlayer && newState.localPlayer) {
        const oldRotY = oldState.localPlayer.rotationY;
        const newRotY = newState.localPlayer.rotationY;
        const oldPitch = oldState.localPlayer.pitch;
        const newPitch = newState.localPlayer.pitch;
        if (Math.abs(oldRotY! - newRotY!) > 0.0001 || Math.abs(oldPitch! - newPitch!) > 0.0001) {
          console.log(`  Raw Rot/Pitch: Y=${newRotY.toFixed(3)}, P=${newPitch.toFixed(3)}`);
        }
      }
    }
  }

  // --- Server Communication ---
  private sendServerUpdates() {
    if (!this.connection || !this.state.localPlayer) return;

    const now = performance.now();
    const { input, rotationY } = this.state.localPlayer;
    const currentRotation = rotationY + Math.PI; // Server expects rotation relative to +Z

    // Check thresholds against last *sent* data
    const { rotation, ...lastSentInput } = this.lastSentInput;
    const inputChanged = JSON.stringify(input) !== JSON.stringify(lastSentInput);
    const rotationChanged = Math.abs(currentRotation - rotation) > ROTATION_THRESHOLD;

    // Send position/rotation update if interval passed AND values changed
    if (now - this.lastUpdateTime >= UPDATE_INTERVAL && (inputChanged || rotationChanged)) {
        try {
            this.connection.reducers.updatePlayerInput(input, currentRotation);
            this.lastSentInput = { ...input, rotation: currentRotation };
            this.lastUpdateTime = now;
        } catch (error) {
            console.error("Failed to send player position update:", error);
        }
    }
  }

  public connect = (connection: moduleBindings.DbConnection, identity: string) => {
    this.disconnect(); // Clean up previous connection first
    this.connection = connection;

    const initialPosition = new THREE.Vector3(0, 0, 0);
    const initialRotationY = 0; // Facing positive Z initially (model faces -Z)
    const initialPitch = Math.PI / 2; // Look straight ahead
    const initialAnimation: AnimationName = 'idle';

    // Initialize immutable state for the new connection
    this.state = {
      players: new Map(),
      localPlayer: {
        identity: identity,
        position: initialPosition,
        rotationY: initialRotationY,
        pitch: initialPitch,
        input: initialInputState,
        animationState: initialAnimation,
      },
      collisionMeshes: new Map(),
    };

    // Calculate initial values to send to the server
    const initialServerRotation = initialRotationY + Math.PI; // Server expects rotation relative to +Z

    // Send initial state immediately
    if (this.connection && this.state.localPlayer) {
      try {
        this.connection.reducers.updatePlayerInput(initialInputState, initialServerRotation);
        this.lastSentInput = { ...initialInputState, rotation: initialServerRotation };

        this.lastUpdateTime = performance.now();
      } catch (error) {
        console.error("Failed to send initial player state on connect:", error);
      }
    } else {
        this.lastSentInput = { ...initialInputState, rotation: initialServerRotation };
        this.lastUpdateTime = 0;
    }

    // Setup DB subscription
    this.setupDbSubscription(identity);

    // Update the scene with the new state
    this.updateSceneFromState(this.state);
  };

  public disconnect() {
    if (this.connection && this.dbCallbacks) {
      try {
        this.connection.db.player.removeOnInsert(this.dbCallbacks.onInsert);
        this.connection.db.player.removeOnDelete(this.dbCallbacks.onDelete);
        this.connection.db.player.removeOnUpdate(this.dbCallbacks.onUpdate);
      } catch (error) {
        console.error("Error removing DB callbacks:", error);
      }
      this.dbCallbacks = null;
    }
    this.connection = null;

    // Reset state to initial
    this.state = initialGameState;

    // Update scene to remove all players
    this.updateSceneFromState(this.state);
  }

  private setupDbSubscription(localPlayerIdentity: string) {
    if (!this.connection) {
      console.error("Connection not available for DB subscription.");
      return;
    }

    // Define callbacks that update the immutable state
    const onInsert = (ctx: moduleBindings.EventContext, player: moduleBindings.Player) => {
       if (!this.connection) return;
       
       // If this insert is for the local player, update the local player color
       const playerId = player.identity.toHexString();
       if (playerId === localPlayerIdentity && this.state.localPlayer) {
         const updatedLocalPlayer = {
           ...this.state.localPlayer,
           hexColor: player.hexColor
         };
         
         this.state = {
           ...this.state,
           localPlayer: updatedLocalPlayer
         };
         
         this.updateSceneFromState(this.state);
       }
       
       // Update the remote players state
       const nextPlayersMap = updateRemotePlayersMap(this.state.players, { type: 'insert', data: player, localId: localPlayerIdentity });
       if (nextPlayersMap !== this.state.players) {
            const nextState = { ...this.state, players: nextPlayersMap };
            this.state = nextState;
            this.updateSceneFromState(this.state);
       }
    };

    const onDelete = (ctx: moduleBindings.EventContext, player: moduleBindings.Player) => {
        if (!this.connection || this.state.localPlayer?.identity !== localPlayerIdentity) return;
        
        const nextPlayersMap = updateRemotePlayersMap(this.state.players, { type: 'delete', data: player, localId: localPlayerIdentity });
        if (nextPlayersMap !== this.state.players) {
           const nextState = { ...this.state, players: nextPlayersMap };
           this.state = nextState;
           this.updateSceneFromState(this.state);
        }
    };

    const onUpdate = (ctx: moduleBindings.EventContext, oldPlayer: moduleBindings.Player, newPlayer: moduleBindings.Player) => {
        if (!this.connection || this.state.localPlayer?.identity !== localPlayerIdentity) return;
        const playerId = newPlayer.identity.toHexString();

        // If this update is for the local player, update the color
        if (playerId === localPlayerIdentity && this.state.localPlayer) {
          this.state = {
            ...this.state,
            localPlayer: {
              ...this.state.localPlayer,
              hexColor: newPlayer.hexColor,
              position: new THREE.Vector3(newPlayer.position.x, newPlayer.position.y, newPlayer.position.z),
              animationState: newPlayer.animationState as AnimationState,
            }
          };
          this.updateSceneFromState(this.state);
        }

        // Update the remote player state
        const nextPlayersMap = updateRemotePlayersMap(this.state.players, { type: 'update', data: newPlayer, localId: localPlayerIdentity });
        if (nextPlayersMap !== this.state.players) {
            const nextState = { ...this.state, players: nextPlayersMap };
            this.state = nextState; 
            this.updateSceneFromState(this.state);
        } else if (this.state.players.has(playerId)) {
            this.updateSceneFromState(this.state);
        }
    };

    // Store callbacks for removal
    this.dbCallbacks = { onInsert, onDelete, onUpdate };

    // Subscribe
    this.connection.subscriptionBuilder()
      .onApplied((ctx: moduleBindings.SubscriptionEventContext) => {
        if (!this.connection || this.state.localPlayer?.identity !== localPlayerIdentity) {
             return;
        }

        // Load collision meshes
        const initialColliders = Array.from(ctx.db.collider.iter());
        console.log(`Initial colliders: ${initialColliders.length}`);
        const meshes: THREE.Vector3[][] = [];
        initialColliders.forEach(collider => meshes.push(collider.positions.map(v => new THREE.Vector3(v.x, v.y, v.z))));
        this.sceneManager.setCollisionMeshes(meshes);

        const initialPlayers = Array.from(ctx.db.player.iter());

        // Look for the local player in initial data to get their color
        const localPlayerData = initialPlayers.find(p => p.identity.toHexString() === localPlayerIdentity);
        if (localPlayerData && this.state.localPlayer) {
          this.state = {
            ...this.state,
            localPlayer: {
              ...this.state.localPlayer,
              hexColor: localPlayerData.hexColor
            }
          };
        }

        // Update state with initial players
        this.state = {
            ...this.state,
            players: updateRemotePlayersMap(this.state.players, { type: 'initial', data: initialPlayers, localId: localPlayerIdentity }),
            collisionMeshes: new Map(initialColliders.map(c => [c.id, c])),
        };

        // Register dynamic listeners AFTER processing initial state
        this.connection.db.player.onInsert(onInsert);
        this.connection.db.player.onDelete(onDelete);
        this.connection.db.player.onUpdate(onUpdate);

        // Update the scene with the new state including initial players
        this.updateSceneFromState(this.state);
      })
      .onError((ctx: moduleBindings.ErrorContext) => {
        console.error("DB Subscription error:", ctx.event);
        this.disconnect(); // Disconnect on subscription error
      })
      .subscribeToAllTables();
  }

  private toggleDebugMode() {
    this.isDebugActive = !this.isDebugActive;
    this.sceneManager.setDebugMode(this.isDebugActive);
    
    if (this.isDebugActive) {
      this.updateDebugInfo();
    }
  }
  
  private hasStateChanged(oldState: GameState, newState: GameState): boolean {
    return JSON.stringify(oldState) !== JSON.stringify(newState);
  }

  public dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;

    // Stop game loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clean up connection and DB listeners
    this.disconnect();

    // Dispose the SceneManager
    this.sceneManager.dispose();
    
    // Remove the debug key listener
    window.removeEventListener('keydown', this.handleDebugToggleKey);
  }
} 
