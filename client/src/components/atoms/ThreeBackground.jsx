import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';

const FloatingShape = ({ position, color, speed, factor }) => {
    const meshRef = useRef();

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.x += delta * 0.2;
            meshRef.current.rotation.y += delta * 0.1;
        }
    });

    return (
        <Float speed={speed} rotationIntensity={1} floatIntensity={2}>
            <mesh ref={meshRef} position={position}>
                <sphereGeometry args={[1, 32, 32]} />
                <MeshDistortMaterial
                    color={color}
                    speed={2}
                    distort={factor}
                    roughness={0.4}
                    metalness={0.1}
                />
            </mesh>
        </Float>
    );
};

const ThreeBackground = () => {
    // Colors from our palette: Sage (#A1B26C), Warm Yellow (#F4DE79), Soft Blue (#BCC9EB), Soft Pink (#F2B1DC)
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0.6, // Soften the effect so text remains readable
            zIndex: 0,
            pointerEvents: 'none', // Allow clicks to pass through
            overflow: 'hidden'
        }}>
            <Canvas camera={{ position: [0, 0, 10], fov: 45 }}>
                <ambientLight intensity={0.8} />
                <directionalLight position={[10, 10, 5]} intensity={1} />

                {/* Sage Green Blob - Top Left */}
                <FloatingShape position={[-3, 2, 0]} color="#A1B26C" speed={1.5} factor={0.4} />

                {/* Warm Yellow Blob - Bottom Right */}
                <FloatingShape position={[3, -2, 0]} color="#F4DE79" speed={1.2} factor={0.3} />

                {/* Soft Blue Blob - Center Deep */}
                <FloatingShape position={[0, 0, -5]} color="#BCC9EB" speed={0.8} factor={0.6} />

                {/* Soft Pink Blob - Top Right far */}
                <FloatingShape position={[4, 3, -2]} color="#F2B1DC" speed={1} factor={0.5} />

                {/* Cream/White - Bottom Left */}
                <FloatingShape position={[-4, -3, -1]} color="#FAF2E5" speed={1.3} factor={0.3} />
            </Canvas>
        </div>
    );
};

export default ThreeBackground;
