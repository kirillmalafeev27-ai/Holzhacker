import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { ASSET_URLS } from "./config.js";


export class AssetStore {
  constructor(onProgress = () => {}) {
    this.loader = new GLTFLoader();
    this.onProgress = onProgress;
    this.assets = new Map();
    this.markers = new Map();
  }

  async loadAll() {
    const entries = Object.entries(ASSET_URLS);
    let completed = 0;
    await Promise.all(entries.map(async ([key, url]) => {
      const gltf = await this.loader.loadAsync(url);
      this.prepareScene(gltf.scene, key);
      this.assets.set(key, gltf.scene);
      completed += 1;
      this.onProgress(completed / entries.length, key);
    }));
    this.collectMarkers(this.assets.get("world"));
    return this;
  }

  prepareScene(scene, key) {
    scene.name = `Asset_${key}`;
    scene.traverse((object) => {
      if (!object.isMesh) return;
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      const isWater = /ForestStream/.test(object.name) || materials.some((material) => material.name === "StreamWater");
      if (isWater) {
        this.prepareWater(object);
        return;
      }
      object.castShadow = key.startsWith("nav") ? false : true;
      object.receiveShadow = true;
      for (const material of materials) {
        material.precision = "mediump";
        if (material.name === "Fresh wood texture") {
          // The Blender procedural grain does not survive glTF export, so the
          // cut surface arrives untinted (white). Tint it like fresh-cut wood.
          material.color.setHex(0xcf9448);
          material.roughness = .72;
          material.metalness = 0;
        }
      }
    });
  }

  prepareWater(object) {
    // The exported flat-shaded ribbon with the mediump blend material reads
    // as noisy, pixelated banding; smooth the normals, use a clean highp
    // material and keep tree shadows from speckling the surface.
    object.geometry = mergeVertices(object.geometry);
    object.geometry.computeVertexNormals();
    const water = new THREE.MeshStandardMaterial({
      color: 0x2e6f83,
      roughness: .16,
      metalness: .05,
      transparent: true,
      opacity: .8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    water.name = "StreamWater";
    object.material = water;
    object.castShadow = false;
    object.receiveShadow = false;
    object.userData.noShadow = true;
  }

  collectMarkers(world) {
    world.updateMatrixWorld(true);
    world.traverse((object) => {
      if (object.userData?.markerType || /Spawn|Zone|Gate|Watchtower/.test(object.name)) {
        this.markers.set(object.name.replace(/\.\d+$/, ""), object);
        object.visible = false;
      }
    });
  }

  clone(key) {
    const source = this.assets.get(key);
    if (!source) throw new Error(`Missing loaded asset: ${key}`);
    const clone = source.clone(true);
    clone.traverse((object) => {
      if (object.isMesh) {
        if (object.userData.noShadow) {
          object.castShadow = false;
          object.receiveShadow = false;
        } else {
          object.castShadow = source.name.includes("nav") ? false : true;
          object.receiveShadow = true;
        }
      }
    });
    return clone;
  }

  optimizeWorldClone(world) {
    world.updateMatrixWorld(true);
    const groups = new Map();
    const candidates = [];
    world.traverse((object) => {
      if (!object.isMesh) return;
      let owner = object;
      while (owner.parent && owner.parent !== world && !/ForestTree_|RockCluster_|Undergrowth_|ClearingDetail_/.test(owner.name)) owner = owner.parent;
      if (!/ForestTree_|RockCluster_|Undergrowth_|ClearingDetail_/.test(owner.name)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.length !== 1) return;
      const key = `${object.geometry.uuid}:${materials[0].uuid}`;
      if (!groups.has(key)) groups.set(key, { geometry: object.geometry, material: materials[0], meshes: [] });
      groups.get(key).meshes.push(object);
      candidates.push(object);
    });
    let drawCallsSaved = 0;
    for (const group of groups.values()) {
      if (group.meshes.length < 3) continue;
      const instance = new THREE.InstancedMesh(group.geometry, group.material, group.meshes.length);
      instance.name = `InstancedNature_${group.material.name}_${group.meshes.length}`;
      instance.castShadow = true;
      instance.receiveShadow = true;
      group.meshes.forEach((mesh, index) => instance.setMatrixAt(index, mesh.matrixWorld));
      instance.instanceMatrix.needsUpdate = true;
      world.add(instance);
      for (const mesh of group.meshes) mesh.parent?.remove(mesh);
      drawCallsSaved += group.meshes.length - 1;
    }
    world.userData.drawCallsSaved = drawCallsSaved;
    return drawCallsSaved;
  }

  markerPosition(name, target = new THREE.Vector3()) {
    const marker = this.markers.get(name);
    if (!marker) return null;
    return marker.getWorldPosition(target);
  }

  navGeometry(key) {
    const source = this.assets.get(key);
    source.updateMatrixWorld(true);
    const geometries = [];
    source.traverse((object) => {
      if (!object.isMesh) return;
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
    });
    if (!geometries.length) throw new Error(`Navmesh ${key} has no geometry`);
    const merged = mergeGeometries(geometries, false);
    merged.computeVertexNormals();
    return merged;
  }

  worldCollisionData() {
    const colliders = [];
    const world = this.assets.get("world");
    world.updateMatrixWorld(true);
    world.traverse((object) => {
      const radius = Number(object.userData?.collisionRadius || 0);
      if (!radius) return;
      const position = object.getWorldPosition(new THREE.Vector3());
      const scale = object.getWorldScale(new THREE.Vector3());
      colliders.push({
        position,
        radius: radius * Math.max(scale.x, scale.z),
        kind: object.userData?.kind || "obstacle",
      });
    });
    return colliders;
  }
}
