import * as CANNON from "cannon-es";
import * as THREE from "three";
import WebGL from "three/addons/capabilities/WebGL.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import CharacterControl from "./assets/utils/character";
import CannonDebugger from "cannon-es-debugger";

// SETUP
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.y = 2;
camera.position.z = 5;
camera.position.x = 0;

const renderer = new THREE.WebGL1Renderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const control = new OrbitControls(camera, renderer.domElement);
control.enableDamping = false;
control.minDistance = 2;
control.maxDistance = 15;
control.enablePan = false;
control.maxPolarAngle = Math.PI / 2 - 0.05;
control.update();
//controls.addEventListener("change", () => renderer.render(scene, camera)); //this line is unnecessary if you are re-rendering within the animation loop

// LIGHT
const light = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(light);

// CANNON INIT
const physicModels = new Map();
const meshModels = new Map();
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0),
});

const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane(),
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);
physicModels.set("plane", groundBody);

world.addEventListener("beginContact", (event) => {
  const { bodyA, bodyB } = event;

  physicModels.forEach((v, k) => {
    if (v === bodyB) {
      if (/^sphere_/.test(k)) {
        const geometry = new THREE.SphereGeometry(3, 100, 100);
        const material = new THREE.MeshBasicMaterial({ color: "#fff2" });
        const sphere = new THREE.Mesh(geometry, material);
        meshModels.get(k).add(sphere);

        // Define the initial and target scale values
        const initialScale = 2; // Initial scale value
        const targetScale = 1; // Target scale value
        const duration = 2000; // Duration of the animation in milliseconds

        // Define a variable to store the current scale
        let currentScale = initialScale;

        // Function to animate the scaling of the model
        function animateScale() {
          // Calculate the scale increment based on the duration
          const scaleIncrement = (targetScale - initialScale) / duration;

          // Create a variable to store the animation start time
          let startTime = null;

          // Define the animation function
          function scaleAnimation(timestamp) {
            if (!startTime) startTime = timestamp; // Store the start time of the animation

            // Calculate the elapsed time since the start of the animation
            const elapsed = timestamp - startTime;

            // Calculate the new scale value based on the elapsed time and scale increment
            currentScale = initialScale + scaleIncrement * elapsed;

            // Apply the scale to the model
            sphere.scale.set(currentScale, currentScale, currentScale);

            // Check if the animation duration has been reached
            if (elapsed < duration) {
              // Continue the animation
              requestAnimationFrame(scaleAnimation);
            }
          }

          // Start the animation
          requestAnimationFrame(scaleAnimation);
        }

        // Call the animateScale function to start the scaling animation
        animateScale();
      }
    }
  });
});

createPersonPhysic();
function createPersonPhysic() {
  // Create the body for the person
  const personBody = new CANNON.Body({
    type: CANNON.Body.KINEMATIC,
    mass: 0,
  });

  // Create shapes for different body parts
  const headShape = new CANNON.Sphere(0.06); // Create a sphere shape for the head
  const torsoShape = new CANNON.Box(new CANNON.Vec3(0.15, 0.1, 0.14)); // Create a box shape for the torso
  const limbShape = new CANNON.Box(new CANNON.Vec3(0.15, 0.2, 0.17)); // Create a box shape for the limbs

  // Position the shapes relative to the body
  const headOffset = new CANNON.Vec3(0, 0.65, -0.04);
  const torsoOffset = new CANNON.Vec3(0, 0.5, 0);
  const limbOffset = new CANNON.Vec3(0, 0.2, -0.03);

  // Add shapes to the body with their respective offsets
  personBody.addShape(headShape, headOffset);
  personBody.addShape(torsoShape, torsoOffset);
  personBody.addShape(limbShape, limbOffset);

  world.addBody(personBody);
  physicModels.set("person", personBody);
}

// RENDER MODELS
const gltfLoader = new GLTFLoader();
let characterControl;

gltfLoader.load("./assets/data/Soldier.glb", (gltf) => {
  const model = gltf.scene;
  model.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });
  model.scale.set(0.4, 0.4, 0.4);
  scene.add(model);
  meshModels.set("person", model);

  const mixer = new THREE.AnimationMixer(model);
  const animations = new Map();
  gltf.animations.forEach((a) => {
    if (a.name !== "TPose") {
      animations.set(a.name, mixer.clipAction(a));
    }
  });

  characterControl = new CharacterControl(
    physicModels.get("person"),
    mixer,
    control,
    camera,
    animations,
    "Idle"
  );
});

function randomCycle(x, z, key) {
  const cycle = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.01, 2, 100),
    new THREE.MeshBasicMaterial({ color: "#FFFFFF" })
  );
  // cycle.rotation.set(-Math.PI / 2, 0, 0);
  scene.add(cycle);

  const cycleBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Sphere(0.5),
  });
  cycleBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  cycleBody.position.set(x, 0.01, z);
  world.addBody(cycleBody);

  physicModels.set(key, cycleBody);
  meshModels.set(key, cycle);
}

randomCycle(0, 4, "sphere_1");
randomCycle(0, -4, "sphere_2");
randomCycle(4, 0, "sphere_3");
randomCycle(-4, 0, "sphere_4");

// createStair();
function createStair() {
  // Define the size of the steps and the number of steps
  const stepSize = 0.2; // Adjust this value to control the size of each step
  const numSteps = 5; // Adjust this value to control the number of steps

  // Create the stair steps
  for (let i = 0; i < numSteps; i++) {
    const position = new CANNON.Vec3(0, i * 0.07, i * stepSize); // Adjust the position of each step

    // Create a box shape for each step
    const stepShape = new CANNON.Box(new CANNON.Vec3(2, 0.03, stepSize / 1));

    // Create a rigid body for each step using the box shape
    const stepBody = new CANNON.Body({
      mass: 0, // Set the mass to zero to create a static object
      shape: stepShape,
      position,
    });

    // Add the step body to the world
    world.addBody(stepBody);
  }
}

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshBasicMaterial({
    color: "#616161",
    side: THREE.DoubleSide,
  })
);

scene.add(plane);
meshModels.set("plane", plane);

// FUNCTION HANDLER
const keysPressed = {};

initActionKeyboard();

function initActionKeyboard() {
  const onKeyDown = function (event) {
    characterControl?.switchRunToggle(event.shiftKey);
    keysPressed[event.key.toLowerCase()] = true;
  };

  const onKeyUp = function (event) {
    characterControl?.switchRunToggle(event.shiftKey);
    keysPressed[event.key.toLowerCase()] = false;
  };

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", onWindowResize);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
}

const cannonDebugger = new CannonDebugger(scene, world);
const clock = new THREE.Clock();
const timeFrame = 1 / 60;
// ANIMATION
function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // update postion character when keys pressed
  if (characterControl) {
    characterControl.update(deltaTime, keysPressed);
  }

  // START WORLD PHYSIC
  meshModels.forEach((value, key) => {
    value.position.copy(physicModels.get(key).position);
    value.quaternion.copy(physicModels.get(key).quaternion);
  });

  world.step(timeFrame);
  cannonDebugger.update();

  // UPDATE ANIMATON
  control.update();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.render(scene, camera);
}

// INIT 3D
// Check whether the browser has support WebGL
if (WebGL.isWebGLAvailable()) {
  // Initiate function or other initializations here
  document.getElementById("container").appendChild(renderer.domElement);
  animate();
} else {
  const warning = WebGL.getWebGLErrorMessage();
  document.getElementById("container").appendChild(warning);
}
