import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';



// Declare everything we know we're going to need (or eventually need);
let canvas,
  scene,
  perspectiveCamera,
  perspectiveLayer,
  renderer,
  shaderMaterial,
  cylinderGeometry,
  cylinderMesh,
  eyeballModel,
  eyeballModel2,
  window_innerWidth,
  window_innerHeight;


// This is the doohicky to display the FSP counter in the bottom-right corner.
let lastTime = 0;
let frameCount = 0;
let fpsContainer = document.getElementById("fps-value");

// Set thes the initial mouse positions in 3d space. X, Y, and ZEEEEEHAW! 
let mouse = {
  x: 0,
  y: 0,
  z: 0
};

let currentLookAt = new THREE.Vector3(0, 0, 0);
let targetLookAt = new THREE.Vector3(0, 0, 0);
let particles = [];


// I foreget what plane this is. I *think* it's the plane for the particles?
// Could be for the rotating cylindar? Probably the plane though...
let plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

// This will grab the postion of the mouse in 3D space
function getMousePositionIn3D(mouseX, mouseY, camera) {
  let vector = new THREE.Vector3(mouseX, mouseY, 0.5).unproject(camera);
  let ray = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
  let intersectionPoint = new THREE.Vector3();
  ray.ray.intersectPlane(plane, intersectionPoint);
  return intersectionPoint;
}

// Load an initial model of an eyeball (the one for the particles)
function loadEyeballModel() {
  const loader = new GLTFLoader();
  loader.load(
    'eyeball.gltf',
    (gltf) => {
      eyeballModel = gltf.scene; // Assign the loaded model to the eyeballModel variable
      eyeballModel.scale.set(0.1, 0.1, 0.1); // Scale it down initially
      eyeballModel.position.set(0, 0, 0); // Set an initial position
      eyeballModel.layers.set(perspectiveLayer); // Set the same layer as other objects
      scene.add(eyeballModel); // Add it to the scene immediately after loading
      console.log("Eyeball model loaded successfully!"); // Log for confirmation
    },
    undefined, // For onProgress (not necessary here, but can be added if needed)
    (error) => {
      console.error("Error loading the eyeball model:", error); // Log if there's an error
    }
  );
}

// Load a second instance of the eyeball model (the one in the center of the screen)
function loadSecondEyeball() {

  const loader = new GLTFLoader();

  loader.load(
    'eyeball.gltf', 
    (gltf) => {

      eyeballModel2 = gltf.scene;

      eyeballModel2.scale.set(10, 10, 10); 

      // Position it in the center
      eyeballModel2.position.set(0, 0, 2);  

      eyeballModel2.layers.set(perspectiveLayer);

      scene.add(eyeballModel2);

      console.log("Second eyeball loaded!");

    },
    undefined,
    (error) => {
      console.error(error);
    }
  );

}

// Set up the things we need, and place them in their own functions;

// This will set up the canvas element
function setup_Canvas() {
  canvas = document.querySelector('.web-gl');
}

// This will set up the scene
function setup_Scene() {
  scene = new THREE.Scene();
}

// Set up different layers
function setUp_Layers() {
 perspectiveLayer = 0;
}

// This will set up our camera rigging system (we can always add more)
function setup_PerspectiveCamera() {
  window_innerWidth = window.innerWidth;
  window_innerHeight = window.innerHeight;
  perspectiveCamera= new THREE.PerspectiveCamera(50, window_innerWidth / window_innerHeight, 0.1, 1000);
  perspectiveCamera.position.z = 10;
  perspectiveCamera.layers.set(perspectiveLayer);
}


// Lighting Rigs. (You need light to seem right?)
function setup_Lights() {
  // Add an ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  // Add a directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // The color and intensity
  directionalLight.position.set(0, 1, 0); // Coming from above
  scene.add(directionalLight);
}

// No point in having a massive production if you're not going to render it.
function setup_Renderer() {

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    powerPreference: "high-performance",
    antialias: true,
  });

  renderer.setSize(window_innerWidth, window_innerHeight);
}

// Let's throw some shade... (makes the gooey stuff in the background...)
function setup_ShaderMaterial() {

  shaderMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      iResolution: {
        value: new THREE.Vector3(1, 1, 1)
      },
      iTime: {
        value: 0.0
      },
      heartBeat: {
        value: 1.0 // Initial value for heartBeat
      }
    },
    vertexShader: `
  out vec2 vUv; // Added out

  void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,
    fragmentShader: `
    precision mediump float;

    uniform vec3 iResolution;
    uniform float iTime;
    uniform float iWidth;
    uniform float iHeight;
    uniform float heartBeat;
    
    in vec2 vUv;  
    out vec4 fragColor;  
    
    mat2 rotate2D(float t) {
        return mat2(cos(t), -sin(t), sin(t), cos(t));
    }
    
    void main() {
      vec2 uv = vUv * 2.0;          // Tiling step 1
      uv = mix(uv, 2.0 - uv, step(1.0, uv));   // Tiling step 2
    
      uv.x *= 0.25 * (iResolution.x / iResolution.y);
      uv.y *= 0.25;
    
      vec2 p = (uv * vec2(1.0, 1.0) * 3.0 - vec2(1.0, 1.0)) * 1.0;
    
      vec2 n = vec2(0.0), N = vec2(0.0), q;
      vec4 o = vec4(0.0);
      float S = 25.0, a = 0.0, j = 1.5, t = iTime;
    
      for (mat2 m = rotate2D(1.0); j++ < 20.0; S *= 1.4) {
          p *= m;
          n *= m;
          q = p * S + j + n + t + 2.0 + heartBeat;
          a += dot(cos(q) / S, vec2(1.0));
          n += q = sin(q);
          N += q / (S + 10.0);
      }
    
      o += vec4(0.14 - a * 1.0);
      o.r *= 2.0;   // Red
      o.g *= 0.03;   // Green
      o.b *= 0.03;   // Blue

      o += min(1.0, 0.001 / length(N));
      o -= o * dot(p, p) * 0.0;
      o.a = 8.0;
    
      fragColor = o;
    }
    
`,
    side: THREE.DoubleSide
  });

  shaderMaterial.extensions.derivatives = true; // Enable the derivatives extension
  // shaderMaterial.transparent = true;
  console.log("Shader Material:", shaderMaterial);
  window.shaderMaterial = shaderMaterial; // Make shaderMaterial accessible globally
}

// Set up the meshes
function setup_Meshes() {

  const maxAnisotropy = renderer.capabilities.maxAnisotropy;

  cylinderGeometry = new THREE.CylinderGeometry(40, 0, 40, 64, 64, true);
  cylinderMesh = new THREE.Mesh(cylinderGeometry, shaderMaterial);
  cylinderMesh.position.z = -11;
  cylinderMesh.rotation.x = Math.PI / 2;
  cylinderMesh.receiveShadow = true;
  scene.add(cylinderMesh);
}

// Controls the center eye as it follows the mouse location in 3d space.
function setup_eyeRotation() {
  const sensitivity = 50; // Increase or decrease this value to change the sensitivity.

  if (eyeballModel2) {
    targetLookAt.set(mouse.x * sensitivity, mouse.y * sensitivity, 0.25);
    targetLookAt.unproject(perspectiveCamera);

    const vector = new THREE.Vector3(mouse.x * sensitivity, mouse.y * sensitivity, 0.25);
    vector.unproject(perspectiveCamera);

    currentLookAt.lerp(targetLookAt, 0); // Adjust the lerp value as needed
    eyeballModel2.lookAt(currentLookAt);
  }
}

// Setup the Mouse movement.
document.addEventListener('mousemove', setup_MouseMove, false);

function setup_MouseMove(event) {

  mouse = {
    x: 0,
    y: 0
  };

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const RADIUS = 1000; // You can adjust this to change the effective radius
  const SCALING_FACTOR = 1000; // You can adjust this value to your liking

  const r = RADIUS * Math.sqrt(Math.random()); // Random distance within the circle

  let position3D = getMousePositionIn3D(mouse.x, mouse.y, perspectiveCamera);


  const offset = randomPointInCircle(0 / window.innerWidth); // Convert px to normalized device coordinates

  position3D.x += offset.x * SCALING_FACTOR;
  position3D.y -= offset.y * SCALING_FACTOR;

  createParticle(position3D.x, position3D.y, position3D.z);
}

// Set up a random placement around the mouse in specified radius
function randomPointInCircle(radius) {
  const angle = Math.random() * 2 * Math.PI;

  // The following ensures a more uniform distribution in the circle:
  const r = radius * Math.sqrt(Math.random());

  const x = r * Math.cos(angle);
  const y = r * Math.sin(angle);

  return {
    x: x,
    y: y
  };
}

// This Creates the general attributes for the particles as they are generatate by the mouse movements.
function createParticle(x, y, z) {
  if (eyeballModel) {
    const particle = eyeballModel.clone(); // Change this line to clone eyeballModel

    // Set initial properties for the particle
    particle.x = x;
    particle.y = y;
    particle.z = z;
    particle.directionX = Math.random() * 2 - 1;
    particle.directionY = Math.random() * 2 - 1;
    particle.directionZ = Math.random() * 2 - 1;
    particle.speedX = (Math.random() * 2) + 0.0045;
    particle.speedY = (Math.random() * 2) + 0.0045;
    particle.speedZ = (Math.random() * 2) + 0.0045;
    particle.radius = 60; // Adjust this as needed
    particle.size = 1; // Example value, adjust as needed
    particle.frameX = Math.floor(Math.random() * 4);
    particle.frameY = Math.floor(Math.random() * 4);

    const initialScale = Math.random() * 0.45 + 0.45;
    particle.scale.set(initialScale, initialScale, initialScale);

    // Ensure eyeballModel is defined before attempting to look at it
    if (eyeballModel.position) {
      particle.lookAt(eyeballModel.position); // Look at the center eyeball
    }

    particle.position.set(x, y, z);

    particle.growing = false;
    particle.scaleTarget = Math.random();

    particle.lifespan = Math.random() * 5 + 3; // lifespan between 3 to 8 seconds

    particle.age = 0; // Initialize age to track particle's age

    // Add update method
    particle.update = function () {
      // Movement logic adapted from your second code snippet
      if (particle.x + particle.radius * 10 > window.innerWidth || particle.x - particle.radius * 10 < 0) {
        particle.directionX = -particle.directionX;
      }
      if (particle.y + particle.radius * 10 > window.innerHeight || particle.y - particle.radius * 10 < 0) {
        particle.directionY = -particle.directionY;
      }

      particle.x += particle.directionX * particle.speedX;
      particle.y += particle.directionY * particle.speedY;
      particle.z += particle.directionZ * particle.speedZ;

      // Update the Three.js particle's position
      particle.position.set(particle.x, particle.y, particle.z);

      // Example mouse interaction logic (adjust as needed)
      if (mouse && (Math.abs(mouse.x - particle.x) < 60 && Math.abs(mouse.y - particle.y) < 10)) {
        if (particle.radius < 700) { // Example max radius, adjust as needed
          particle.radius += 1;
        }
      } else if (particle.radius > 0.1) { // Example min radius, adjust as needed
        particle.radius -= 0.05;
      }
      if (particle.radius < 0) {
        particle.radius = 0;
      }
    };

    particles.push(particle);
    scene.add(particle);
  }
}

// This updates the particles AFTER they're generated.
function updateParticles() {
  const GROWTH_SPEED = 0.15; // This defines how fast particles grow each frame.
  const MAX_SIZE = 3; // Corresponds to 100px
  const ONE_SECOND = 120; // Assuming 60fps
  const SHRINK_SPEED = MAX_SIZE / ONE_SECOND / 2; // Ensure it shrinks from 1.0 to 0 in 1 second.

  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];

    particle.position.x += (particle.directionX * particle.speedX) * 0.025;
    particle.position.y += (particle.directionY * particle.speedY) * 0.025;
    particle.position.z += (particle.directionZ * particle.speedZ) * 0.05;

    // Mouse Interaction
    const distanceToMouse = new THREE.Vector3().subVectors(targetLookAt, particle.position).length();

    // If particle hasn't started shrinking and hasn't reached max size, let it grow.
    if (!particle.shrinking && particle.scale.x < MAX_SIZE) {
      particle.scale.x += GROWTH_SPEED;
      particle.scale.y += GROWTH_SPEED;
      particle.scale.z += GROWTH_SPEED;
    }

    // If particle reaches or surpasses max size and hasn't started shrinking, set shrinking to true.
    if (particle.scale.x >= MAX_SIZE && !particle.shrinking) {
      particle.shrinking = true;
    }

    // If particle is shrinking, reduce its size.
    if (particle.shrinking) {
      particle.scale.x -= SHRINK_SPEED;
      particle.scale.y -= SHRINK_SPEED;
      particle.scale.z -= SHRINK_SPEED;
    }

    // Remove Particle if Shrunk Completely
    if (particle.scale.x <= 0) {
      scene.remove(particle);
      particles.splice(i, 1);
      continue;
    }

    // Particle Aging
    particle.age += 1 / ONE_SECOND;
    if (particle.age >= particle.lifespan) {
      particle.shrinking = true;
    }

    particle.lookAt(eyeballModel2.position);

  }
}

// Let's GOOOOOOOOOOOOOOOOOOOOO!
function animate() {
  currentLookAt.lerp(targetLookAt, 1);
  setup_eyeRotation();
  updateParticles();
  
   // FSP Counter  
  const now = performance.now();
  const delta = now - lastTime;
  frameCount++;
  if (delta >= 1000) {
    // Update every second
    fpsContainer.innerHTML = frameCount;
    frameCount = 0;
    lastTime = now;
  }

  // Particle Animation
  const MAX_AGE = 6; // Define the maximum age of particles (in seconds)

  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];

    // Particle removal based on age
    if (particle.age >= MAX_AGE) {
      scene.remove(particle);
      particles.splice(i, 1);
      i--; // Adjust index due to splice
      continue;
    }

  }

  requestAnimationFrame(animate);

  shaderMaterial.uniforms.iTime.value += 0.030;
  let t = shaderMaterial.uniforms.iTime.value;
  shaderMaterial.uniforms.heartBeat.value =
    2.0 * (Math.sin(t * 0.5) * Math.abs(Math.sin(t * 0.25)));

  cylinderMesh.rotation.y -= 0.003;

  renderer.render(scene, perspectiveCamera);
}

// Resize Event Listener. Can't get this to work properly, but whatever. This still looks cool.
window.addEventListener('resize', () => {
  window_innerWidth = window.innerWidth;
  window_innerHeight = window.innerHeight;
  renderer.setSize(window_innerWidth, window_innerHeight);
  perspectiveCamera.aspect = window_innerWidth / window_innerHeight;
  perspectiveCamera.updateProjectionMatrix();
});

setup_Canvas();
setup_Scene();
setUp_Layers();
setup_PerspectiveCamera();
setup_Lights();
setup_Renderer();
setup_ShaderMaterial();
setup_Meshes();
loadEyeballModel();
loadSecondEyeball();
setup_eyeRotation();
animate();




