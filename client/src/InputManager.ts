import * as THREE from 'three'; // Needed for Vector3 potentially if more complex logic moves

// --- Constants ---
export const MOUSE_SENSITIVITY = 0.002;
export const PITCH_LIMIT_LOW = 1.2; // radians from vertical down
export const PITCH_LIMIT_HIGH = Math.PI - 0.1; // radians from vertical up


// --- Type Definitions ---
export interface InputState {
  readonly forward: boolean;
  readonly backward: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly isPointerLocked: boolean;
}

interface MouseMovement {
  deltaX: number;
  deltaY: number;
}

// Type for the callback function to update GameEngine state
export type InputUpdateCallback = (
    update: |
    { type: 'key', key: 'forward' | 'backward' | 'left' | 'right', pressed: boolean } |
    { type: 'rotation', deltaX: number, deltaY: number } |
    { type: 'pointerLock', isLocked: boolean }
) => void;


// --- Input Manager Class ---
export class InputManager {
    private canvasContainer: HTMLDivElement;
    private updateCallback: InputUpdateCallback;
    private pendingMouseMovement: MouseMovement = { deltaX: 0, deltaY: 0 };
    private isPointerLocked: boolean = false;

    constructor(canvasContainer: HTMLDivElement, updateCallback: InputUpdateCallback) {
        this.canvasContainer = canvasContainer;
        this.updateCallback = updateCallback;
        this.setupInputListeners();
        console.log("InputManager: Initialized.");
    }

    // --- Input Handling ---
    private setupInputListeners() {
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        window.addEventListener('mousemove', this.handleMouseMove);
        this.canvasContainer.addEventListener('click', this.handleClick);
        document.addEventListener('pointerlockchange', this.handlePointerLockChange);
        console.log("InputManager: Input listeners added.");
    }

    private removeInputListeners() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('mousemove', this.handleMouseMove);
        this.canvasContainer.removeEventListener('click', this.handleClick);
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
        if (document.pointerLockElement === this.canvasContainer) {
            document.exitPointerLock();
        }
        console.log("InputManager: Input listeners removed.");
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        switch (key) {
            case 'w': this.updateCallback({ type: 'key', key: 'forward', pressed: true }); break;
            case 's': this.updateCallback({ type: 'key', key: 'backward', pressed: true }); break;
            case 'a': this.updateCallback({ type: 'key', key: 'left', pressed: true }); break;
            case 'd': this.updateCallback({ type: 'key', key: 'right', pressed: true }); break;
        }
    };

    private handleKeyUp = (e: KeyboardEvent) => {
       const key = e.key.toLowerCase();
        switch (key) {
            case 'w': this.updateCallback({ type: 'key', key: 'forward', pressed: false }); break;
            case 's': this.updateCallback({ type: 'key', key: 'backward', pressed: false }); break;
            case 'a': this.updateCallback({ type: 'key', key: 'left', pressed: false }); break;
            case 'd': this.updateCallback({ type: 'key', key: 'right', pressed: false }); break;
        }
    };

    private handlePointerLockChange = () => {
        this.isPointerLocked = document.pointerLockElement === this.canvasContainer;
        this.updateCallback({ type: 'pointerLock', isLocked: this.isPointerLocked });
        this.canvasContainer.style.cursor = this.isPointerLocked ? 'none' : 'default';
        console.log("InputManager: Pointer lock changed:", this.isPointerLocked);
         // Reset pending movement when lock changes to avoid jumps
        this.pendingMouseMovement = { deltaX: 0, deltaY: 0 };
    };

    private handleMouseMove = (e: MouseEvent) => {
        if (!this.isPointerLocked) return;
        // Accumulate mouse movement for the next frame update
        this.pendingMouseMovement.deltaX += e.movementX;
        this.pendingMouseMovement.deltaY += e.movementY;
    };

    private handleClick = () => {
        if (!this.isPointerLocked) {
            this.canvasContainer.requestPointerLock()
                .catch(err => console.error("InputManager: Failed to acquire pointer lock:", err));
        }
    };

    // Apply accumulated mouse movement - called by GameEngine's game loop
    public applyPendingMouseMovement(): void {
        if (!this.isPointerLocked) return; // Should not apply if not locked

        // Skip if no movement
        if (this.pendingMouseMovement.deltaX === 0 && this.pendingMouseMovement.deltaY === 0) {
            return;
        }

        // Send the accumulated movement via the callback
        this.updateCallback({
            type: 'rotation',
            deltaX: this.pendingMouseMovement.deltaX,
            deltaY: this.pendingMouseMovement.deltaY
        });

        // Reset pending movement for next frame
        this.pendingMouseMovement = { deltaX: 0, deltaY: 0 };
    }

    public dispose(): void {
        this.removeInputListeners();
        console.log("InputManager: Disposed.");
    }
} 