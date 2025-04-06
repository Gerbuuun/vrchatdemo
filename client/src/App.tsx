import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'

function Stadium() {
  const { scene } = useGLTF('/src/assets/models/low_poly_stadium/scene.gltf')
  return <primitive object={scene} scale={0.1} position={[0, 0, 0]} />
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
        <OrbitControls />
      </Canvas>
    </div>
  )
}

export default App
