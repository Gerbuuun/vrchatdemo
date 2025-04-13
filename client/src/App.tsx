import React, { useEffect, useState, useRef } from 'react'
import { ConnectionPopup } from './components/ConnectionPopup'
import * as moduleBindings from './module_bindings/index'
import { GameEngine } from './GameEngine'; 

function App() {
  const [connection, setConnection] = useState<moduleBindings.DbConnection | null>(null);
  const mountRef = useRef<HTMLDivElement>(null); 
  const gameEngineRef = useRef<GameEngine | null>(null); 

  // Effect to initialize and cleanup the GameEngine
  useEffect(() => {
    if (!mountRef.current) {
      console.error("Mount point ref is not available yet.");
      return;
    }

    console.log("App: Initializing GameEngine...");
    const engine = new GameEngine(mountRef.current);
    gameEngineRef.current = engine;

    return () => {
      console.log("App: Disposing GameEngine...");
      engine.dispose();
      gameEngineRef.current = null;
    };
  }, []); 

  // Handler for when the ConnectionPopup successfully connects
  const handleConnect = (newConnection: moduleBindings.DbConnection, identity: string) => {
    console.log("App: Connection established, identity:", identity);
    setConnection(newConnection); // Update connection state (for UI, e.g., hiding popup)

    // Pass the connection details to the GameEngine
    if (gameEngineRef.current) {
      gameEngineRef.current.connect(newConnection, identity);
    } else {
      console.error("GameEngine not initialized when handleConnect was called.");
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Mount point for Three.js canvas managed by GameEngine */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Connection Popup overlay - shown only when not connected */}
      {!connection && <ConnectionPopup onConnect={handleConnect} />}

      {/* Other UI elements could go here, potentially reading state from GameEngine if needed */}
      {/* Example: <HUD score={gameEngineRef.current?.state.score} /> */}
    </div>
  );
}

export default App;
