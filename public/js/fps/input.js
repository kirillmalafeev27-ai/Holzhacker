import * as THREE from "three";


export function isEditableTarget(target) {
  if (!target) return false;
  const tagName = String(target.tagName || "").toUpperCase();
  return target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}


export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.pointerLocked = false;
    this.lookDelta = new THREE.Vector2();
    this.onLockChange = () => {};
    this.bind();
  }

  bind() {
    window.addEventListener("keydown", (event) => {
      // Quiz text fields must receive every letter, including W/A/S/D. These
      // keys are movement controls only while focus is outside an editor.
      if (isEditableTarget(event.target)) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space"].includes(event.code)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
    window.addEventListener("mousemove", (event) => {
      if (!this.pointerLocked) return;
      this.lookDelta.x += event.movementX;
      this.lookDelta.y += event.movementY;
    });
    window.addEventListener("mousedown", (event) => {
      if (event.button === 0 && this.pointerLocked) this.pressed.add("Mouse0");
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) {
        this.keys.clear();
        this.pressed.clear();
      }
      this.onLockChange(this.pointerLocked);
    });
    window.addEventListener("blur", () => this.keys.clear());
  }

  requestLock() {
    this.canvas.requestPointerLock?.();
  }

  held(code) {
    return this.keys.has(code);
  }

  consume(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  consumeLook(target = new THREE.Vector2()) {
    target.copy(this.lookDelta);
    this.lookDelta.set(0, 0);
    return target;
  }

  endFrame() {
    this.pressed.clear();
  }
}
