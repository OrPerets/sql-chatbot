// Based on: https://github.com/met4citizen/TalkingHead
// Custom animated full-body avatar for Michael, using OpenAI TTS

import { TalkingHead } from '../modules/talkinghead.mjs'
import * as THREE from 'three'

export class TalkingHeadManager {
  constructor(avatarElement, callbacks = {}) {
    this.avatarElement = avatarElement
    this.head = null
    this.callbacks = callbacks
    this.isInitialized = false
    this.currentSpeakingId = null

    // OpenAI TTS configuration
    this.openaiApiKey = null // Will need to be set by user or environment
    this.openaiEndpoint = 'https://api.openai.com/v1/audio/speech'
    
    // Default voice settings
    this.ttsSettings = {
      model: 'tts-1-hd',
      voice: 'nova', // Good for teaching assistant voice
      speed: 1.0
    }

    // Bind methods
    this.speak = this.speak.bind(this)
    this.cleanup = this.cleanup.bind(this)
    
    // Initialize voice loading
    this.initializeVoices()
  }

  async loadThreeJS() {
    return new Promise((resolve, reject) => {
      if (window.THREE) {
        resolve()
        return
      }
      
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
      script.onload = async () => {
        console.log('🎭 THREE.js loaded successfully')
        
        // Also load GLTFLoader
        const gltfScript = document.createElement('script')
        gltfScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'
        gltfScript.onload = () => {
          console.log('🎭 GLTFLoader loaded successfully')
          resolve()
        }
        gltfScript.onerror = () => {
          console.error('🎭 Failed to load GLTFLoader')
          resolve() // Still resolve as THREE.js main library is loaded
        }
        document.head.appendChild(gltfScript)
      }
      script.onerror = () => {
        console.error('🎭 Failed to load THREE.js')
        reject(new Error('Failed to load THREE.js'))
      }
      document.head.appendChild(script)
    })
  }

  async loadMichaelDirectly() {
    console.log('🎭 Loading Michael avatar directly...')
    
    const THREE = window.THREE
    if (!THREE) {
      throw new Error('THREE.js not available')
    }
    
    // Create basic Three.js scene
    const scene = new THREE.Scene()
    const aspectRatio = this.avatarElement.clientWidth / this.avatarElement.clientHeight
    const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: true
    })
    
    renderer.setSize(this.avatarElement.clientWidth, this.avatarElement.clientHeight)
    renderer.setClearColor(0x000000, 0) // Transparent background
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    
    // Clear any existing content
    while (this.avatarElement.firstChild) {
      this.avatarElement.removeChild(this.avatarElement.firstChild)
    }
    
    this.avatarElement.appendChild(renderer.domElement)
    console.log('🎭 Direct THREE.js canvas created')
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8)
    scene.add(ambientLight)
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(2, 3, 3)
    keyLight.castShadow = true
    scene.add(keyLight)
    
    // Try to load the GLB model directly
    return new Promise((resolve, reject) => {
      if (window.THREE.GLTFLoader) {
        const loader = new THREE.GLTFLoader()
        
        loader.load(
          'https://models.readyplayer.me/68496fdfb85cb0b4ed9555ee.glb',
          (gltf) => {
            console.log('🎉 Michael GLB loaded directly!')
            
            const model = gltf.scene
            model.scale.setScalar(2) // Make Michael bigger
            scene.add(model)
            
            // Position camera
            camera.position.set(0, 1.6, 3)
            camera.lookAt(0, 1.6, 0)
            
            // Store references
            this.simpleScene = { 
              scene, 
              camera, 
              renderer,
              model: model
            }
            
            // Start animation
            this.startDirectAnimation()
            
            resolve()
          },
          (progress) => {
            console.log('🎭 Loading progress:', (progress.loaded / progress.total * 100) + '%')
          },
          (error) => {
            console.error('🎭 GLB loading error:', error)
            reject(error)
          }
        )
      } else {
        console.warn('🎭 GLTFLoader not available, using simple avatar')
        reject(new Error('GLTFLoader not available'))
      }
    })
  }

  startDirectAnimation() {
    if (!this.simpleScene) return
    
    const animate = () => {
      if (this.simpleScene) {
        // Simple rotation animation
        if (this.simpleScene.model) {
          this.simpleScene.model.rotation.y += 0.005
        }
        
        this.simpleScene.renderer.render(this.simpleScene.scene, this.simpleScene.camera)
        requestAnimationFrame(animate)
      }
    }
    animate()
    console.log('🎭 Direct Michael animation started')
  }

  initializeVoices() {
    // Initialize speech synthesis voices
    if ('speechSynthesis' in window) {
      // Load voices immediately if available
      this.availableVoices = speechSynthesis.getVoices()
      
      // Also listen for voices changed event (needed in some browsers)
      speechSynthesis.onvoiceschanged = () => {
        this.availableVoices = speechSynthesis.getVoices()
        console.log('🎤 Voices loaded:', this.availableVoices.length, 'available')
        
        // Try to find a good male voice for Michael (better detection)
        const maleVoice = this.availableVoices.find(voice => 
          // Explicit male voices
          (voice.name.toLowerCase().includes('male') && !voice.name.toLowerCase().includes('female')) ||
          // Common male voice names
          voice.name.toLowerCase().includes('alex') ||
          voice.name.toLowerCase().includes('daniel') ||
          voice.name.toLowerCase().includes('fred') ||
          voice.name.toLowerCase().includes('tom') ||
          voice.name.toLowerCase().includes('david') ||
          voice.name.toLowerCase().includes('james') ||
          voice.name.toLowerCase().includes('john') ||
          voice.name.toLowerCase().includes('mark') ||
          voice.name.toLowerCase().includes('steve') ||
          // Google voices that tend to be male
          (voice.name.toLowerCase().includes('google') && 
           (voice.name.toLowerCase().includes('uk english male') ||
            voice.name.toLowerCase().includes('us english male')))
        )
        
        if (maleVoice) {
          this.preferredVoice = maleVoice
          console.log('🎤 Found preferred male voice:', maleVoice.name)
        }
        
        // Debug: List all available voices for troubleshooting
        if (this.availableVoices.length > 0) {
          console.log('🎤 Available voices for debugging:')
          this.availableVoices.forEach((voice, index) => {
            const isMale = voice.name.toLowerCase().includes('male') && !voice.name.toLowerCase().includes('female')
            console.log(`  ${index + 1}. ${voice.name} (${voice.lang}) ${isMale ? '👨 MALE' : ''}`)
          })
        }
      }
    }
  }

  async initialize() {
    try {
      this.callbacks.onStatusChange?.('loading')
      
      console.log('🎭 Avatar element:', this.avatarElement)
      console.log('🎭 Avatar element dimensions:', {
        width: this.avatarElement.clientWidth,
        height: this.avatarElement.clientHeight
      })

      // Check WebGL support
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) {
        throw new Error('WebGL is not supported in this browser')
      }
      console.log('🎭 WebGL is supported')

      // Ensure element has dimensions
      if (this.avatarElement.clientWidth === 0 || this.avatarElement.clientHeight === 0) {
        console.warn('🎭 Avatar element has zero dimensions, setting minimum size')
        this.avatarElement.style.width = '400px'
        this.avatarElement.style.height = '400px'
      }

      // Try TalkingHead library again with error handling
      console.log('🎭 Attempting to load real Michael avatar...')
      
      try {
        // Create TalkingHead with minimal configuration
        this.head = new TalkingHead(this.avatarElement, {
          lipsyncModules: [],         // Disable lip-sync modules to avoid import issues
          ttsLang: 'en-US',          // Use English TTS
          modelFPS: 25,              // Lower framerate to reduce errors
          cameraView: 'head',        // Focus on head/face for conversation
          alpha: true,               // Enable transparency
          antialias: true            // Smooth edges
        })
        
        // Set transparent background after creation
        if (this.head.renderer) {
          this.head.renderer.setClearColor(0x000000, 0) // Completely transparent background
          this.head.renderer.setClearAlpha(0) // Ensure alpha is 0
          console.log('🎭 Set transparent background')
        }

        console.log('🎭 TalkingHead instance created, loading Michael...')

        // Load your specific Michael avatar
        await this.head.showAvatar({
          url: 'https://models.readyplayer.me/68496fdfb85cb0b4ed9555ee.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=png',
          body: 'M',
          avatarMood: 'neutral'
        })
        
        console.log('🎉 Real Michael avatar loaded successfully!')
        
        // Try to fix animation errors by overriding problematic methods
        if (this.head && this.head.animate) {
          const originalAnimate = this.head.animate.bind(this.head)
          this.head.animate = (...args) => {
            try {
              return originalAnimate(...args)
            } catch (error) {
              // Silently ignore animation errors
              console.warn('🎭 Animation error suppressed:', error.message)
            }
          }
        }
        
        this.analyzeAvatarStructure()
        this.positionCameraForTalking()
        
             } catch (error) {
         console.error('🎭 TalkingHead failed again:', error)
         
         // Try loading Michael directly with THREE.js
         console.log('🎭 Trying to load Michael directly with THREE.js...')
         try {
           if (!window.THREE) {
             await this.loadThreeJS()
           }
           await this.loadMichaelDirectly()
         } catch (directError) {
           console.error('🎭 Direct loading failed:', directError)
           // Final fallback to simple avatar
           console.log('🎭 Final fallback to simple avatar...')
           this.createSimpleAvatar()
         }
       }
      
      this.isInitialized = true
      this.callbacks.onStatusChange?.('idle')
      console.log('🎭 TalkingHead initialized successfully!')
      
    } catch (error) {
      console.error('🎭 TalkingHeadManager initialization failed:', error)
      console.error('🎭 Error details:', error.stack)
      
      // Try even more basic initialization
      try {
        console.log('🎭 Trying fallback initialization...')
        this.head = new TalkingHead(this.avatarElement, {
          lipsyncModules: [],     // Disable lip-sync modules
          ttsLang: 'en-US'
        })
        await this.head.showAvatar() // No parameters at all
        this.isInitialized = true
        this.callbacks.onStatusChange?.('idle')
        console.log('🎭 Fallback initialization successful!')
      } catch (fallbackError) {
        console.error('🎭 Even fallback failed:', fallbackError)
        
        // Last resort: Create a simple placeholder
        try {
          console.log('🎭 Creating simple placeholder avatar...')
          
          // Load THREE.js if not available
          if (!window.THREE) {
            console.log('🎭 Loading THREE.js from CDN...')
            await this.loadThreeJS()
          }
          
          this.createSimpleAvatar()
          this.isInitialized = true
          this.callbacks.onStatusChange?.('idle')
          console.log('🎭 Simple avatar created!')
        } catch (placeholderError) {
          console.error('🎭 Placeholder creation failed:', placeholderError)
          this.callbacks.onError?.('Avatar failed to load. Your browser may not support WebGL.')
          this.callbacks.onStatusChange?.('error')
        }
      }
    }
  }

  async loadMichaelAvatar() {
    // Load the specific Michael avatar you want
    console.log('🎭 Attempting to load Michael avatar...')
    console.log('🎭 TalkingHead renderer:', this.head.renderer)
    console.log('🎭 TalkingHead scene:', this.head.scene)
    console.log('🎭 TalkingHead camera:', this.head.camera)
    
    try {
      // First try: Your specific Michael avatar
      console.log('🎭 Loading custom Michael avatar from ReadyPlayer.me...')
      await this.head.showAvatar({
        url: 'https://models.readyplayer.me/68496fdfb85cb0b4ed9555ee.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=png',
        body: 'M',
        avatarMood: 'neutral'
      })
      console.log('🎉 Custom Michael avatar loaded successfully!')
      this.analyzeAvatarStructure()
      this.positionCameraForTalking()
      return
    } catch (error) {
      console.warn('🎭 Custom Michael avatar failed:', error)
    }

    try {
      // Second try: Default avatar as fallback
      console.log('🎭 Trying default avatar as fallback...')
      await this.head.showAvatar()
      console.log('🎭 Default avatar loaded successfully!')
      this.analyzeAvatarStructure()
      this.positionCameraForTalking()
      return
    } catch (error) {
      console.warn('🎭 Default avatar failed:', error)
    }

    try {
      // Second try: Custom Michael avatar (user's own creation!)
      console.log('Trying custom Michael avatar...')
      await this.head.showAvatar({
        url: 'https://models.readyplayer.me/68496fdfb85cb0b4ed9555ee.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=png',
        body: 'M',
        avatarMood: 'neutral'
      })
      console.log('🎉 Custom Michael avatar loaded successfully!')
      this.analyzeAvatarStructure()
      this.positionCameraForTalking()
      return
    } catch (error) {
      console.warn('Custom avatar failed, trying backup male avatar...', error)
      
      // Third try: Backup male avatar
      try {
        console.log('Trying backup male avatar...')
        await this.head.showAvatar({
          url: 'https://models.readyplayer.me/64f1a714ce16e342a8cddd5d.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=png',
          body: 'M',
          avatarMood: 'neutral'
        })
        console.log('Backup male avatar loaded successfully!')
        this.analyzeAvatarStructure()
        this.positionCameraForTalking()
        return
      } catch (altError) {
        console.warn('Backup avatar failed, trying local file...', altError)
      }
    }

    try {
      // Fourth try: with local file as backup
      console.log('Trying local avatar file...')
      await this.head.showAvatar({
        url: './avatars/brunette.glb'
      })
      console.log('Local avatar loaded successfully!')
      // Wait a bit for avatar to be fully attached
      setTimeout(() => {
        this.analyzeAvatarStructure()
        this.positionCameraForTalking()
      }, 500)
      return
    } catch (localError) {
      console.warn('Local avatar failed:', localError)
    }

    // If everything fails, that's ok for now
    console.log('Avatar loading completed (may be using fallback)')
  }

  createSimpleAvatar() {
    // Create a simple 3D scene as fallback
    console.log('🎭 Creating simple Three.js scene...')
    console.log('🎭 Container dimensions:', this.avatarElement.clientWidth, 'x', this.avatarElement.clientHeight)
    
    // THREE.js should be available globally now
    if (!window.THREE) {
      console.error('🎭 THREE.js not available - cannot create simple avatar')
      throw new Error('THREE.js not available')
    }
    
    const THREE = window.THREE
    
    console.log('🎭 Three.js found, creating scene...')
    
    // Create basic Three.js scene
    const scene = new THREE.Scene()
    const aspectRatio = this.avatarElement.clientWidth / this.avatarElement.clientHeight
    const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: true
    })
    
    renderer.setSize(this.avatarElement.clientWidth, this.avatarElement.clientHeight)
    renderer.setClearColor(0x000000, 0) // Completely transparent background
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    
    // Clear any existing content
    while (this.avatarElement.firstChild) {
      this.avatarElement.removeChild(this.avatarElement.firstChild)
    }
    
    this.avatarElement.appendChild(renderer.domElement)
    console.log('🎭 Canvas added to DOM')
    
    // Create a more detailed Michael-like avatar
    const avatarGroup = new THREE.Group()
    
    // Head with better geometry
    const headGeometry = new THREE.SphereGeometry(0.6, 32, 32)
    const headMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xffdbac,
      transparent: false
    })
    const head = new THREE.Mesh(headGeometry, headMaterial)
    head.position.y = 2
    head.castShadow = true
    avatarGroup.add(head)
    
    // Eyes with more detail
    const eyeGeometry = new THREE.SphereGeometry(0.08, 16, 16)
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x2d4a3f })
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    leftEye.position.set(-0.2, 2.1, 0.4)
    avatarGroup.add(leftEye)
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    rightEye.position.set(0.2, 2.1, 0.4)
    avatarGroup.add(rightEye)
    
    // Glasses (Michael wears glasses!)
    const glassGeometry = new THREE.RingGeometry(0.12, 0.15, 16)
    const glassMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x2d2d2d, 
      transparent: true, 
      opacity: 0.8 
    })
    
    const leftGlass = new THREE.Mesh(glassGeometry, glassMaterial)
    leftGlass.position.set(-0.2, 2.1, 0.42)
    avatarGroup.add(leftGlass)
    
    const rightGlass = new THREE.Mesh(glassGeometry, glassMaterial)
    rightGlass.position.set(0.2, 2.1, 0.42)
    avatarGroup.add(rightGlass)
    
    // Glass bridge
    const bridgeGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8)
    const bridge = new THREE.Mesh(bridgeGeometry, glassMaterial)
    bridge.position.set(0, 2.1, 0.42)
    bridge.rotation.z = Math.PI / 2
    avatarGroup.add(bridge)
    
    // Mouth for animation
    const mouthGeometry = new THREE.SphereGeometry(0.08, 16, 8)
    const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0xff6b6b })
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial)
    mouth.position.set(0, 1.85, 0.45)
    mouth.scale.y = 0.3
    avatarGroup.add(mouth)
    
    // Hair
    const hairGeometry = new THREE.SphereGeometry(0.65, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6)
    const hairMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3c1d })
    const hair = new THREE.Mesh(hairGeometry, hairMaterial)
    hair.position.y = 2.3
    avatarGroup.add(hair)
    
    // Nose
    const noseGeometry = new THREE.ConeGeometry(0.05, 0.15, 8)
    const noseMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac })
    const nose = new THREE.Mesh(noseGeometry, noseMaterial)
    nose.position.set(0, 1.95, 0.5)
    nose.rotation.x = Math.PI / 2
    avatarGroup.add(nose)
    
    // Professional shirt
    const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.5, 1.5, 12)
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4a90e2 }) // Professional blue
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.y = 0.5
    body.castShadow = true
    avatarGroup.add(body)
    
    // Collar
    const collarGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12)
    const collarMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff })
    const collar = new THREE.Mesh(collarGeometry, collarMaterial)
    collar.position.y = 1.2
    avatarGroup.add(collar)
    
    // Neck
    const neckGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.3, 12)
    const neckMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac })
    const neck = new THREE.Mesh(neckGeometry, neckMaterial)
    neck.position.y = 1.4
    avatarGroup.add(neck)
    
    scene.add(avatarGroup)
    
    console.log('🎭 Added avatar group to scene with', avatarGroup.children.length, 'parts')
    
    // Better lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8)
    scene.add(ambientLight)
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(2, 3, 3)
    keyLight.castShadow = true
    scene.add(keyLight)
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight.position.set(-2, 1, 1)
    scene.add(fillLight)
    
    // Position camera for good view (closer to show more detail)
    camera.position.set(0, 2, 3.5)
    camera.lookAt(0, 1.8, 0)
    
    // Store references
    this.simpleScene = { 
      scene, 
      camera, 
      renderer, 
      avatarGroup,
      head: head,
      leftEye: leftEye,
      rightEye: rightEye,
      mouth: mouth
    }
    
    // Start animation loop
    this.startSimpleAnimation()
    
    console.log('🎭 Enhanced simple avatar created successfully!')
    console.log('🎭 Avatar group children count:', avatarGroup.children.length)
    
    // List all the parts we created
    avatarGroup.children.forEach((child, index) => {
      console.log(`🎭 Part ${index}:`, child.type, child.material?.color?.getHexString())
    })
    
    // Force an initial render
    renderer.render(scene, camera)
  }

  startSimpleAnimation() {
    if (!this.simpleScene) return
    
    let time = 0
    this.isSpeaking = false
    
    const animate = () => {
      if (this.simpleScene) {
        time += 0.016 // ~60fps
        
        // Gentle head rotation (looking around)
        this.simpleScene.avatarGroup.rotation.y = Math.sin(time * 0.3) * 0.2
        
        // Subtle breathing animation (body scale)
        const breathScale = 1 + Math.sin(time * 2) * 0.02
        this.simpleScene.avatarGroup.scale.y = breathScale
        
        // Blinking animation
        const blinkTime = time * 4
        if (Math.sin(blinkTime) > 0.95) {
          this.simpleScene.leftEye.scale.y = 0.1
          this.simpleScene.rightEye.scale.y = 0.1
        } else {
          this.simpleScene.leftEye.scale.y = 1
          this.simpleScene.rightEye.scale.y = 1
        }
        
        // Mouth animation when speaking
        if (this.isSpeaking) {
          const talkSpeed = time * 8
          this.simpleScene.mouth.scale.y = 0.3 + Math.abs(Math.sin(talkSpeed)) * 0.4
          this.simpleScene.mouth.scale.x = 1 + Math.abs(Math.sin(talkSpeed * 1.3)) * 0.2
        } else {
          this.simpleScene.mouth.scale.y = 0.3
          this.simpleScene.mouth.scale.x = 1
        }
        
        this.simpleScene.renderer.render(this.simpleScene.scene, this.simpleScene.camera)
        requestAnimationFrame(animate)
      }
    }
    animate()
    console.log('🎭 Simple avatar animation started')
  }

  setTeacherPose() {
    // Set Michael in a professional, approachable teaching pose
    // We'll enhance this in Step 2 with custom poses
    try {
      this.head?.setMood('neutral')
      
      // Add some welcoming gestures occasionally
      setTimeout(() => {
        this.head?.playGesture('handup', 2, false, 1500)
      }, 2000)
    } catch (error) {
      console.warn('Could not set teacher pose:', error)
    }
  }

  // Simple mouth animation without complex lip-sync
  animateBasicMouthMovement(duration) {
    if (!this.head || !this.head.avatar) return;

    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1 && this.head && this.head.avatar) {
        // Simple mouth open/close animation
        const mouthValue = Math.sin(progress * Math.PI * 8) * 0.3 + 0.3; // 8 cycles over duration
        
        try {
          // Try to animate mouth movement
          if (this.head.avatar.morphTargetDictionary && this.head.avatar.morphTargetInfluences) {
            const jawOpenIndex = this.head.avatar.morphTargetDictionary['jawOpen'];
            const mouthCloseIndex = this.head.avatar.morphTargetDictionary['mouthClose'];
            
            if (jawOpenIndex !== undefined) {
              this.head.avatar.morphTargetInfluences[jawOpenIndex] = mouthValue;
            }
            if (mouthCloseIndex !== undefined) {
              this.head.avatar.morphTargetInfluences[mouthCloseIndex] = 1 - mouthValue;
            }
          }
        } catch (error) {
          console.warn('Could not animate mouth:', error);
        }
        
        requestAnimationFrame(animate);
      } else if (this.head && this.head.avatar) {
        // Reset mouth to neutral position
        try {
          if (this.head.avatar.morphTargetDictionary && this.head.avatar.morphTargetInfluences) {
            const jawOpenIndex = this.head.avatar.morphTargetDictionary['jawOpen'];
            const mouthCloseIndex = this.head.avatar.morphTargetDictionary['mouthClose'];
            
            if (jawOpenIndex !== undefined) {
              this.head.avatar.morphTargetInfluences[jawOpenIndex] = 0;
            }
            if (mouthCloseIndex !== undefined) {
              this.head.avatar.morphTargetInfluences[mouthCloseIndex] = 0;
            }
          }
        } catch (error) {
          console.warn('Could not reset mouth:', error);
        }
      }
    };
    
    animate();
  }

  async speak(text, messageId = null) {
    if (!text?.trim()) {
      console.warn('🎭 Cannot speak: empty text')
      return
    }
    
    console.log('🎭 Speak called - initialized:', this.isInitialized, 'head exists:', !!this.head, 'simpleScene exists:', !!this.simpleScene)
    
    // Allow speaking even with simple scene
    if (!this.isInitialized && !this.simpleScene) {
      console.warn('🎭 Neither TalkingHead nor simple scene is initialized')
      return
    }

    try {
      this.currentSpeakingId = messageId
      this.callbacks.onStatusChange?.('speaking')
      this.callbacks.onSpeakingStart?.(messageId)

      // For now, use the built-in TTS-like functionality
      // In a real implementation, you'd integrate with OpenAI TTS
      await this.speakWithBuiltInTTS(text)

    } catch (error) {
      console.error('Speech error:', error)
      this.callbacks.onError?.('Failed to speak text')
    } finally {
      this.currentSpeakingId = null
      this.callbacks.onStatusChange?.('idle')
      this.callbacks.onSpeakingEnd?.()
    }
  }

  async speakWithBuiltInTTS(text) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Michael is saying:', text)
        
        // Check if speech synthesis is available
        if ('speechSynthesis' in window) {
          // Clean text for better Hebrew/multilingual speech
          const cleanText = text
            .replace(/😊|😀|😃|😄|😁|😆|😅|🤣|😂|🙂|🙃|😉|😇|🥰|😍|🤩|😘|😗|😚|😙|😋|😛|😜|🤪|😝|🤑|🤗|🤭|🤫|🤔|🤐|🤨|😐|😑|😶|😏|😒|🙄|😬|🤥|😌|😔|😪|🤤|😴|😷|🤒|🤕|🤢|🤮|🤧|🥵|🥶|🥴|😵|🤯|🤠|🥳|😎|🤓|🧐|🚀|⚡|💡|🎯|🎓|✨|👍|👎|👏|🔧|🛠️|📝|📊|💻|⭐|🎉|🔥|💪|🏆|📈|🎪/g, '')
            .trim()
          
          const utterance = new SpeechSynthesisUtterance(cleanText)
          
          // Detect Hebrew and configure appropriately
          const hasHebrew = /[\u0590-\u05FF]/.test(cleanText)
          console.log('🎤 Text contains Hebrew:', hasHebrew)
          console.log('🎤 Clean text:', cleanText.substring(0, 50) + '...')
          
          if (hasHebrew) {
            // Hebrew-specific settings
            utterance.lang = 'he-IL'
            utterance.rate = 0.8    // Slower for Hebrew clarity
            utterance.pitch = 1.0   
            utterance.volume = 1.0  // Full volume for Hebrew
          } else {
            // English settings
            utterance.lang = 'en-US'
            utterance.rate = 0.9    // Slightly slower for clarity
            utterance.pitch = 1.0   // Normal pitch
            utterance.volume = 0.8  // Reasonable volume
          }
          
          // Enhanced voice selection with Hebrew support
          const voices = speechSynthesis.getVoices()
          console.log('🎤 Available voices:', voices.length)
          
          let selectedVoice = null
          
          if (hasHebrew) {
            // Look for Hebrew voices first
            selectedVoice = voices.find(voice => 
              voice.lang.includes('he') || 
              voice.lang.includes('iw') ||
              voice.name.toLowerCase().includes('hebrew') ||
              voice.name.toLowerCase().includes('carmit') ||
              voice.name.toLowerCase().includes('כרמית')
            )
            
            if (selectedVoice) {
              console.log('🎤 Using Hebrew voice:', selectedVoice.name)
            } else {
              console.log('🎤 No Hebrew voice found, using default')
            }
          }
          
          // If no Hebrew voice found or not Hebrew text, find best male voice
          if (!selectedVoice) {
            if (this.preferredVoice) {
              selectedVoice = this.preferredVoice
              console.log('🎤 Using preferred voice:', this.preferredVoice.name)
            } else {
              // Enhanced male voice selection
              selectedVoice = voices.find(voice => 
                voice.name.toLowerCase().includes('google uk english male') ||
                voice.name.toLowerCase().includes('microsoft david') ||
                voice.name.toLowerCase().includes('alex') ||
                voice.name.toLowerCase().includes('daniel') ||
                voice.name.toLowerCase().includes('arthur') ||
                voice.name.toLowerCase().includes('fred') ||
                voice.name.toLowerCase().includes('tom') ||
                voice.name.toLowerCase().includes('david')
              )
              
              if (selectedVoice) {
                console.log('🎤 Using selected male voice:', selectedVoice.name)
              } else {
                console.log('🎤 Using system default voice')
              }
            }
          }
          
          if (selectedVoice) {
            utterance.voice = selectedVoice
          }
          
          // Estimate speech duration for mouth animation
          const wordsPerMinute = 150;
          const wordCount = text.split(' ').length;
          const estimatedDuration = Math.max((wordCount / wordsPerMinute) * 60 * 1000, 2000);
          
          // Set up event handlers
          utterance.onstart = () => {
            console.log('🔊 Speech synthesis started successfully!')
            console.log('🔊 Utterance details:', {
              text: utterance.text.substring(0, 50) + '...',
              voice: utterance.voice ? utterance.voice.name : 'default',
              lang: utterance.lang,
              rate: utterance.rate,
              pitch: utterance.pitch,
              volume: utterance.volume
            })
            
            // Test audio with a simple beep to verify audio is working
            try {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)()
              
              // Resume audio context if suspended (browser autoplay policy)
              if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                  console.log('🔊 Audio context resumed from suspended state')
                })
              }
              
              const oscillator = audioContext.createOscillator()
              const gainNode = audioContext.createGain()
              oscillator.connect(gainNode)
              gainNode.connect(audioContext.destination)
              oscillator.frequency.setValueAtTime(880, audioContext.currentTime) // A5 note
              gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
              oscillator.start(audioContext.currentTime)
              oscillator.stop(audioContext.currentTime + 0.2)
              console.log('🔊 Audio test beep should be playing now!')
            } catch (audioError) {
              console.warn('🔊 Audio test failed - this might explain why speech is not audible:', audioError.message)
            }
            
            // Try setting mood without causing animation errors
            try {
              if (this.head && this.head.setMood) {
                this.head.setMood('happy')
                console.log('🎭 Set avatar mood to happy')
                // Start simple mouth animation
                this.animateBasicMouthMovement(estimatedDuration)
              } else if (this.simpleScene) {
                // Animate simple avatar mouth
                this.isSpeaking = true
                console.log('🎭 Simple avatar started speaking animation')
              }
            } catch (animationError) {
              console.warn('🎭 Animation error during speech start (ignoring):', animationError.message)
              // Continue with speech even if animation fails
            }
          }
          
          utterance.onend = () => {
            console.log('🔊 Speech synthesis ended successfully!')
            
            // Try resetting mood without causing animation errors
            try {
              if (this.head && this.head.setMood) {
                this.head.setMood('neutral')
                console.log('🎭 Reset avatar mood to neutral')
              } else if (this.simpleScene) {
                // Stop simple avatar mouth animation
                this.isSpeaking = false
                console.log('🎭 Simple avatar stopped speaking animation')
              }
            } catch (animationError) {
              console.warn('🎭 Animation error during speech end (ignoring):', animationError.message)
            }
            resolve()
          }
          
          utterance.onerror = (error) => {
            console.error('🔊 Speech synthesis error:', error)
            console.error('🔊 Error details:', {
              type: error.type,
              error: error.error,
              elapsedTime: error.elapsedTime,
              charIndex: error.charIndex
            })
            
            try {
              if (this.head && this.head.setMood) {
                this.head.setMood('neutral')
              } else if (this.simpleScene) {
                this.isSpeaking = false
              }
            } catch (animationError) {
              console.warn('🎭 Animation error during error handling (ignoring):', animationError.message)
            }
            resolve() // Don't fail, just resolve
          }
          
          // Start actual speech synthesis
          console.log('🎤 Starting speech synthesis...')
          console.log('🎤 Speech synthesis speaking:', speechSynthesis.speaking)
          console.log('🎤 Speech synthesis pending:', speechSynthesis.pending)
          
          // Ensure speech synthesis is ready
          if (speechSynthesis.speaking || speechSynthesis.pending) {
            console.log('🎤 Canceling existing speech synthesis')
            speechSynthesis.cancel()
          }
          
          // For some browsers, we need to ensure speech synthesis is ready
          const startSpeech = () => {
            // Double check that we're not already speaking
            if (speechSynthesis.speaking || speechSynthesis.pending) {
              console.log('🎤 Speech already in progress, skipping')
              return
            }
            
            // Ensure voices are loaded
            const voices = speechSynthesis.getVoices()
            console.log('🎤 Voices available for speech:', voices.length)
            
            if (voices.length === 0) {
              console.log('🎤 Waiting for voices to load...')
              // Wait for voices to load
              speechSynthesis.addEventListener('voiceschanged', () => {
                console.log('🎤 Voices loaded, starting speech...')
                setTimeout(() => {
                  try {
                    speechSynthesis.speak(utterance)
                    console.log('🎤 Speech synthesis utterance started (after voices loaded)')
                    console.log('🎤 Speaking state:', speechSynthesis.speaking)
                  } catch (speechError) {
                    console.error('🎤 Failed to start speech after voice load:', speechError)
                    resolve() // Resolve even if speech fails
                  }
                }, 50)
              }, { once: true })
              
              // Timeout fallback
              setTimeout(() => {
                console.log('🎤 Voice load timeout, trying anyway...')
                try {
                  speechSynthesis.speak(utterance)
                  console.log('🎤 Speech started despite voice timeout')
                } catch (speechError) {
                  console.error('🎤 Speech failed after timeout:', speechError)
                  resolve()
                }
              }, 3000)
            } else {
              console.log('🎤 Voices already available, starting speech...')
              try {
                speechSynthesis.speak(utterance)
                console.log('🎤 Speech synthesis utterance started')
                console.log('🎤 After speak - speaking:', speechSynthesis.speaking, 'pending:', speechSynthesis.pending)
                
                // Double check if speech actually started
                setTimeout(() => {
                  console.log('🎤 Speech check - speaking:', speechSynthesis.speaking, 'pending:', speechSynthesis.pending)
                  if (!speechSynthesis.speaking && !speechSynthesis.pending) {
                    console.warn('🎤 Speech may not have started, retrying...')
                    try {
                      speechSynthesis.speak(utterance)
                      console.log('🎤 Speech retry initiated')
                    } catch (retryError) {
                      console.error('🎤 Speech retry failed:', retryError)
                    }
                  }
                }, 200)
              } catch (speechError) {
                console.error('🎤 Failed to start speech:', speechError)
                resolve() // Resolve even if speech fails
              }
            }
          }
          
          // Add a small delay and check if speech synthesis is available before starting
          setTimeout(() => {
            if (speechSynthesis.speaking || speechSynthesis.pending) {
              console.log('🎤 Speech synthesis busy, waiting...')
              setTimeout(startSpeech, 500)
            } else {
              startSpeech()
            }
          }, 100)
          
        } else {
          console.warn('Speech synthesis not available, falling back to animation only')
          // Fallback to animation only
          this.playSimpleAudioFeedback()
          this.head?.setMood('happy')
          this.animateSpeaking(text, resolve)
        }

      } catch (error) {
        console.warn('Speech error:', error)
        this.head?.setMood('neutral')
        resolve() // Don't fail, just resolve
      }
    })
  }

  async playSimpleAudioFeedback() {
    try {
      // Use TalkingHead's own audio context if available
      if (this.head && this.head.audioCtx) {
        const audioContext = this.head.audioCtx
        
        // Resume context if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }
        
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime) // A3 note
        gainNode.gain.setValueAtTime(0.05, audioContext.currentTime) // Quieter
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1)
        
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.1)
        
        console.log('✓ Audio feedback played')
      }
    } catch (error) {
      console.log('Audio feedback not available:', error)
    }
  }

  animateSpeaking(text, callback) {
    const words = text.split(' ')
    const wordsPerMinute = 150
    const totalDurationMs = Math.max((words.length / wordsPerMinute) * 60 * 1000, 2000)
    
    console.log(`Starting speaking animation for ${words.length} words, duration: ${totalDurationMs}ms`)
    
    // Create realistic lip movement by rapidly changing mouth shapes
    this.simulateLipMovement(totalDurationMs)
    
    // Add dynamic expressions during speech
    const expressions = ['happy', 'neutral', 'happy', 'neutral']
    const expressionInterval = totalDurationMs / expressions.length
    
    let currentExpression = 0
    const expressionTimer = setInterval(() => {
      if (currentExpression < expressions.length && this.head) {
        try {
          this.head.setMood(expressions[currentExpression])
          console.log(`Set mood to: ${expressions[currentExpression]}`)
        } catch (e) {
          console.warn(`Failed to set mood ${expressions[currentExpression]}:`, e)
        }
        currentExpression++
      }
    }, expressionInterval)
    
    // End speaking animation
    setTimeout(() => {
      clearInterval(expressionTimer)
      this.head?.setMood('neutral')
      console.log('Michael finished speaking')
      callback()
    }, totalDurationMs)
  }

  positionCameraForTalking() {
    console.log('Positioning camera for head/face view...')
    
    try {
      // Simple approach: Use TalkingHead's built-in camera controls first
      if (this.head && this.head.camera) {
        const camera = this.head.camera
        
        // Set a close-up position for talking head view (make avatar bigger)
        camera.position.set(0, 1.7, 1.8) // Closer to avatar for bigger view
        camera.lookAt(0, 1.7, 0) // Look at head level
        
        // Update camera settings for better conversation view
        if (camera.fov) {
          camera.fov = 40 // Narrower field of view = bigger avatar
          camera.updateProjectionMatrix()
        }
        
        console.log('Camera positioned at:', {
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          lookingAt: { x: 0, y: 1.6, z: 0 }
        })
        
        // Try to use TalkingHead's built-in camera controls if available
        if (this.head.setCameraPosition) {
          this.head.setCameraPosition({ x: 0, y: 1.7, z: 1.8 })
        }
        
        console.log('✓ Camera positioning completed successfully')
        
      } else {
        console.warn('Camera not found for positioning')
      }
      
    } catch (error) {
      console.error('Error positioning camera:', error)
      
      // Fallback: try to position using found avatar if available
      const avatar = this.foundAvatar
      if (avatar && avatar.traverse) {
        try {
          console.log('Trying fallback avatar-based positioning...')
          const box = new THREE.Box3().setFromObject(avatar)
          const size = box.getSize(new THREE.Vector3())
          const center = box.getCenter(new THREE.Vector3())
          
          const headY = center.y + (size.y * 0.25)
          const cameraDistance = Math.max(size.x, size.z) * 1.2
          
          this.head.camera.position.set(0, headY, cameraDistance)
          this.head.camera.lookAt(0, headY, 0)
          
          console.log('✓ Fallback positioning completed')
        } catch (fallbackError) {
          console.warn('Fallback positioning also failed:', fallbackError)
        }
      }
    }
  }

  // Avatar structure analysis and setup
  analyzeAvatarStructure() {
    let avatar = null
    
    if (this.head) {
      // Try different avatar property names, prioritizing actual 3D objects
      const avatarProps = ['scene', 'ikMesh', 'currentAvatar', 'avatar', 'model', 'mixer']
      for (const prop of avatarProps) {
        if (this.head[prop] && typeof this.head[prop].traverse === 'function') {
          avatar = this.head[prop]
          break
        }
      }
      
      // If no direct avatar found, search the scene for the avatar mesh
      if (!avatar && this.head.scene) {
        this.head.scene.traverse((child) => {
          if (child.isMesh && child.name && (child.name.toLowerCase().includes('avatar') || child.name.toLowerCase().includes('mesh'))) {
            avatar = child.parent || child
          }
        })
      }
      
      // Store the found avatar for later use
      if (avatar) {
        this.foundAvatar = avatar
      }
    }
  }

  simulateLipMovement(durationMs) {
    console.log('Starting SIMPLIFIED talking animation...')
    
    // Focus on mood changes and gestures that we know work
    const talkingInterval = 150 // Smooth interval for mood changes
    let talkCount = 0
    const maxTalks = Math.floor(durationMs / talkingInterval)
    
    const talkTimer = setInterval(() => {
      talkCount++
      
      if (this.head) {
        try {
          // Create realistic talking pattern with mood changes
          const moods = ['happy', 'neutral', 'happy', 'neutral']
          const currentMood = moods[talkCount % moods.length]
          this.head.setMood(currentMood)
          
          // Add subtle gestures occasionally
          if (talkCount % 8 === 0) {
            this.head.playGesture('handup', 1, false, 500)
          } else if (talkCount % 6 === 0) {
            this.head.playGesture('handpoint', 1, false, 500)
          }
          
          // Animate the mouth using morph targets we found!
          if (this.foundAvatar && this.foundAvatar.traverse) {
            console.log(`🗣️ Attempting morph animation for talk count ${talkCount}`)
            let morphsApplied = 0
            
            this.foundAvatar.traverse((child) => {
              if (child.isMesh && child.morphTargetInfluences && child.morphTargetDictionary) {
                const morphDict = child.morphTargetDictionary
                console.log(`Found mesh ${child.name} with ${Object.keys(morphDict).length} morphs`)
                
                // Create realistic talking animation with available morph targets
                // Try mouthOpen first, fallback to alternatives for custom avatars
                if (morphDict.mouthOpen !== undefined) {
                  const talkCycle = talkCount % 4
                  const openAmount = talkCycle === 1 || talkCycle === 3 ? Math.random() * 0.7 + 0.2 : 0
                  child.morphTargetInfluences[morphDict.mouthOpen] = openAmount
                  console.log(`👄 Set mouthOpen to ${openAmount.toFixed(2)}`)
                  morphsApplied++
                } else if (morphDict.mouthClose !== undefined) {
                  // Alternative: Use inverted mouthClose for mouth opening effect
                  const talkCycle = talkCount % 4
                  const closeAmount = talkCycle === 0 || talkCycle === 2 ? Math.random() * 0.3 + 0.1 : 0
                  child.morphTargetInfluences[morphDict.mouthClose] = closeAmount
                  console.log(`👄 Set mouthClose to ${closeAmount.toFixed(2)}`)
                  morphsApplied++
                }
                
                if (morphDict.jawOpen !== undefined) {
                  const jawCycle = talkCount % 3
                  const jawAmount = jawCycle === 1 ? Math.random() * 0.4 + 0.1 : 0
                  child.morphTargetInfluences[morphDict.jawOpen] = jawAmount
                  console.log(`🦴 Set jawOpen to ${jawAmount.toFixed(2)}`)
                  morphsApplied++
                }
                
                // Add some viseme animation for realism
                const visemes = ['viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U']
                visemes.forEach((viseme, idx) => {
                  if (morphDict[viseme] !== undefined) {
                    const visemeValue = (talkCount % 5 === idx) ? Math.random() * 0.3 + 0.1 : 0
                    child.morphTargetInfluences[morphDict[viseme]] = visemeValue
                    if (visemeValue > 0) {
                      console.log(`🔤 Set ${viseme} to ${visemeValue.toFixed(2)}`)
                      morphsApplied++
                    }
                  }
                })
                
                // Subtle smile variation
                if (morphDict.mouthSmile !== undefined) {
                  const smileBase = currentMood === 'happy' ? 0.3 : 0.1
                  const smileVariation = Math.random() * 0.2
                  child.morphTargetInfluences[morphDict.mouthSmile] = smileBase + smileVariation
                  console.log(`😊 Set mouthSmile to ${(smileBase + smileVariation).toFixed(2)}`)
                  morphsApplied++
                }
              }
            })
            
            console.log(`✅ Applied ${morphsApplied} morph changes for talking animation`)
          } else {
            console.warn('❌ No foundAvatar available for morph animation')
          }
          
        } catch (e) {
          console.warn('Talking animation failed:', e)
        }
      }
    }, talkingInterval)
    
    // Stop talking animation when done speaking
    setTimeout(() => {
      clearInterval(talkTimer)
      console.log('Talking animation completed')
      
      // Reset to neutral
      if (this.head) {
        this.head.setMood('neutral')
        
        // Reset all morphs to 0 if we found a valid avatar
        if (this.foundAvatar && this.foundAvatar.traverse) {
          this.foundAvatar.traverse((child) => {
            if (child.isMesh && child.morphTargetInfluences) {
              for (let i = 0; i < child.morphTargetInfluences.length; i++) {
                child.morphTargetInfluences[i] = 0
              }
            }
          })
        }
      }
    }, durationMs)
  }

  // Future method for OpenAI TTS integration
  async speakWithOpenAI(text) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    try {
      const response = await fetch(this.openaiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.ttsSettings.model,
          input: text,
          voice: this.ttsSettings.voice,
          speed: this.ttsSettings.speed,
          response_format: 'wav'
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI TTS error: ${response.statusText}`)
      }

      const audioData = await response.arrayBuffer()
      
      // Convert to audio and sync with TalkingHead
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const audioBuffer = await audioContext.decodeAudioData(audioData)
      
      // Use TalkingHead's speakAudio method with proper timing
      await this.head.speakAudio({
        audio: audioBuffer,
        words: this.extractWords(text),
        wtimes: this.generateWordTimings(text),
        wdurations: this.generateWordDurations(text)
      })

    } catch (error) {
      console.error('OpenAI TTS error:', error)
      throw error
    }
  }

  extractWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0)
  }

  generateWordTimings(text) {
    // Simple word timing estimation
    const words = this.extractWords(text)
    const timings = []
    let currentTime = 0
    
    words.forEach((word, index) => {
      timings.push(currentTime)
      // Estimate ~150 words per minute = ~400ms per word
      currentTime += (word.length * 50) + 100 // Rough estimation
    })
    
    return timings
  }

  generateWordDurations(text) {
    const words = this.extractWords(text)
    return words.map(word => (word.length * 50) + 100) // Rough estimation
  }

  setApiKey(apiKey) {
    this.openaiApiKey = apiKey
  }

  updateTTSSettings(settings) {
    this.ttsSettings = { ...this.ttsSettings, ...settings }
  }

  setMood(mood) {
    if (this.head) {
      this.head.setMood(mood)
    }
  }

  // Manual camera reset function (can be called externally)
  resetCameraToHead() {
    console.log('Manual camera reset requested...')
    this.positionCameraForTalking()
  }

  playGesture(gesture, duration = 3, mirror = false) {
    if (this.head) {
      this.head.playGesture(gesture, duration, mirror)
    }
  }

  cleanup() {
    try {
      // Cleanup TalkingHead resources
      if (this.head) {
        // Stop any ongoing speech
        if (this.head.speechQueue) {
          this.head.speechQueue.length = 0
        }
        
        // Cleanup audio context
        if (this.head.audioCtx && this.head.audioCtx.state !== 'closed') {
          this.head.audioCtx.close()
        }
        
        // Stop and cleanup
        this.head.stop()
        this.head = null
      }
      
      // Cleanup simple scene if it exists
      if (this.simpleScene) {
        if (this.simpleScene.renderer) {
          this.simpleScene.renderer.dispose()
          // Remove canvas from DOM
          if (this.simpleScene.renderer.domElement && this.simpleScene.renderer.domElement.parentNode) {
            this.simpleScene.renderer.domElement.parentNode.removeChild(this.simpleScene.renderer.domElement)
          }
        }
        
        // Cleanup scene objects
        if (this.simpleScene.scene) {
          while (this.simpleScene.scene.children.length > 0) {
            this.simpleScene.scene.remove(this.simpleScene.scene.children[0])
          }
        }
        
        this.simpleScene = null
      }
      
      this.isInitialized = false
      console.log('🎭 TalkingHeadManager cleaned up')
      
    } catch (error) {
      console.warn('🎭 Cleanup error:', error)
    }
  }
} 