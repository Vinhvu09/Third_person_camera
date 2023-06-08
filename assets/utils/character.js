import * as THREE from "three";
import {
  ACTION_TYPE,
  CHARACTER_CONTROL,
  KEYS,
  MOVEMENT_KEYS,
} from "../constants/common";

export default class CharacterControl {
  constructor(model, mixer, control, camera, animations = [], currentAction) {
    this.player = model;
    this.currentAction = currentAction;
    this.mixer = mixer;
    this.control = control;
    this.camera = camera;
    this.animations = animations;
    this.toggleRun = false;

    this.walkDirection = new THREE.Vector3();
    this.jumpVelocity = new THREE.Vector3();
    this.rotateAngle = new THREE.Vector3(0, 1, 0);
    this.rotateQuarternion = new THREE.Quaternion();
    this.cameraTarget = new THREE.Vector3();

    this.fadeDuration = CHARACTER_CONTROL.duration;
    this.runVelocity = CHARACTER_CONTROL.run;
    this.walkVelocity = CHARACTER_CONTROL.walk;
    this.gravity = CHARACTER_CONTROL.gravity;
    this.keysPressed = {};
    this.playerIsOnGround = false;
    this.isJumpPressed = false;
    this.isSitDownPressed = false;

    this.animations.forEach((value, key) => {
      if (key === currentAction) {
        value.play();
      }
    });

    this.initActionKeyboard();
  }

  initActionKeyboard() {
    document.addEventListener("keydown", this.onKeyDown.bind(this));
    document.addEventListener("keyup", this.onKeyUp.bind(this));
  }

  onKeyUp(event) {
    const key =
      event.key.toLowerCase().trim() || event.code.toLowerCase().trim();

    this.switchRunToggle(event.shiftKey);
    this.handleJump(key);
    this.keysPressed[key] = false;
  }

  onKeyDown(event) {
    const key = event.key.toLowerCase();

    this.switchRunToggle(event.shiftKey);
    this.handleSitDown(key);
    this.keysPressed[key] = true;
  }

  switchRunToggle(isRun = false) {
    this.toggleRun = isRun;
  }

  handleJump(key) {
    if (key !== KEYS.space || this.isSitDownPressed) return;

    if (this.playerIsOnGround) {
      this.jumpVelocity.y = CHARACTER_CONTROL.jump;
      this.playerIsOnGround = false;
      this.isJumpPressed = true;
    }
  }

  handleSitDown(key) {
    if (key !== KEYS.c) return;

    this.isSitDownPressed = !this.isSitDownPressed;
  }

  changeDirection(axis, angle, deltaTime) {
    const velocity =
      this.currentAction == ACTION_TYPE.run
        ? this.runVelocity
        : this.walkVelocity;
    // applyAxisAngle: quay vector xung quanh một trục (0, 1, 0) => trục Y và góc quay đã cho => control.
    this.walkDirection.set(...axis).applyAxisAngle(this.rotateAngle, angle);
    this.player.position.addScaledVector(
      this.walkDirection,
      velocity * deltaTime
    );
  }

  handleMovement(deltaTime) {
    // Stop rotation character by camera when stand or sit down
    if ([ACTION_TYPE.normal, ACTION_TYPE.sit].includes(this.currentAction)) {
      return true;
    }

    if (this.playerIsOnGround) {
      this.isJumpPressed = false;
      this.jumpVelocity.y = deltaTime * this.gravity;
    } else {
      this.jumpVelocity.y += deltaTime * this.gravity;
    }

    this.player.position.addScaledVector(this.jumpVelocity, deltaTime);
    const angle = this.control.getAzimuthalAngle();
    const directionOffset = this.directionOffset(this.keysPressed);

    if (this.keysPressed[MOVEMENT_KEYS.up]) {
      this.changeDirection([0, 0, -1], angle, deltaTime);
    }

    if (this.keysPressed[MOVEMENT_KEYS.down]) {
      this.changeDirection([0, 0, 1], angle, deltaTime);
    }

    if (this.keysPressed[MOVEMENT_KEYS.left]) {
      this.changeDirection([-1, 0, 0], angle, deltaTime);
    }

    if (this.keysPressed[MOVEMENT_KEYS.right]) {
      this.changeDirection([1, 0, 0], angle, deltaTime);
    }

    // rotate character
    this.rotateQuarternion.setFromAxisAngle(
      this.rotateAngle,
      angle + directionOffset
    );
    this.player.quaternion.rotateTowards(
      this.rotateQuarternion,
      CHARACTER_CONTROL.speedRotate
    );
    this.player.updateMatrixWorld(true);
  }

  handleAnimation(delta) {
    const isMovementPressed = Object.values(MOVEMENT_KEYS).some(
      (key) => this.keysPressed[key] === true
    );

    let action = ACTION_TYPE.normal;
    if (this.isSitDownPressed) {
      action = ACTION_TYPE.sit;
    } else {
      if (isMovementPressed) {
        action = ACTION_TYPE.walk;
      }

      if (isMovementPressed && this.toggleRun) {
        action = ACTION_TYPE.run;
      }

      if (this.isJumpPressed) {
        action = ACTION_TYPE.jump;
      }
    }

    if (this.currentAction !== action) {
      const prevAction = this.animations.get(this.currentAction);
      const currentAction = this.animations.get(action);

      if (action === ACTION_TYPE.sit) {
        currentAction.setLoop(THREE.LoopRepeat, 1);
        currentAction.clampWhenFinished = true;
        currentAction.timeScale = -1.5;
      }

      prevAction.fadeOut(this.fadeDuration);
      currentAction.reset().fadeIn(this.fadeDuration).play();
      this.currentAction = action;
    }

    this.mixer.update(delta);
  }

  update(delta, playerIsOnGround) {
    this.handleAnimation(delta);
    this.handleMovement(delta, playerIsOnGround);
  }

  directionOffset(keysPressed) {
    let directionOffset = 0; // w

    if (keysPressed["w"]) {
      if (keysPressed["a"]) {
        directionOffset = Math.PI / 4; // w+a
      } else if (keysPressed["d"]) {
        directionOffset = -Math.PI / 4; // w+d
      }
    } else if (keysPressed["s"]) {
      if (keysPressed["a"]) {
        directionOffset = Math.PI / 4 + Math.PI / 2; // s+a
      } else if (keysPressed["d"]) {
        directionOffset = -Math.PI / 4 - Math.PI / 2; // s+d
      } else {
        directionOffset = Math.PI; // s
      }
    } else if (keysPressed["a"]) {
      directionOffset = Math.PI / 2; // a
    } else if (keysPressed["d"]) {
      directionOffset = -Math.PI / 2; // d
    }

    return directionOffset;
  }
}
