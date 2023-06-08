import * as CANNON from "cannon-es";
import * as THREE from "three";
import WebGL from "three/addons/capabilities/WebGL.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import CharacterControl from "./assets/utils/character";
import CannonDebugger from "cannon-es-debugger";
import { animateScale } from "./assets/utils/animation";
import { createGUI } from "./assets/utils/gui";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import {
  MeshBVH,
  StaticGeometryGenerator,
  MeshBVHVisualizer,
} from "three-mesh-bvh";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import {
  ACTION_TYPE,
  BASE_URL,
  VISUALIZER_DEEP,
} from "./assets/constants/common";

class Model3D {
  constructor() {
    this.init();
    this.initLight();
    this.responsive();
    this.initModel();
  }

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      80,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGL1Renderer({ antialias: true });
    this.control = new OrbitControls(this.camera, this.renderer.domElement);
    this.clock = new THREE.Clock();
    this.gltfLoader = new GLTFLoader();

    // Handle collision
    this.tempVector = new THREE.Vector3();
    this.tempVector2 = new THREE.Vector3();
    this.tempBox = new THREE.Box3();
    this.tempMat = new THREE.Matrix4();
    this.tempSegment = new THREE.Line3();
    this.playerIsOnGround = false;
    this.playerControl;
    this.segment = new THREE.Line3(
      new THREE.Vector3(),
      new THREE.Vector3(0, 1, 0)
    );
    this.radius = 0.4;

    this.colliderMap = new Map();
    this.animationsMap = new Map();
  }

  initLight() {
    const light = new THREE.AmbientLight(0xffffff, 0.1);
    this.scene.add(light);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.1);
    directionalLight.position.set(1, 1, 1); // Direction
    this.scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.1);
    pointLight.position.set(0, 3, 0); // Position
    this.scene.add(pointLight);
  }

  play() {
    // Check whether the browser has support WebGL
    if (WebGL.isWebGLAvailable()) {
      // Initiate function or other initializations here
      document
        .getElementById("container")
        .appendChild(this.renderer.domElement);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.animate();
    } else {
      const warning = WebGL.getWebGLErrorMessage();
      document.getElementById("container").appendChild(warning);
    }
  }

  async initModel() {
    const playerModel = await this.loadModelGLTF(`${BASE_URL}person.glb`);
    playerModel.model.rotation.set(0, Math.PI, 0);
    playerModel.model.position.set(0, -this.radius, 0);

    const group = new THREE.Group();
    group.add(playerModel.model);
    group.updateMatrixWorld(true);
    this.scene.add(group);

    this.playerControl = new CharacterControl(
      group,
      playerModel.mixer,
      this.control,
      this.camera,
      playerModel.animations,
      ACTION_TYPE.normal
    );

    // this.playerControl.player.rotateOnWorldAxis(
    //   new THREE.Vector3(0, 1, 0),
    //   -Math.PI / 2
    // );

    const mapModel = await this.loadModelGLTF(`${BASE_URL}map.glb`);
    mapModel.model.scale.set(0.05, 0.05, 0.05);
    // mapModel.model.position.set(0, -this.radius, 0);
    mapModel.animations.forEach((animation) => {
      console.log(animation);
      animation.play();
    });
    this.animationsMap.set("map", mapModel);
    this.initBVHCollider("map", mapModel.model);

    // Adjust the camera
    this.camera.position.set(0, 0, 5);
    this.play();
  }

  loadModelGLTF(url) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const data = {
            model: gltf.scene,
          };

          if (gltf.animations.length !== 0) {
            data.mixer = new THREE.AnimationMixer(data.model);
            data.animations = new Map();

            gltf.animations.forEach((a) => {
              data.animations.set(a.name, data.mixer.clipAction(a));
            });
          }

          this.scene.add(data.model);
          resolve(data);
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }

  initBVHCollider(key, model, options = {}) {
    model.updateMatrixWorld(true);

    const meshes = [];
    const environment = new THREE.Group();
    const visualGeometries = {};

    model.traverse((c) => {
      if (c.isMesh) {
        meshes.push(c);
      }
    });

    meshes.forEach((mesh) => {
      let key = "";
      if (mesh.name) {
        key = options.isGroupKeyByName
          ? mesh.name
          : `${mesh.name.split("_")[1]} ${
              Object.keys(mesh.geometry.attributes).length
            }`;
      } else {
        key = Date.now();
      }

      visualGeometries[key] = visualGeometries[key] || [];
      const geom = mesh.geometry.clone();
      geom.applyMatrix4(mesh.matrixWorld);
      visualGeometries[key].push(geom);
    });

    for (const key in visualGeometries) {
      // Merges a set of geometries into a single instance.
      // All geometries must have compatible attributes
      try {
        const newGeom = BufferGeometryUtils.mergeGeometries(
          visualGeometries[key]
        );
        const newMesh = new THREE.Mesh(
          newGeom,
          new THREE.MeshStandardMaterial({
            color: 0xf33333,
            shadowSide: 2,
          })
        );

        environment.add(newMesh);
      } catch (error) {
        console.log(key);
      }
    }

    // A utility class for taking a set of SkinnedMeshes or morph target geometry and baking it into a single,
    // static geometry that a BVH can be generated for.
    const staticGenerator = new StaticGeometryGenerator(environment);
    staticGenerator.attributes = options.attributes || ["position"];

    const mergedGeometry = staticGenerator.generate();
    mergedGeometry.boundsTree = new MeshBVH(mergedGeometry, {
      lazyGeneration: false,
    });

    const collider = new THREE.Mesh(mergedGeometry);
    collider.material.wireframe = true;
    const visualizer = new MeshBVHVisualizer(collider);
    visualizer.depth = VISUALIZER_DEEP;
    visualizer.update();
    this.scene.add(collider);
    // this.scene.add(visualizer);
    this.colliderMap.set(key, collider);
  }

  responsive() {
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.render(this.scene, this.camera);
  }

  handleCollision(deltaTime) {
    let matrixWorld;
    this.colliderMap.forEach((collider, key) => {
      matrixWorld = collider.matrixWorld;
      this.tempBox.makeEmpty();

      this.tempMat.copy(matrixWorld).invert();
      this.tempSegment.copy(this.segment);
      this.tempSegment.start
        .applyMatrix4(this.playerControl.player.matrixWorld)
        .applyMatrix4(this.tempMat);
      this.tempSegment.end
        .applyMatrix4(this.playerControl.player.matrixWorld)
        .applyMatrix4(this.tempMat);

      this.tempBox.expandByPoint(this.tempSegment.start);
      this.tempBox.expandByPoint(this.tempSegment.end);

      this.tempBox.min.addScalar(-this.radius);
      this.tempBox.max.addScalar(this.radius);

      const boxHelper = new THREE.Box3Helper(this.tempBox, 0xffff00);
      this.scene.add(boxHelper);

      collider.geometry.boundsTree.shapecast({
        intersectsBounds: (box) => box.intersectsBox(this.tempBox),
        intersectsTriangle: (tri) => {
          const distance = tri.closestPointToSegment(
            this.tempSegment,
            this.tempVector,
            this.tempVector2
          );

          if (distance < this.radius) {
            const depth = this.radius - distance;
            const direction = this.tempVector2.sub(this.tempVector).normalize();
            this.tempSegment.start.addScaledVector(direction, depth);
            this.tempSegment.end.addScaledVector(direction, depth);
          }
        },
      });
    });

    const newPosition = this.tempVector;
    newPosition.copy(this.tempSegment.start).applyMatrix4(matrixWorld);

    const deltaVector = this.tempVector2;
    deltaVector.subVectors(newPosition, this.playerControl.player.position);
    console.log(deltaVector.y);
    this.playerControl.playerIsOnGround =
      deltaVector.y >
      Math.abs(deltaTime * this.playerControl.jumpVelocity.y * 0.25);

    const offset = Math.max(0.0, deltaVector.length() - 1e-5);
    deltaVector.normalize().multiplyScalar(offset);
    this.playerControl.player.position.add(deltaVector);

    if (this.playerControl.playerIsOnGround) {
      this.playerControl.jumpVelocity.set(0, 0, 0);
    } else {
      this.playerControl.jumpVelocity.addScaledVector(
        deltaVector,
        -deltaVector.dot(this.playerControl.jumpVelocity)
      );
    }

    // if the player has fallen too far below the level reset their position to the start
    if (this.playerControl.player.position.y < -10) {
      this.playerControl.jumpVelocity.set(0, 0, 0);
      this.playerControl.player.position.set(0, 0, 0);
    }
  }

  loadAnimation(delta) {
    this.animationsMap.forEach((animation, key) => {
      animation.mixer.update(delta);
    });
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    const deltaTime = this.clock.getDelta();

    this.loadAnimation(deltaTime);
    this.playerControl.update(deltaTime);
    this.handleCollision(deltaTime);

    // adjust the camera
    this.camera.position.sub(this.control.target);
    this.control.target.copy(this.playerControl.player.position);
    this.control.target.y = this.playerControl.player.position.y + 0.8;
    this.camera.position.add(this.control.target);

    if (false) {
      this.control.maxPolarAngle = Math.PI;
      this.control.minDistance = 1e-4;
      this.control.maxDistance = 1e-4;
    } else {
      this.control.maxPolarAngle = Math.PI - 1.3;
      this.control.minPolarAngle = 0.5;
      this.control.minDistance = 1;
      this.control.maxDistance = 4;
    }

    // UPDATE ANIMATON
    this.control.update();
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.render(this.scene, this.camera);
  }
}

new Model3D();
