import React, { useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import * as THREE from "three";
import { NetworkData } from "../../lib/types";
import { usePapers } from "../../lib/stores/usePapers";
import { formatPubMedCitation } from "../../lib/utils";

interface OrbitViewProps {
  data: NetworkData;
  fullscreen?: boolean;
}

interface OrbitingNodeProps {
  node: any;
  radius: number;
  speed: number;
  color: string;
  onClick: () => void;
  isSelected: boolean;
}

function OrbitingNode({ node, radius, speed, color, onClick, isSelected }: OrbitingNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [time, setTime] = React.useState(Math.random() * Math.PI * 2);

  useFrame((state, delta) => {
    setTime(prev => prev + delta * speed);
    if (meshRef.current) {
      meshRef.current.position.x = Math.cos(time) * radius;
      meshRef.current.position.z = Math.sin(time) * radius;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        onClick={onClick}
        position={[Math.cos(time) * radius, 0, Math.sin(time) * radius]}
      >
        <sphereGeometry args={[isSelected ? 0.8 : 0.5, 16, 16]} />
        <meshStandardMaterial 
          color={color} 
          emissive={isSelected ? color : '#000000'}
          emissiveIntensity={isSelected ? 0.2 : 0}
        />
        
        {/* Orbital trail */}
        <Html distanceFactor={10}>
          <div className="pointer-events-none">
            <div 
              className={`bg-white rounded px-3 py-2 text-xs shadow-md max-w-48 ${
                isSelected ? 'border-2 border-red-400' : 'border border-gray-200'
              }`}
              style={{ transform: 'translate(-50%, -150%)' }}
            >
              <div className="font-medium truncate mb-1">
                {node.paper.title.substring(0, 30)}...
              </div>
              <div className="text-gray-500 text-xs mb-1">
                {new Date(node.paper.publishDate).getFullYear()}
              </div>
              <div className="text-xs text-gray-700 border-t pt-1">
                <span className="font-medium text-blue-700">PubMed Citation: </span>
                <span className="leading-tight">{formatPubMedCitation(node.paper).substring(0, 80)}...</span>
              </div>
            </div>
          </div>
        </Html>
      </mesh>
      
      {/* Orbit path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[radius - 0.05, radius + 0.05, 64]} />
        <meshBasicMaterial color="#e5e7eb" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function CentralNode({ node, onClick, isSelected }: { node: any; onClick: () => void; isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} onClick={onClick}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshStandardMaterial 
          color="#3B82F6" 
          emissive="#1E40AF"
          emissiveIntensity={0.3}
        />
        
        <Html distanceFactor={15}>
          <div className="pointer-events-none text-center">
            <div 
              className={`bg-blue-50 rounded-lg px-4 py-3 shadow-lg max-w-60 border-2 ${
                isSelected ? 'border-red-400' : 'border-blue-200'
              }`}
              style={{ transform: 'translate(-50%, -200%)' }}
            >
              <div className="font-bold text-blue-900 text-sm mb-1">
                Main Paper
              </div>
              <div className="font-medium text-xs text-blue-800 leading-tight mb-2">
                {node.paper.title.substring(0, 50)}...
              </div>
              <div className="text-blue-600 text-xs mb-2">
                {new Date(node.paper.publishDate).getFullYear()} • {node.paper.journal}
              </div>
              <div className="bg-white rounded p-2 border border-blue-200">
                <div className="text-xs text-gray-700 leading-relaxed">
                  <span className="font-medium text-blue-800">PubMed Citation: </span>
                  <span>{formatPubMedCitation(node.paper).substring(0, 100)}...</span>
                </div>
              </div>
            </div>
          </div>
        </Html>
      </mesh>
      
      {/* Glow effect */}
      <mesh>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial 
          color="#3B82F6" 
          transparent 
          opacity={0.1} 
        />
      </mesh>
    </group>
  );
}

function OrbitScene({ data }: { data: NetworkData }) {
  const { setSelectedPaper, selectedPaper } = usePapers();

  const mainNode = data.nodes.find(node => node.type === 'main');
  const otherNodes = data.nodes.filter(node => node.type !== 'main');

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'reference': return '#10B981';
      case 'citation': return '#F59E0B';
      case 'similar': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const getOrbitRadius = (index: number, total: number, type: string) => {
    const baseRadius = type === 'reference' ? 4 : type === 'citation' ? 6 : 8;
    const variation = (index / total) * 1.5;
    return baseRadius + variation;
  };

  const getOrbitSpeed = (type: string) => {
    switch (type) {
      case 'reference': return 0.3;
      case 'citation': return 0.2;
      case 'similar': return 0.15;
      default: return 0.25;
    }
  };

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[0, 5, 0]} intensity={0.5} />

      {/* Central main paper */}
      {mainNode && (
        <CentralNode 
          node={mainNode}
          onClick={() => setSelectedPaper(mainNode.paper)}
          isSelected={selectedPaper?.id === mainNode.id}
        />
      )}

      {/* Orbiting papers */}
      {otherNodes.map((node, index) => (
        <OrbitingNode
          key={node.id}
          node={node}
          radius={getOrbitRadius(index, otherNodes.length, node.type)}
          speed={getOrbitSpeed(node.type)}
          color={getNodeColor(node.type)}
          onClick={() => setSelectedPaper(node.paper)}
          isSelected={selectedPaper?.id === node.id}
        />
      ))}

      {/* Background stars */}
      <mesh>
        <sphereGeometry args={[50, 32, 32]} />
        <meshBasicMaterial 
          color="#000818" 
          side={THREE.BackSide}
        />
      </mesh>

      {/* Floating particles */}
      {Array.from({ length: 100 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 40
          ]}
        >
          <sphereGeometry args={[0.02, 4, 4]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      ))}
    </>
  );
}

export function OrbitView({ data, fullscreen }: OrbitViewProps) {
  if (data.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center text-gray-300">
          <div className="text-4xl mb-4">🪐</div>
          <p>No orbital data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative bg-gray-900">
      <Canvas
        camera={{ 
          position: [0, 8, 12], 
          fov: 60,
          near: 0.1,
          far: 1000 
        }}
        gl={{ antialias: true }}
      >
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={20}
          autoRotate={true}
          autoRotateSpeed={0.5}
        />
        <OrbitScene data={data} />
      </Canvas>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg">
        <h4 className="font-semibold text-sm mb-3">Orbital Legend</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span>Main Paper (Center)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>References (Inner orbit)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>Citations (Middle orbit)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Similar (Outer orbit)</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 bg-black bg-opacity-80 text-white p-3 rounded-lg">
        <div className="text-xs space-y-1">
          <div>• Mouse to rotate view</div>
          <div>• Scroll to zoom</div>
          <div>• Click papers to select</div>
          <div>• Auto-rotation enabled</div>
        </div>
      </div>
    </div>
  );
}
