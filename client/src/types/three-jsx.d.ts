import { MeshProps, Object3DProps } from '@react-three/fiber'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: MeshProps
      boxGeometry: Object3DProps
      meshStandardMaterial: Object3DProps
      ambientLight: Object3DProps
      pointLight: Object3DProps
    }
  }
} 