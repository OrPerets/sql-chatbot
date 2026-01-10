"use client";

import React, { useEffect, useState } from 'react';

// Simple loading component
const AvatarLoading = () => (
  <div style={{ 
    width: '100%', 
    height: '100%', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    background: 'transparent',
    borderRadius: '50%'
  }}>
    <div style={{ 
      width: '40px', 
      height: '40px', 
      border: '3px solid #f3f3f3',
      borderTop: '3px solid #3498db',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}></div>
    <style jsx>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Fallback avatar component for when 3D fails
const FallbackAvatar: React.FC<{ avatarState: string; size: string }> = ({ avatarState, size }) => {
  const getHeight = () => {
    switch (size) {
      case 'small': return '80px';
      case 'large': return '160px';
      default: return '120px';
    }
  };

  return (
    <div 
      style={{ 
        width: getHeight(), 
        height: getHeight(),
        borderRadius: '50%',
        background: `linear-gradient(135deg, 
          ${avatarState === 'speaking' ? '#22c55e' : 
            avatarState === 'thinking' ? '#a855f7' : 
            avatarState === 'listening' ? '#3b82f6' : '#6b7280'} 0%, 
          ${avatarState === 'speaking' ? '#16a34a' : 
            avatarState === 'thinking' ? '#7c3aed' : 
            avatarState === 'listening' ? '#2563eb' : '#4b5563'} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: size === 'small' ? '24px' : size === 'large' ? '36px' : '30px',
        fontWeight: 'bold',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        animation: avatarState === 'speaking' ? 'pulse 0.6s infinite alternate' : 'none',
        transition: 'all 0.3s ease'
      }}
    >
      👨‍🏫
      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};

// Main component interface
interface Michael3DVisualProps {
  avatarState: 'idle' | 'speaking' | 'listening' | 'thinking';
  avatarUrl?: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const Michael3DVisual: React.FC<Michael3DVisualProps> = ({ 
  avatarState, 
  avatarUrl = 'https://models.readyplayer.me/68496fdfb85cb0b4ed9555ee.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=png',
  size = 'medium',
  className = ''
}) => {
  const [use3D, setUse3D] = useState(false); // Start with fallback
  const [isClient, setIsClient] = useState(false);
  const [ThreeCanvas, setThreeCanvas] = useState<any>(null);

  useEffect(() => {
    setIsClient(true);
    
    // Try to load Three.js components only after client-side hydration
    const loadThreeJS = async () => {
      try {
        // Wait a bit to ensure DOM is fully ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('🎭 Attempting to load Three.js components...');
        
        // Dynamic import of React Three Fiber Canvas
        const { Canvas } = await import('@react-three/fiber');
        const { useGLTF, useAnimations, Environment, PresentationControls } = await import('@react-three/drei');
        const THREE = await import('three');
        
        console.log('✅ Three.js components loaded successfully!');
        
        // Create a safe 3D canvas component
        const Safe3DCanvas = ({ avatarUrl, avatarState, scale }: any) => {
                     const AvatarModel = () => {
             try {
               const groupRef = React.useRef<any>(null);
               const gltf = useGLTF(avatarUrl) as any;
               
               if (!gltf || !gltf.scene) {
                 console.error('❌ GLTF scene is null');
                 return null;
               }
               
               const { actions } = useAnimations(gltf.animations || [], groupRef);
               
               console.log('🎭 Avatar model loaded:', gltf.scene);
               
               // Simple animation loop
               const { useFrame } = require('@react-three/fiber');
               useFrame((state: any) => {
                 if (!groupRef.current) return;
                 const time = state.clock.getElapsedTime();
                 groupRef.current.position.y = Math.sin(time * 0.5) * 0.02;
                 if (avatarState === 'speaking') {
                   groupRef.current.rotation.y = Math.sin(time * 2) * 0.02;
                 }
               });
               
               if (!gltf.scene) {
                 return null;
               }
               
               return (
                 <group ref={groupRef} scale={scale}>
                   <primitive object={gltf.scene} />
                 </group>
               );
             } catch (error) {
               console.error('❌ Avatar model error:', error);
               return null;
             }
           };
          
          return (
            <Canvas
              camera={{ position: [0, 0.3, 1], fov: 35 }}
              style={{ background: 'transparent' }}
              gl={{ alpha: true, antialias: true }}
            >
              <ambientLight intensity={0.5} />
              <directionalLight position={[1, 1, 1]} intensity={0.5} />
              <Environment preset="studio" />
              <PresentationControls enabled={false} global>
                <AvatarModel />
              </PresentationControls>
            </Canvas>
          );
        };
        
        setThreeCanvas(() => Safe3DCanvas);
        setUse3D(true);
        console.log('🎉 3D Avatar system ready!');
        
      } catch (error) {
        console.error('❌ Failed to load Three.js:', error);
        console.log('📱 Using fallback avatar instead');
        setUse3D(false);
      }
    };
    
    // Load Three.js after a short delay
    if (isClient) {
      loadThreeJS();
    }
  }, [isClient, avatarUrl]);

  const getHeight = () => {
    switch (size) {
      case 'small': return '80px';
      case 'large': return '160px';
      default: return '120px';
    }
  };

  const getScale = () => {
    switch (size) {
      case 'small': return 0.8;
      case 'large': return 1.2;
      default: return 1;
    }
  };

  // Don't render anything on server side
  if (!isClient) {
    return <AvatarLoading />;
  }

  // Try 3D if available
  if (use3D && ThreeCanvas) {
    return (
      <div 
        className={className}
        style={{ 
          width: getHeight(), 
          height: getHeight(),
          position: 'relative',
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'transparent'
        }}
      >
        <React.Suspense fallback={<AvatarLoading />}>
          <ThreeCanvas
            avatarUrl={avatarUrl}
            avatarState={avatarState}
            scale={getScale()}
          />
        </React.Suspense>
      </div>
    );
  }

  // Fallback to simple animated avatar
  return <FallbackAvatar avatarState={avatarState} size={size} />;
};

export default Michael3DVisual; 