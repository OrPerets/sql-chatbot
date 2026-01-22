"use client";

import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, PresentationControls } from '@react-three/drei';
import * as THREE from 'three';

interface AvatarModelProps {
  avatarUrl: string;
  avatarState: 'idle' | 'speaking' | 'listening' | 'thinking';
  scale: number;
}

// Avatar Model Component
const AvatarModel: React.FC<AvatarModelProps> = ({ avatarUrl, avatarState, scale }) => {
  const group = useRef<THREE.Group>(null);
  
  console.log('🎭 Loading avatar from:', avatarUrl);
  const { scene, animations } = useGLTF(avatarUrl);

  console.log('✅ Avatar loaded successfully!', scene);
  const { actions } = useAnimations(animations || [], group);

  // Animation state management
  useEffect(() => {
    if (!actions) return;

    // Stop all animations first
    Object.values(actions).forEach((action: any) => {
      if (action && typeof action.stop === 'function') {
        action.stop();
      }
    });

    // Play animation based on state
    switch (avatarState) {
      case 'speaking':
        if (actions['Talking'] || actions['talking']) {
          const talkAction = actions['Talking'] || actions['talking'];
          if (talkAction && typeof talkAction.reset === 'function' && typeof talkAction.play === 'function') {
            talkAction.reset().play();
          }
        }
        break;
      case 'thinking':
        if (actions['Thinking'] || actions['thinking'] || actions['Idle']) {
          const thinkAction = actions['Thinking'] || actions['thinking'] || actions['Idle'];
          if (thinkAction && typeof thinkAction.reset === 'function' && typeof thinkAction.play === 'function') {
            thinkAction.reset().play();
          }
        }
        break;
      case 'listening':
        if (actions['Listening'] || actions['listening'] || actions['Idle']) {
          const listenAction = actions['Listening'] || actions['listening'] || actions['Idle'];
          if (listenAction && typeof listenAction.reset === 'function' && typeof listenAction.play === 'function') {
            listenAction.reset().play();
          }
        }
        break;
      default:
        if (actions['Idle'] || actions['idle']) {
          const idleAction = actions['Idle'] || actions['idle'];
          if (idleAction && typeof idleAction.reset === 'function' && typeof idleAction.play === 'function') {
            idleAction.reset().play();
          }
        }
        break;
    }
  }, [avatarState, actions]);

  // Simple animation frame loop
  useFrame((state) => {
    if (!group.current || !scene) return;

    const time = state.clock.getElapsedTime();

    // Gentle floating motion
    group.current.position.y = Math.sin(time * 0.5) * 0.02;

    // Rotation based on state
    if (avatarState === 'speaking') {
      group.current.rotation.y = Math.sin(time * 2) * 0.02;
    } else {
      group.current.rotation.y = Math.sin(time * 0.3) * 0.05;
    }
  });

  if (!scene) {
    console.error('❌ Scene is null from useGLTF');
    return null;
  }

  return (
    <group ref={group} scale={scale}>
      <primitive object={scene} />
    </group>
  );
};

interface Michael3DCanvasProps {
  avatarUrl: string;
  avatarState: 'idle' | 'speaking' | 'listening' | 'thinking';
  scale: number;
  onError?: () => void;
}

const Michael3DCanvas: React.FC<Michael3DCanvasProps> = ({ 
  avatarUrl, 
  avatarState, 
  scale,
  onError 
}) => {
  const handleError = (error: any) => {
    console.error('Canvas error:', error);
    onError?.();
  };

  return (
    <Canvas
      camera={{ position: [0, 0.3, 1], fov: 35 }}
      style={{ background: 'transparent' }}
      gl={{ 
        alpha: true, 
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1
      }}
      onError={handleError}
    >
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[1, 1, 1]} intensity={0.5} />
      <directionalLight position={[-1, 0.5, -1]} intensity={0.3} />
      
      {/* Environment for reflections */}
      <Environment preset="studio" />
      
      {/* Avatar Model */}
      <PresentationControls enabled={false} global>
        <React.Suspense fallback={null}>
          <AvatarModel 
            avatarUrl={avatarUrl} 
            avatarState={avatarState}
            scale={scale}
          />
        </React.Suspense>
      </PresentationControls>
    </Canvas>
  );
};

// Preload Michael's working avatar for faster loading
useGLTF.preload('https://models.readyplayer.me/68496fdfb85cb0b4ed9555ee.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=png');

export default Michael3DCanvas; 
