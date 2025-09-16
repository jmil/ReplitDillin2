import React, { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { NetworkData } from "../../lib/types";
import { usePapers } from "../../lib/stores/usePapers";

interface UniverseViewProps {
  data: NetworkData;
  fullscreen?: boolean;
}

interface FlowingPaperProps {
  node: any;
  position: THREE.Vector3;
  timeOffset: number;
  onClick: () => void;
  isSelected: boolean;
}

function FlowingPaper({ node, position, timeOffset, onClick, isSelected }: FlowingPaperProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [localTime, setLocalTime] = React.useState(timeOffset);

  useFrame((state, delta) => {
    setLocalTime(prev => prev + delta * 0.5);
    
    if (meshRef.current) {
      // Temporal funnel effect - papers flow downward in a spiral
      const year = new Date(node.paper.publishDate).getFullYear();
      const currentYear = new Date().getFullYear();
      const yearProgress = (year - 1950) / (currentYear - 1950); // Normalize to 0-1
      
      // Create spiral motion
      const spiralRadius = 8 - (yearProgress * 6); // Older papers further out
      const angle = localTime + timeOffset;
      
      meshRef.current.position.x = Math.cos(angle) * spiralRadius;
      meshRef.current.position.z = Math.sin(angle) * spiralRadius;
      meshRef.current.position.y = (yearProgress * 20) - 10; // Temporal depth
      
      // Gentle rotation
      meshRef.current.rotation.x += delta * 0.2;
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'main': return '#3B82F6';
      case 'reference': return '#10B981';
      case 'citation': return '#F59E0B';
      case 'similar': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const getNodeSize = (type: string) => {
    return type === 'main' ? 0.8 : 0.4;
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        onClick={onClick}
        position={position}
      >
        <boxGeometry args={[getNodeSize(node.type), getNodeSize(node.type), 0.1]} />
        <meshStandardMaterial 
          color={getNodeColor(node.type)}
          emissive={isSelected ? getNodeColor(node.type) : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
          transparent
          opacity={0.8}
        />
        
        {/* Paper information */}
        <Html distanceFactor={8} position={[0, 1, 0]}>
          <div className="pointer-events-none text-center">
            <div 
              className={`bg-black bg-opacity-80 text-white rounded px-2 py-1 text-xs max-w-32 ${
                isSelected ? 'border border-red-400' : ''
              }`}
              style={{ transform: 'translate(-50%, -100%)' }}
            >
              <div className="font-medium truncate text-white">
                {node.paper.title.substring(0, 25)}...
              </div>
              <div className="text-gray-300 text-xs">
                {new Date(node.paper.publishDate).getFullYear()}
              </div>
              <div className="text-gray-400 text-xs capitalize">
                {node.type}
              </div>
            </div>
          </div>
        </Html>
      </mesh>
      
      {/* Selection indicator */}
      {isSelected && (
        <mesh position={position}>
          <ringGeometry args={[1, 1.2, 16]} />
          <meshBasicMaterial color="#EF4444" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

function TemporalFunnel() {
  const funnelRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (funnelRef.current) {
      funnelRef.current.rotation.y += delta * 0.1;
    }
  });

  // Create funnel geometry points
  const funnelPoints = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 20; i++) {
      const y = (i / 20) * 20 - 10;
      const radius = 10 - (i / 20) * 8; // Funnel shape
      points.push(new THREE.Vector2(radius, y));
    }
    return points;
  }, []);

  return (
    <group ref={funnelRef}>
      {/* Funnel wireframe */}
      <mesh rotation={[0, 0, 0]}>
        <latheGeometry args={[funnelPoints, 32]} />
        <meshBasicMaterial 
          color="#ffffff" 
          wireframe 
          transparent 
          opacity={0.1} 
        />
      </mesh>
      
      {/* Time axis labels */}
      {[1960, 1980, 2000, 2020].map((year, index) => (
        <Html 
          key={year}
          position={[12, (index * 5) - 7.5, 0]}
          distanceFactor={10}
        >
          <div className="text-white text-sm font-mono bg-black bg-opacity-60 px-2 py-1 rounded">
            {year}
          </div>
        </Html>
      ))}
    </group>
  );
}

function UniverseScene({ data }: { data: NetworkData }) {
  const { setSelectedPaper, selectedPaper } = usePapers();

  // Sort nodes by publication date for temporal effect
  const sortedNodes = useMemo(() => {
    return [...data.nodes].sort((a, b) => {
      return new Date(a.paper.publishDate).getTime() - new Date(b.paper.publishDate).getTime();
    });
  }, [data.nodes]);

  return (
    <>
      {/* Cosmic lighting */}
      <ambientLight intensity={0.3} color="#4A90E2" />
      <directionalLight position={[0, 10, 0]} intensity={0.8} color="#ffffff" />
      <pointLight position={[0, 0, 0]} intensity={1} color="#FFD700" />

      {/* Temporal funnel structure */}
      <TemporalFunnel />

      {/* Flowing papers */}
      {sortedNodes.map((node, index) => (
        <FlowingPaper
          key={node.id}
          node={node}
          position={new THREE.Vector3(0, 0, 0)}
          timeOffset={index * 0.5}
          onClick={() => setSelectedPaper(node.paper)}
          isSelected={selectedPaper?.id === node.id}
        />
      ))}

      {/* Cosmic background */}
      <mesh>
        <sphereGeometry args={[100, 32, 32]} />
        <meshBasicMaterial 
          color="#000818" 
          side={THREE.BackSide}
        />
      </mesh>

      {/* Floating cosmic particles */}
      {Array.from({ length: 200 }).map((_, i) => {
        const position = [
          (Math.random() - 0.5) * 80,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 80
        ] as [number, number, number];
        
        return (
          <mesh key={i} position={position}>
            <sphereGeometry args={[0.05, 4, 4]} />
            <meshBasicMaterial 
              color={Math.random() > 0.5 ? "#ffffff" : "#4A90E2"} 
              transparent 
              opacity={Math.random() * 0.8 + 0.2} 
            />
          </mesh>
        );
      })}

      {/* Energy streams */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh 
            key={`stream-${i}`}
            position={[Math.cos(angle) * 15, 0, Math.sin(angle) * 15]}
            rotation={[0, angle, 0]}
          >
            <cylinderGeometry args={[0.02, 0.02, 20]} />
            <meshBasicMaterial 
              color="#4A90E2" 
              transparent 
              opacity={0.3} 
            />
          </mesh>
        );
      })}
    </>
  );
}

export function UniverseView({ data, fullscreen }: UniverseViewProps) {
  if (data.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center text-gray-300">
          <div className="text-4xl mb-4">🌌</div>
          <p>No universe data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative bg-gray-900">
      <Canvas
        camera={{ 
          position: [15, 5, 15], 
          fov: 70,
          near: 0.1,
          far: 1000 
        }}
        gl={{ antialias: true }}
      >
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={8}
          maxDistance={40}
          autoRotate={false}
        />
        <UniverseScene data={data} />
      </Canvas>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-90 text-white p-4 rounded-lg">
        <h4 className="font-semibold text-sm mb-3">Universe View</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span>Main Paper</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded bg-green-500"></div>
            <span>References</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded bg-yellow-500"></div>
            <span>Citations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded bg-purple-500"></div>
            <span>Similar</span>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-600">
          <div className="text-xs text-gray-300">
            Papers flow through time in a cosmic funnel
          </div>
        </div>
      </div>

      {/* Time indicator */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-90 text-white p-3 rounded-lg">
        <div className="text-xs">
          <div className="font-semibold mb-1">Temporal Flow</div>
          <div>↓ Future → Present → Past ↓</div>
          <div className="text-gray-400 mt-2">
            Papers spiral down through the research timeline
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 bg-black bg-opacity-90 text-white p-3 rounded-lg">
        <div className="text-xs space-y-1">
          <div>• Mouse to navigate universe</div>
          <div>• Scroll to zoom in/out</div>
          <div>• Click papers to select</div>
          <div>• Watch temporal flow</div>
        </div>
      </div>
    </div>
  );
}
