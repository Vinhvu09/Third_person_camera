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
import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js';
import { TWEEN } from "https://unpkg.com/three@0.139.0/examples/jsm/libs/tween.module.min.js";
import { Water } from 'three/addons/objects/Water.js';


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
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGL1Renderer({ antialias: true });
    this.control = new OrbitControls(this.camera, this.renderer.domElement);
    this.clock = new THREE.Clock();
    this.gltfLoader = new GLTFLoader();
    // this.scene.fog = new THREE.FogExp2("#66CC66", 0.12);

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

    this.torusBinding;
    this.torus;
    this.cube;
    this.plane;
    this.modelsHide = [];
    this.blackMetalHide = [];
    this.rainGeo;
    this.positions = [];
    this.sizes = [];
    this.rainCount = 900;
    this.rainMaterial;
    this.particleGeometry;
    this.particleCount;
    this.particleMaterial;
    this.particleSystem;
    this.box;
    this.table;
    this.table2;
    this.water;
    this.video;
    this.videoTable;


    //torus
    const geometryTorus = new THREE.TorusGeometry(1.5, 0.1, 2, 100);
    const materialTorus = new THREE.MeshBasicMaterial;
    const torus = new THREE.Mesh(geometryTorus, materialTorus);
    torus.rotation.set(Math.PI / 2, 0, 0);
    torus.position.set(7, -0.39, -24.3);
    this.scene.add(torus);
    this.torus = torus;

    //cube
    const geometryCube = new THREE.SphereGeometry(50, 32, 16);
    const materialCube = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    this.cube = new THREE.Mesh(geometryCube, materialCube);
    this.cube.position.set(7, -2, -24.3);
    this.cube.scale.set(1, 1, 1);
    this.scene.add(this.cube);


    //la
    // Tạo một hệ thống hạt (particles system) tượng trưng cho mưa
    this.particleGeometry = new THREE.BufferGeometry();
    this.particleCount = 1000;
    const positions = new Float32Array(this.particleCount * 3); // Tạo một Float32Array để lưu trữ tọa độ các hạt
    this.particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1,
      map: new THREE.TextureLoader().load('/la2.png'), // Đường dẫn tới hình ảnh chiếc lá
      transparent: true,
      alphaTest: 1,
    });

    // Khởi tạo tọa độ ban đầu của các hạt
    for (let i = 0; i < this.particleCount; i++) {
      const index = i * 3;
      positions[index] = Math.random() * 100 - 50; // Tọa độ x ngẫu nhiên trong khoảng [-100, 100]
      positions[index + 1] = Math.random() * 200 - 100; // Tọa độ y ngẫu nhiên trong khoảng [-100, 100]
      positions[index + 2] = Math.random() * 100 - 50; // Tọa độ z ngẫu nhiên trong khoảng [-100, 100]
    }

    // Gán tọa độ vào buffer attribute của BufferGeometry
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Tạo đối tượng ParticleSystem từ geometry và material
    this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.scene.add(this.particleSystem);
    this.particleSystem.position.set(7, -0.39, -24.3);

    //planepane
    this.video = document.createElement('video');
    this.video.src = '/video/Abstract.mp4';
    this.video.load();
    this.video.loop = true;

    const texture = new THREE.VideoTexture(this.video);
    const boxGeometry = new THREE.BoxGeometry(20, 20, 20);
    const boxMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, transparent: true, opacity: 0 });
    this.box = new THREE.Mesh(boxGeometry, boxMaterial);
    this.scene.add(this.box);
    this.box.position.set(7, 9.5, -24.3);
    this.box.rotation.set(0, -Math.PI / 2, 0);

    //table
    this.videoTable = document.createElement('video');
    this.videoTable.src = '/video/flower.mp4';
    this.videoTable.load();
    this.videoTable.loop = true;

    const textureTable = new THREE.VideoTexture(this.videoTable);
    const TableGeometry = new THREE.BoxGeometry(0.05, 2, 3);
    const TableMaterial = new THREE.MeshBasicMaterial({ map: textureTable, transparent: true, opacity: 0 });
    this.table = new THREE.Mesh(TableGeometry, TableMaterial);
    this.scene.add(this.table);
    this.table.position.set(10, 1, -25);
    this.table.rotation.set(0, 0, -1);

    //table2
    const textureTable2 = new THREE.TextureLoader().load('/image/Tranh02.jpg');

    const TableGeometry2 = new THREE.BoxGeometry(0.05, 2, 1.5);
    const TableMaterial2 = new THREE.MeshBasicMaterial({ map: textureTable2, transparent: true, opacity: 0 });
    this.table2 = new THREE.Mesh(TableGeometry2, TableMaterial2);
    this.scene.add(this.table2);
    this.table2.position.set(10, 1, -22.75);
    this.table2.rotation.set(0, 0, -1);

    // Water
    const waterGeometry = new THREE.PlaneGeometry(10, 10);

    this.water = new Water(
      waterGeometry,
      {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load('/waternormals.jpg', function (texture) {

          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

        }),
        sunDirection: new THREE.Vector3(),
        sunColor: 0xffffff,
        waterColor: "#00CCFF",
        distortionScale: 0
      }
    );

    this.water.rotation.x = - Math.PI / 2;
    this.water.position.set(0, -0.5, -25);
    this.scene.add(this.water);

    // const cloneWater = this.water.clone();
    // this.scene.add(cloneWater);
    // cloneWater.position.set(0, 0.3, -55);

  }


  initLight() {
    const light = new THREE.AmbientLight(0xffffff, 0.1);
    this.scene.add(light);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.1);
    directionalLight.position.set(1, 1, 1); // Direction
    this.scene.add(directionalLight);

    const width = 25;
    const height = 5;
    const intensity = 1;
    const rectLight = new THREE.RectAreaLight(0xffffff, intensity, width, height);
    rectLight.position.set(9.5, 4, -22.5);
    rectLight.rotation.set(0, -Math.PI / 2, 0);
    this.scene.add(rectLight);

    const rectLight1 = new THREE.RectAreaLight(0xffffff, intensity, width, height);
    rectLight1.position.set(-9.5, 4, -22.5);
    rectLight1.rotation.set(0, Math.PI / 2, 0);
    this.scene.add(rectLight1);

    const width10 = 11;
    const height10 = 0.5;
    const intensity10 = 10;
    const rectLight10 = new THREE.RectAreaLight(0xffffff, intensity10, width10, height10);
    rectLight10.position.set(0, 6.6, -38.8);
    rectLight10.rotation.set(0, Math.PI, 0);
    this.scene.add(rectLight10);

    const rectLight11 = new THREE.RectAreaLight(0xffffff, intensity10, width10, height10);
    rectLight11.position.set(0, 6.6, -8.1);
    rectLight11.rotation.set(0, 0, 0);
    this.scene.add(rectLight11);

    const width12 = 35;
    const height12 = 0.5;
    const intensity12 = 10;
    const rectLight12 = new THREE.RectAreaLight(0xffffff, intensity12, width12, height12);
    rectLight12.position.set(5.4, 6.6, -22);
    rectLight12.rotation.set(0, Math.PI / 2, 0);
    this.scene.add(rectLight12);

    const rectLight13 = new THREE.RectAreaLight(0xffffff, intensity12, width12, height12);
    rectLight13.position.set(-5.4, 6.6, -22);
    rectLight13.rotation.set(0, -Math.PI / 2, 0);
    this.scene.add(rectLight13);

    const light2 = new THREE.RectAreaLight(0xffffff, 10);
    light2.rotation.set(-Math.PI / 2, 0, 0);
    light2.position.set(0, 11.6, -54.1);
    this.scene.add(light2);
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
    this.character = playerModel.model;

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


    const mapModel = await this.loadModelGLTF(`${BASE_URL}sceneRoom.glb`);
    // mapModel.model.scale.set(2, 2, 2);
    mapModel.model.position.set(0, -this.radius, -20);
    // mapModel.animations.forEach((animation) => {
    //   animation.play();
    // });
    this.animationsMap.set("map", mapModel);
    this.initBVHCollider("map", mapModel.model);

    // Adjust the camera
    this.camera.position.set(0, 0, 5);
    this.play();
  }

  loadModelGLTF(url, isAddScene = true) {
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

          if (isAddScene) {
            this.scene.add(data.model);
          }
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
        this.modelsHide.push(c);
        c.material.transparent = true;
        meshes.push(c);
      }
    });

    meshes.forEach((mesh) => {
      let key = "";
      if (mesh.name) {
        key = options.isGroupKeyByName
          ? mesh.name
          : `${mesh.name.split("_")[1]} ${Object.keys(mesh.geometry.attributes).length
          }`;
      } else {
        key = Date.now();
      }

      visualGeometries[key] = visualGeometries[key] || [];
      const geom = mesh.geometry.clone();
      geom.applyMatrix4(mesh.matrixWorld);
      visualGeometries[key].push(geom);
    });

    // console.log(visualGeometries);

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
    // this.scene.add(collider);
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

  handlEventStart() {
    this.water.visible = false;
    this.video.play();
    this.videoTable.play();

    if (this.table2.material.opacity < 1) {
      this.table2.visible = true;

      this.table2.material.opacity += 0.008;
    } else {
      this.table2.visible = true;
    }
    if (this.table.material.opacity < 1) {
      this.table.visible = true;

      this.table.material.opacity += 0.008;
    } else {
      this.table.visible = true;
    }

    if (this.box.material.opacity < 1) {
      this.box.visible = true;

      this.box.material.opacity += 0.008;
    } else {
      this.box.visible = true;
    }

    this.particleSystem.visible = true;
    if (this.cube.scale.x > 0) {
      this.cube.scale.x -= 0.01;
      this.cube.scale.y -= 0.01;
      this.cube.scale.z -= 0.01;
    }

    this.modelsHide.forEach(item => {

      if (item.material.opacity > 0.1) {
        item.material.opacity -= 0.008;

      } else {
        item.visible = false;
      }
    });
  }
  handlEventEnd() {
    this.water.visible = true;

    if (this.table2.material.opacity > 0) {
      this.table2.material.opacity -= 0.05;
    } else {
      this.table2.visible = false;
    }
    if (this.table.material.opacity > 0) {
      this.table.material.opacity -= 0.05;
    } else {
      this.table.visible = false;
    }

    if (this.box.material.opacity > 0) {
      this.box.material.opacity -= 0.05;
    } else {
      this.box.visible = false;
    }

    this.particleSystem.visible = false;

    if (this.cube.scale.x < 1) {
      this.cube.scale.x += 0.01;
      this.cube.scale.y += 0.01;
      this.cube.scale.z += 0.01;
    }
    this.modelsHide.forEach(item => {
      if (item.material.opacity < 1) {
        item.visible = true;
        item.material.opacity += 0.008;
      } else {
        item.visible = true;
      }
    });
  }
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    const deltaTime = this.clock.getDelta();
    TWEEN.update();

    this.water.material.uniforms['time'].value += 1.0 / 500.0;
    // Chuyển động hạt rơi tự do
    const particlePositions = this.particleGeometry.attributes.position.array;
    for (let i = 0; i < this.particleCount; i++) {
      const index = i * 3;
      particlePositions[index + 1] -= 0.1; // Tăng giá trị này để tăng tốc độ rơi
      if (particlePositions[index + 1] < -100) {
        particlePositions[index + 1] = 100;
      }
    }
    this.particleGeometry.attributes.position.needsUpdate = true;


    this.torusBinding = new THREE.Box3().setFromObject(this.torus);

    if (this.torusBinding.intersectsBox(this.tempBox)) {
      this.handlEventStart();
    } else {
      this.handlEventEnd();
    }

    // this.loadAnimation(deltaTime);
    this.playerControl.update(deltaTime);
    this.handleCollision(deltaTime);

    // adjust the camera
    this.camera.position.sub(this.control.target);
    this.control.target.copy(this.playerControl.player.position);
    this.control.target.y = this.playerControl.player.position.y + 1.3;
    this.camera.position.add(this.control.target);

    if (false) {
      this.control.maxPolarAngle = Math.PI;
      this.control.minDistance = 1e-4;
      this.control.maxDistance = 1e-4;
    } else {
      this.control.maxPolarAngle = Math.PI - 1.3;
      this.control.minPolarAngle = 0.5;
      this.control.minDistance = 2.5;
      this.control.maxDistance = 100;
    }

    // UPDATE ANIMATON
    this.control.update();
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.render(this.scene, this.camera);
  }
}

new Model3D();
