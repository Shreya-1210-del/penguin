// VolumetricTwin3D.jsx — True 3D Volumetric Digital Twin for Antarctic Research Station
// Powered by Three.js / WebGL with 4-point cinematic lighting (key sun, cyan rim, ambient, fill),
// high-contrast polar station architecture, luminous sastrugi snow terrain, compacted station aprons,
// service pathways, contact shadows, facility operational worklights, animated infrastructure flows,
// ethereal Aurora Australis, subtle blizzard snow, cyan holographic edge highlights,
// and the dedicated Storage & Logistics Depot (Z-06).

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Camera, Maximize2, Minus, Plus, Rotate3D } from "lucide-react";

export default function VolumetricTwin3D({
  engine,
  weather,
  stationInfo,
  zonesDef,
  zoneStatus,
  onSelectZone,
  onHoverZone,
}) {
  const mountRef = useRef(null);
  const [activeCamPreset, setActiveCamPreset] = useState("orbit");
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const interactiveMeshesRef = useRef([]);

  // Smooth Camera Flight & Transition State
  const transitionRef = useRef({
    active: false,
    startTime: 0,
    duration: 1100,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    arcHeight: 0,
  });
  const flyToCameraRef = useRef(null);
  const pointerDownPosRef = useRef({ x: 0, y: 0 });

  // References for live telemetry and weather dynamic updates
  const dynamicElementsRef = useRef(null);
  const propsRef = useRef({ zonesDef, onSelectZone, onHoverZone });
  const hoveredZoneIdRef = useRef(null);

  useEffect(() => {
    propsRef.current = { zonesDef, onSelectZone, onHoverZone };
  }, [zonesDef, onSelectZone, onHoverZone]);

  // ── Camera Preset Configurations ──
  const PRESET_CONFIGS = {
    orbit: {
      id: "orbit",
      label: "ORBIT (DEFAULT)",
      pos: new THREE.Vector3(56, 40, 64),
      target: new THREE.Vector3(0, 4, 0),
      arc: 5,
      duration: 1100,
    },
    top: {
      id: "top",
      label: "ORTHO TOP",
      pos: new THREE.Vector3(0, 92, 6),
      target: new THREE.Vector3(0, 0, 0),
      arc: 8,
      duration: 1200,
    },
    habitat: {
      id: "habitat",
      label: "MAIN HABITAT",
      pos: new THREE.Vector3(26, 17, 30),
      target: new THREE.Vector3(0, 6, 0),
      arc: 5,
      duration: 1100,
    },
    generator: {
      id: "generator",
      label: "GENERATOR BAY",
      pos: new THREE.Vector3(-22, 19, 14),
      target: new THREE.Vector3(-42, 6, -12),
      arc: 6,
      duration: 1100,
    },
    tower: {
      id: "tower",
      label: "COMM RADOME",
      pos: new THREE.Vector3(22, 28, -26),
      target: new THREE.Vector3(-2, 16, -46),
      arc: 6,
      duration: 1100,
    },
    storage: {
      id: "storage",
      label: "STORAGE DEPOT",
      pos: new THREE.Vector3(26, 18, 70),
      target: new THREE.Vector3(44, 6, 42),
      arc: 6,
      duration: 1100,
    },
  };

  // Zone focus perspectives for interactive building clicks
  const ZONE_FOCUS_COORDS = {
    habitat: { pos: new THREE.Vector3(26, 17, 30), target: new THREE.Vector3(0, 6, 0), arc: 5 },
    generator: { pos: new THREE.Vector3(-22, 19, 14), target: new THREE.Vector3(-42, 6, -12), arc: 6 },
    tower: { pos: new THREE.Vector3(22, 28, -26), target: new THREE.Vector3(-2, 16, -46), arc: 6 },
    "comm-tower": { pos: new THREE.Vector3(22, 28, -26), target: new THREE.Vector3(-2, 16, -46), arc: 6 },
    fuel: { pos: new THREE.Vector3(12, 18, -38), target: new THREE.Vector3(18, 5, -52), arc: 5 },
    lab: { pos: new THREE.Vector3(64, 18, -8), target: new THREE.Vector3(42, 6, -16), arc: 5 },
    storage: { pos: new THREE.Vector3(26, 18, 70), target: new THREE.Vector3(44, 6, 42), arc: 6 },
  };

  // Helper to interrupt fly-to when user starts manual interaction
  const cancelCameraFlight = () => {
    if (transitionRef.current.active) {
      transitionRef.current.active = false;
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
        controlsRef.current.update();
      }
    }
  };

  // ── 1. MOUNT EFFECT: Initialize Three.js Scene, Camera, Controls ONCE ──
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 540;

    // ── Scene & Deep Polar Atmospheric Sky ──
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Atmospheric Fog calibrated to match the horizon twilight glow
    const initialFogColor = 0x0e273d;
    scene.background = null; // Let the procedural atmospheric sky dome render as the sky
    scene.fog = new THREE.FogExp2(initialFogColor, 0.0042);

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 1200);
    camera.position.set(56, 40, 64);
    cameraRef.current = camera;

    // ── WebGL Renderer with High-Fidelity Soft Shadows & Tone Mapping ──
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── OrbitControls with Native Smooth Damping & Precision Limits ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.8;
    controls.enablePan = true;
    controls.panSpeed = 0.8;
    controls.screenSpacePanning = true;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.9;
    controls.minDistance = 12;
    controls.maxDistance = 180;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controls.target.set(0, 4, 0);
    controlsRef.current = controls;

    controls.addEventListener("start", () => {
      setActiveCamPreset(null);
    });

    // ── PROCEDURAL POLAR ATMOSPHERIC SKY DOME WITH TWILIGHT HORIZON GLOW ──
    const skyGeo = new THREE.SphereGeometry(520, 48, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x020b18) },    // Deep polar midnight zenith
        midColor: { value: new THREE.Color(0x0c2540) },    // Cold polar azure mid-sky
        horizonColor: { value: new THREE.Color(0x1a4a6e) }, // Ethereal twilight horizon glow
        iceGlowColor: { value: new THREE.Color(0x091b2c) }, // Sub-horizon ground blend
        sunColor: { value: new THREE.Color(0xdbeafe) },     // Low-sun azimuth glow
        sunDirection: { value: new THREE.Vector3(52, 24, 42).normalize() },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 iceGlowColor;
        uniform vec3 sunColor;
        uniform vec3 sunDirection;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = dir.y;
          
          vec3 sky;
          if (h < 0.0) {
            sky = mix(horizonColor * 0.65, iceGlowColor, clamp(-h * 5.0, 0.0, 1.0));
          } else if (h < 0.22) {
            float t = h / 0.22;
            sky = mix(horizonColor, midColor, smoothstep(0.0, 1.0, t));
          } else {
            float t = (h - 0.22) / 0.78;
            sky = mix(midColor, topColor, smoothstep(0.0, 1.0, t));
          }
          
          // Low polar sun azimuth twilight glow along horizon
          float sunDot = max(dot(dir, sunDirection), 0.0);
          float horizonFade = clamp(1.0 - abs(h) * 4.5, 0.0, 1.0);
          sky += sunColor * pow(sunDot, 5.0) * 0.38 * horizonFade;
          
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // ── DISTANT GLACIATED NUNATAK MOUNTAIN RIDGES ALONG HORIZON ──
    const mountainGroup = new THREE.Group();
    const mountainRockMat = new THREE.MeshStandardMaterial({
      color: 0x162c3e,
      roughness: 0.88,
      metalness: 0.2,
      flatShading: true,
    });
    const mountainSnowMat = new THREE.MeshStandardMaterial({
      color: 0x6e96b3,
      roughness: 0.75,
      metalness: 0.1,
      flatShading: true,
    });

    const nunatakCount = 24;
    for (let i = 0; i < nunatakCount; i++) {
      const angle = (i / nunatakCount) * Math.PI * 2 + ((i * 17) % 7) * 0.04;
      const dist = 230 + ((i * 23) % 45);
      const mH = 24 + ((i * 31) % 26);
      const mW = 40 + ((i * 19) % 30);
      const mGeo = new THREE.ConeGeometry(mW / 2, mH, 5, 1);
      const mMesh = new THREE.Mesh(mGeo, mountainRockMat);
      mMesh.position.set(Math.cos(angle) * dist, mH / 2 - 3, Math.sin(angle) * dist);
      mMesh.rotation.y = angle + 0.3;
      mountainGroup.add(mMesh);

      // Glaciated snow cap on peak
      const capH = mH * 0.35;
      const capGeo = new THREE.ConeGeometry(mW * 0.22, capH, 5, 1);
      const capMesh = new THREE.Mesh(capGeo, mountainSnowMat);
      capMesh.position.set(Math.cos(angle) * dist, mH - capH / 2 - 3, Math.sin(angle) * dist);
      capMesh.rotation.y = angle + 0.3;
      mountainGroup.add(capMesh);
    }
    scene.add(mountainGroup);

    // ── TWINKLING POLAR STARS IN UPPER ATMOSPHERE ──
    const starCount = 450;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.12 + Math.random() * 0.88); // Upper dome only
      const r = 490;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xdbeafe,
      size: 1.35,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ── 4-POINT CINEMATIC POLAR LIGHTING SYSTEM ──
    const ambientLight = new THREE.AmbientLight(0x203b54, 1.0); // Richer cold arctic ambient fill
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.6); // Low polar sun key light
    sunLight.position.set(52, 24, 42);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 240;
    sunLight.shadow.camera.left = -75;
    sunLight.shadow.camera.right = 75;
    sunLight.shadow.camera.top = 75;
    sunLight.shadow.camera.bottom = -75;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    const cyanRimLight = new THREE.DirectionalLight(0x00f5ff, 2.0); // Electric cyan rim backlight
    cyanRimLight.position.set(-55, 26, -55);
    cyanRimLight.target.position.set(0, 4, 0);
    scene.add(cyanRimLight);
    scene.add(cyanRimLight.target);

    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x1a344d, 0.95);
    scene.add(hemiLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    fillLight.position.set(-35, 20, 30);
    scene.add(fillLight);

    // ── HIGH-CONTRAST MATERIALS PALETTE ──
    const mats = {
      habHull: new THREE.MeshStandardMaterial({
        color: 0x244a67,
        roughness: 0.28,
        metalness: 0.55,
      }),
      habRoof: new THREE.MeshStandardMaterial({
        color: 0xc4d8e8,
        roughness: 0.2,
        metalness: 0.85,
      }),
      habNose: new THREE.MeshStandardMaterial({
        color: 0x1d3c54,
        roughness: 0.25,
        metalness: 0.65,
      }),
      habTrim: new THREE.MeshStandardMaterial({
        color: 0x2ed6a1,
        roughness: 0.2,
        metalness: 0.6,
        emissive: 0x1bf5b0,
        emissiveIntensity: 0.65,
      }),
      solarTile: new THREE.MeshStandardMaterial({
        color: 0x0b1c2b,
        roughness: 0.1,
        metalness: 0.95,
      }),
      windowWarm: new THREE.MeshStandardMaterial({
        color: 0xffdf88,
        emissive: 0xffaa00,
        emissiveIntensity: 1.6,
        roughness: 0.1,
      }),
      genHull: new THREE.MeshStandardMaterial({
        color: 0x36495a,
        roughness: 0.38,
        metalness: 0.65,
      }),
      genAccent: new THREE.MeshStandardMaterial({
        color: 0x52bfff,
        roughness: 0.25,
        metalness: 0.6,
        emissive: 0x104b6e,
        emissiveIntensity: 0.6,
      }),
      genCrit: new THREE.MeshStandardMaterial({
        color: 0xff4757,
        roughness: 0.2,
        metalness: 0.7,
        emissive: 0xa81e28,
        emissiveIntensity: 1.2,
      }),
      tankSteel: new THREE.MeshStandardMaterial({
        color: 0xb5d3e6,
        roughness: 0.16,
        metalness: 0.92,
      }),
      bundConcrete: new THREE.MeshStandardMaterial({
        color: 0x1f2e34,
        roughness: 0.8,
        metalness: 0.15,
      }),
      labHull: new THREE.MeshStandardMaterial({
        color: 0x292846,
        roughness: 0.32,
        metalness: 0.55,
      }),
      labTrim: new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        roughness: 0.25,
        metalness: 0.6,
        emissive: 0x4c1d95,
        emissiveIntensity: 0.6,
      }),
      towerSteel: new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.28,
        metalness: 0.88,
      }),
      radomeGeodesic: new THREE.MeshStandardMaterial({
        color: 0xe6f0fa,
        roughness: 0.22,
        metalness: 0.25,
        emissive: 0x2563eb,
        emissiveIntensity: 0.3,
        flatShading: true,
      }),
      stiltSteel: new THREE.MeshStandardMaterial({
        color: 0x3b4a5d,
        roughness: 0.35,
        metalness: 0.85,
      }),
      stiltHydraulic: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.1,
        metalness: 0.98,
      }),
      stiltSki: new THREE.MeshStandardMaterial({
        color: 0x141f2d,
        roughness: 0.5,
        metalness: 0.7,
      }),
      skywalkHull: new THREE.MeshStandardMaterial({
        color: 0x1c374d,
        roughness: 0.35,
        metalness: 0.55,
      }),

      // Storage & Logistics Depot Materials
      storageHull: new THREE.MeshStandardMaterial({
        color: 0x243b4e,
        roughness: 0.35,
        metalness: 0.6,
      }),
      storageRoof: new THREE.MeshStandardMaterial({
        color: 0x8ea8be,
        roughness: 0.25,
        metalness: 0.75,
      }),
      snowCap: new THREE.MeshStandardMaterial({
        color: 0xebf5fd,
        roughness: 0.85,
        metalness: 0.04,
      }),
      cargoOrange: new THREE.MeshStandardMaterial({
        color: 0xea580c,
        roughness: 0.4,
        metalness: 0.35,
      }),
      cargoBlue: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.4,
        metalness: 0.35,
      }),
      cargoYellow: new THREE.MeshStandardMaterial({
        color: 0xeab308,
        roughness: 0.4,
        metalness: 0.35,
      }),
      cargoWhite: new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.35,
        metalness: 0.4,
      }),
      dunnageWood: new THREE.MeshStandardMaterial({
        color: 0x3d2b1f,
        roughness: 0.85,
        metalness: 0.05,
      }),
      crateWood: new THREE.MeshStandardMaterial({
        color: 0x785a3a,
        roughness: 0.8,
        metalness: 0.1,
      }),
      pistenRed: new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.3,
        metalness: 0.5,
      }),
      pistenTrack: new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.9,
      }),
      roverBlue: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.25,
        metalness: 0.65,
      }),
      roverSilver: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.2,
        metalness: 0.92,
      }),
      forkliftYellow: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.35,
        metalness: 0.65,
      }),
      forkliftMast: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.4,
        metalness: 0.8,
      }),
      bollardSteel: new THREE.MeshStandardMaterial({
        color: 0x223544,
        roughness: 0.35,
        metalness: 0.85,
      }),
      shrinkWrap: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.72,
        roughness: 0.15,
        metalness: 0.1,
      }),

      // Holographic Digital Twin Edge Highlights
      holoEdgeDefault: new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      }),
      holoEdgeActive: new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
      }),

      // Station Aprons & Footprints
      apronSnow: new THREE.MeshStandardMaterial({
        color: 0x325672,
        roughness: 0.6,
        metalness: 0.15,
      }),
      pathwayTrack: new THREE.MeshStandardMaterial({
        color: 0x193042,
        roughness: 0.75,
        metalness: 0.1,
      }),
      contactShadowMat: new THREE.MeshBasicMaterial({
        color: 0x06111a,
        transparent: true,
        opacity: 0.7,
      }),
    };

    const zoneEdgeMeshes = {
      habitat: [],
      generator: [],
      fuel: [],
      lab: [],
      "comm-tower": [],
      storage: [],
    };

    const addHoloEdges = (mesh, zoneId) => {
      const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 26);
      const edgeLine = new THREE.LineSegments(edgesGeo, mats.holoEdgeDefault);
      mesh.add(edgeLine);
      if (zoneId && zoneEdgeMeshes[zoneId]) {
        zoneEdgeMeshes[zoneId].push(edgeLine);
      }
      return edgeLine;
    };

    const addContactShadow = (parent, x, z, w, d, isCircle = false) => {
      const geo = isCircle ? new THREE.CircleGeometry(w / 2, 16) : new THREE.PlaneGeometry(w, d);
      const mesh = new THREE.Mesh(geo, mats.contactShadowMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.05, z);
      parent.add(mesh);
    };

    // ── LUMINOUS WINDSWEPT SASTRUGI ICE TERRAIN ──
    const groundGeo = new THREE.PlaneGeometry(360, 360, 55, 55);
    const posAttr = groundGeo.attributes.position;
    const windRad = (210 * Math.PI) / 180;
    const cosW = Math.cos(windRad);
    const sinW = Math.sin(windRad);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const dist = Math.sqrt(vx * vx + vy * vy);

      const crossWind = -vx * sinW + vy * cosW;
      const alongWind = vx * cosW + vy * sinW;
      const sastrugi = Math.sin(crossWind * 0.16) * 0.85 + Math.cos(crossWind * 0.35 + alongWind * 0.04) * 0.4;
      const broadSwell = Math.sin(vx * 0.035) * Math.cos(vy * 0.035) * 1.5;
      const perimeterDrop = dist > 85 ? (dist - 85) * 0.07 : 0;

      let dune = 0;
      const dHab = Math.hypot(vx, vy);
      const dGen = Math.hypot(vx - -44, vy - -14);
      const dFuel = Math.hypot(vx - -46, vy - 28);
      const dLab = Math.hypot(vx - 44, vy - -16);
      const dSto = Math.hypot(vx - 44, vy - 42);
      if (dHab < 22 && dHab > 8) dune += Math.sin(((dHab - 8) / 14) * Math.PI) * 0.6;
      if (dGen < 18 && dGen > 6) dune += Math.sin(((dGen - 6) / 12) * Math.PI) * 0.55;
      if (dFuel < 20 && dFuel > 6) dune += Math.sin(((dFuel - 6) / 14) * Math.PI) * 0.75;
      if (dLab < 18 && dLab > 6) dune += Math.sin(((dLab - 6) / 12) * Math.PI) * 0.55;
      if (dSto < 20 && dSto > 6) dune += Math.sin(((dSto - 6) / 14) * Math.PI) * 0.65;

      posAttr.setZ(i, broadSwell + sastrugi + dune - perimeterDrop);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x223f54,
      roughness: 0.45,
      metalness: 0.12,
      flatShading: true,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const gridHelper = new THREE.GridHelper(180, 45, 0x2563eb, 0x1e3a5f);
    gridHelper.position.y = 0.08;
    scene.add(gridHelper);

    // ── STATION FOOTPRINT: APRONS & GROOMED SERVICE PATHWAYS ──
    const footprintGroup = new THREE.Group();

    const aprons = [
      { x: 0, z: 0, w: 34, d: 24 },        // Habitat apron
      { x: -44, z: -14, w: 30, d: 22 },    // Generator apron
      { x: -46, z: 28, w: 32, d: 28 },     // Fuel Reserve apron
      { x: 44, z: -16, w: 28, d: 22 },     // Science Lab apron
      { x: -2, z: -46, w: 22, d: 22 },     // Comm Tower apron
      { x: 44, z: 42, w: 34, d: 30 },      // Storage & Logistics Depot apron
    ];
    aprons.forEach(({ x, z, w, d }) => {
      const padGeo = new THREE.PlaneGeometry(w, d);
      const pad = new THREE.Mesh(padGeo, mats.apronSnow);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, 0.07, z);
      pad.receiveShadow = true;
      footprintGroup.add(pad);
    });

    const pathways = [
      [0, 0, -44, -14], // Hab to Gen
      [0, 0, 44, -16],  // Hab to Lab
      [-44, -14, -46, 28], // Gen to Fuel
      [0, 0, -2, -46],  // Hab to Comms
      [0, 0, 44, 42],   // Hab to Storage & Logistics Depot
    ];
    pathways.forEach(([x1, z1, x2, z2]) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);

      const trackGeo = new THREE.PlaneGeometry(len, 3.2);
      const track = new THREE.Mesh(trackGeo, mats.pathwayTrack);
      track.rotation.x = -Math.PI / 2;
      track.rotation.z = -angle;
      track.position.set((x1 + x2) / 2, 0.075, (z1 + z2) / 2);
      track.receiveShadow = true;
      footprintGroup.add(track);
    });
    scene.add(footprintGroup);

    // ── Station Perimeter Safety Tether Poles ──
    const tetherPolesGroup = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.12, 3.2, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a4454, metalness: 0.85 });
    const flagMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const beaconLightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    pathways.forEach(([x1, z1, x2, z2]) => {
      const steps = 4;
      for (let s = 1; s < steps; s++) {
        const px = x1 + (x2 - x1) * (s / steps);
        const pz = z1 + (z2 - z1) * (s / steps);

        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(px, 1.6, pz);
        pole.castShadow = true;
        tetherPolesGroup.add(pole);

        const flagGeo = new THREE.BoxGeometry(0.4, 0.25, 0.04);
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(px + 0.2, 2.8, pz);
        tetherPolesGroup.add(flag);

        const ledGeo = new THREE.SphereGeometry(0.14, 8, 8);
        const led = new THREE.Mesh(ledGeo, beaconLightMat);
        led.position.set(px, 3.25, pz);
        tetherPolesGroup.add(led);
      }
    });
    scene.add(tetherPolesGroup);

    // ── Multi-Curtain Ethereal Aurora Australis Ribbons in Sky ──
    const auroraGeo1 = new THREE.PlaneGeometry(180, 42, 36, 6);
    const auroraMat1 = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const auroraMesh1 = new THREE.Mesh(auroraGeo1, auroraMat1);
    auroraMesh1.position.set(0, 64, -100);
    auroraMesh1.rotation.x = Math.PI / 3.4;
    scene.add(auroraMesh1);

    const auroraGeo2 = new THREE.PlaneGeometry(140, 32, 28, 4);
    const auroraMat2 = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const auroraMesh2 = new THREE.Mesh(auroraGeo2, auroraMat2);
    auroraMesh2.position.set(25, 76, -125);
    auroraMesh2.rotation.x = Math.PI / 3.2;
    auroraMesh2.rotation.y = -0.12;
    scene.add(auroraMesh2);

    const interactiveMeshes = [];
    interactiveMeshesRef.current = interactiveMeshes;

    // Helper: Heavy Hydraulic Ski Stilts with Contact Shadows
    const addHydraulicSkiStilts = (parent, x, z, w, d, height = 3.6, zoneId) => {
      const outerCylGeo = new THREE.CylinderGeometry(0.4, 0.45, height * 0.6, 12);
      const innerPistonGeo = new THREE.CylinderGeometry(0.26, 0.26, height * 0.5, 12);
      const skiFootingGeo = new THREE.BoxGeometry(2.8, 0.45, 1.8);

      const offsets = [
        [-w / 2 + 1.4, -d / 2 + 1.4],
        [w / 2 - 1.4, -d / 2 + 1.4],
        [-w / 2 + 1.4, d / 2 - 1.4],
        [w / 2 - 1.4, d / 2 - 1.4],
        [0, -d / 2 + 1.4],
        [0, d / 2 - 1.4],
      ];

      offsets.forEach(([ox, oz]) => {
        const casing = new THREE.Mesh(outerCylGeo, mats.stiltSteel);
        casing.position.set(x + ox, height * 0.7, z + oz);
        casing.castShadow = true;
        parent.add(casing);

        const piston = new THREE.Mesh(innerPistonGeo, mats.stiltHydraulic);
        piston.position.set(x + ox, height * 0.35, z + oz);
        piston.castShadow = true;
        parent.add(piston);

        const ski = new THREE.Mesh(skiFootingGeo, mats.stiltSki);
        ski.position.set(x + ox, 0.22, z + oz);
        ski.castShadow = true;
        ski.receiveShadow = true;
        parent.add(ski);
        addHoloEdges(ski, zoneId);

        addContactShadow(parent, x + ox, z + oz, 3.4, 2.4);
      });
    };

    // ── 2. ZONE 1: MAIN HABITAT COMPLEX (Z-01) ──
    const habGroup = new THREE.Group();
    habGroup.userData = { zoneId: "habitat" };
    const habW = 28, habH = 8, habD = 18;
    const habElevation = 3.6;

    addHydraulicSkiStilts(habGroup, 0, 0, habW, habD, habElevation, "habitat");
    addContactShadow(habGroup, 0, 0, habW + 2, habD + 2);

    const habBodyGeo = new THREE.BoxGeometry(habW - 6, habH, habD);
    const habBody = new THREE.Mesh(habBodyGeo, mats.habHull);
    habBody.position.set(0, habElevation + habH / 2, 0);
    habBody.castShadow = true;
    habBody.receiveShadow = true;
    habGroup.add(habBody);
    addHoloEdges(habBody, "habitat");

    const noseGeo = new THREE.CylinderGeometry(habD / 2, habD / 2, 3, 16, 1, false, 0, Math.PI);
    const noseWest = new THREE.Mesh(noseGeo, mats.habNose);
    noseWest.rotation.z = Math.PI / 2;
    noseWest.position.set(-(habW / 2 - 1.5), habElevation + habH / 2, 0);
    noseWest.castShadow = true;
    habGroup.add(noseWest);

    const noseEast = new THREE.Mesh(noseGeo, mats.habNose);
    noseEast.rotation.z = -Math.PI / 2;
    noseEast.position.set(habW / 2 - 1.5, habElevation + habH / 2, 0);
    noseEast.castShadow = true;
    habGroup.add(noseEast);

    const roofShellGeo = new THREE.BoxGeometry(habW - 7, 0.6, habD - 2);
    const roofShell = new THREE.Mesh(roofShellGeo, mats.habRoof);
    roofShell.position.set(0, habElevation + habH + 0.3, 0);
    roofShell.castShadow = true;
    habGroup.add(roofShell);
    addHoloEdges(roofShell, "habitat");

    const solarFrameGeo = new THREE.BoxGeometry(habW - 10, 0.3, habD - 5);
    const solarFrame = new THREE.Mesh(solarFrameGeo, mats.solarTile);
    solarFrame.position.set(0, habElevation + habH + 0.7, 0);
    solarFrame.castShadow = true;
    habGroup.add(solarFrame);

    const cupolaGeo = new THREE.CylinderGeometry(3.6, 4.2, 2.2, 8);
    const cupola = new THREE.Mesh(cupolaGeo, mats.windowWarm);
    cupola.position.set(0, habElevation + habH + 1.4, 0);
    cupola.castShadow = true;
    habGroup.add(cupola);
    addHoloEdges(cupola, "habitat");

    const winGeo = new THREE.BoxGeometry(habW - 8, 0.85, 0.3);
    const winFront = new THREE.Mesh(winGeo, mats.windowWarm);
    winFront.position.set(0, habElevation + habH / 2 + 1, habD / 2 + 0.05);
    const winBack = new THREE.Mesh(winGeo, mats.windowWarm);
    winBack.position.set(0, habElevation + habH / 2 + 1, -habD / 2 - 0.05);
    habGroup.add(winFront, winBack);

    const habPorchLight = new THREE.PointLight(0xffaa00, 1.8, 18);
    habPorchLight.position.set(habW / 2 - 1, habElevation + 1.8, 0);
    habGroup.add(habPorchLight);

    const habUnderLight = new THREE.PointLight(0xffa500, 1.5, 28);
    habUnderLight.position.set(0, habElevation - 0.6, 0);
    habGroup.add(habUnderLight);

    const habLight = new THREE.PointLight(0x2ed6a1, 1.6, 32);
    habLight.position.set(0, habElevation + habH + 4, 0);
    habGroup.add(habLight);

    scene.add(habGroup);
    interactiveMeshes.push(habBody);

    // ── 3. ZONE 2: INDUSTRIAL GENERATOR BAY (Z-02) ──
    const genGroup = new THREE.Group();
    genGroup.userData = { zoneId: "generator" };
    const genW = 24, genH = 9, genD = 16;
    const genPos = { x: -44, z: -14 };

    const genPlinthGeo = new THREE.BoxGeometry(genW + 4, 1.2, genD + 4);
    const genPlinth = new THREE.Mesh(genPlinthGeo, mats.bundConcrete);
    genPlinth.position.set(genPos.x, 0.6, genPos.z);
    genPlinth.receiveShadow = true;
    genGroup.add(genPlinth);
    addHoloEdges(genPlinth, "generator");
    addContactShadow(genGroup, genPos.x, genPos.z, genW + 8, genD + 8);

    const genBodyGeo = new THREE.BoxGeometry(genW, genH, genD);
    const genBody = new THREE.Mesh(genBodyGeo, mats.genHull);
    genBody.position.set(genPos.x, 1.2 + genH / 2, genPos.z);
    genBody.castShadow = true;
    genBody.receiveShadow = true;
    genGroup.add(genBody);
    addHoloEdges(genBody, "generator");

    let chimneyMesh0 = null;
    let tipMesh0 = null;

    [-6, 0, 6].forEach((offset, idx) => {
      const stackGeo = new THREE.CylinderGeometry(0.75, 0.85, 6.5, 16);
      const stack = new THREE.Mesh(stackGeo, mats.towerSteel);
      stack.position.set(genPos.x + offset, 1.2 + genH + 3.25, genPos.z - 3);
      stack.castShadow = true;
      genGroup.add(stack);
      if (idx === 0) chimneyMesh0 = stack;

      const cowlGeo = new THREE.CylinderGeometry(1.1, 0.8, 0.6, 16);
      const cowl = new THREE.Mesh(cowlGeo, mats.towerSteel);
      cowl.position.set(genPos.x + offset, 1.2 + genH + 6.8, genPos.z - 3);
      genGroup.add(cowl);

      const tipGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(genPos.x + offset, 1.2 + genH + 7.3, genPos.z - 3);
      genGroup.add(tip);
      if (idx === 0) tipMesh0 = tip;
    });

    const louverGeo = new THREE.BoxGeometry(0.4, 5.0, genD - 4);
    const louverMat = new THREE.MeshStandardMaterial({ color: 0x07111a, roughness: 0.85 });
    const louverMesh = new THREE.Mesh(louverGeo, louverMat);
    louverMesh.position.set(genPos.x - genW / 2 - 0.1, 1.2 + genH / 2, genPos.z);
    genGroup.add(louverMesh);

    const indGeo = new THREE.BoxGeometry(0.2, 0.6, 2.0);
    const indMat = new THREE.MeshBasicMaterial({ color: 0x2ed6a1 });
    const indMesh = new THREE.Mesh(indGeo, indMat);
    indMesh.position.set(genPos.x - genW / 2 - 0.15, 1.2 + genH - 1.5, genPos.z);
    genGroup.add(indMesh);

    const transGeo = new THREE.BoxGeometry(4.5, 4.5, 5);
    const transMesh = new THREE.Mesh(transGeo, mats.stiltSteel);
    transMesh.position.set(genPos.x + genW / 2 + 2.5, 1.2 + 2.25, genPos.z);
    transMesh.castShadow = true;
    genGroup.add(transMesh);
    addHoloEdges(transMesh, "generator");

    const genWorkLight = new THREE.PointLight(0x67e8f9, 1.6, 22);
    genWorkLight.position.set(genPos.x - genW / 2 - 1.5, 1.2 + 3.5, genPos.z);
    genGroup.add(genWorkLight);

    const genLight = new THREE.PointLight(0x52bfff, 1.8, 34);
    genLight.position.set(genPos.x, 1.2 + genH + 5, genPos.z);
    genGroup.add(genLight);

    scene.add(genGroup);
    interactiveMeshes.push(genBody);

    // ── 4. ZONE 3: CRYOGENIC FUEL STORAGE FARM (Z-03) ──
    const fuelGroup = new THREE.Group();
    fuelGroup.userData = { zoneId: "fuel" };
    const fuelPos = { x: -46, z: 28 };
    const bundW = 28, bundD = 24, bundH = 2.4;

    const bundGeo = new THREE.BoxGeometry(bundW, bundH, bundD);
    const bundMesh = new THREE.Mesh(bundGeo, mats.bundConcrete);
    bundMesh.position.set(fuelPos.x, bundH / 2, fuelPos.z);
    bundMesh.receiveShadow = true;
    fuelGroup.add(bundMesh);
    addHoloEdges(bundMesh, "fuel");
    addContactShadow(fuelGroup, fuelPos.x, fuelPos.z, bundW + 6, bundD + 6);

    const tankGeo = new THREE.CylinderGeometry(3.6, 3.6, 7.8, 24);
    const tankCapGeo = new THREE.SphereGeometry(3.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 4);
    const tankOffsets = [
      [-7, -6],
      [7, -6],
      [-7, 6],
      [7, 6],
    ];

    tankOffsets.forEach(([ox, oz]) => {
      const tankMesh = new THREE.Mesh(tankGeo, mats.tankSteel);
      tankMesh.position.set(fuelPos.x + ox, bundH + 3.9, fuelPos.z + oz);
      tankMesh.castShadow = true;
      tankMesh.receiveShadow = true;
      fuelGroup.add(tankMesh);
      addHoloEdges(tankMesh, "fuel");

      const capMesh = new THREE.Mesh(tankCapGeo, mats.tankSteel);
      capMesh.position.set(fuelPos.x + ox, bundH + 7.8, fuelPos.z + oz);
      capMesh.castShadow = true;
      fuelGroup.add(capMesh);

      const catwalkGeo = new THREE.TorusGeometry(3.8, 0.15, 6, 24);
      const catwalk = new THREE.Mesh(catwalkGeo, mats.towerSteel);
      catwalk.rotation.x = Math.PI / 2;
      catwalk.position.set(fuelPos.x + ox, bundH + 4.2, fuelPos.z + oz);
      fuelGroup.add(catwalk);

      const gaugeGeo = new THREE.BoxGeometry(0.2, 5.5, 0.2);
      const gaugeMat = new THREE.MeshBasicMaterial({ color: 0x2ed6a1 });
      const gauge = new THREE.Mesh(gaugeGeo, gaugeMat);
      gauge.position.set(fuelPos.x + ox + 3.65, bundH + 4.0, fuelPos.z + oz);
      fuelGroup.add(gauge);
    });

    const manifoldGeo = new THREE.BoxGeometry(16, 0.4, 1.2);
    const manifoldMesh = new THREE.Mesh(manifoldGeo, mats.towerSteel);
    manifoldMesh.position.set(fuelPos.x, bundH + 2.5, fuelPos.z);
    fuelGroup.add(manifoldMesh);

    const fuelWorkLight = new THREE.PointLight(0xfde047, 1.6, 22);
    fuelWorkLight.position.set(fuelPos.x, bundH + 3.5, fuelPos.z);
    fuelGroup.add(fuelWorkLight);

    const fuelLight = new THREE.PointLight(0xf59e0b, 1.4, 28);
    fuelLight.position.set(fuelPos.x, bundH + 9, fuelPos.z);
    fuelGroup.add(fuelLight);

    scene.add(fuelGroup);
    interactiveMeshes.push(bundMesh);

    // ── 5. ZONE 4: SCIENCE LABORATORY COMPLEX (Z-04) ──
    const labGroup = new THREE.Group();
    labGroup.userData = { zoneId: "lab" };
    const labPos = { x: 44, z: -16 };
    const labW = 22, labH = 7.5, labD = 16;
    const labElev = 3.4;

    addHydraulicSkiStilts(labGroup, labPos.x, labPos.z, labW, labD, labElev, "lab");
    addContactShadow(labGroup, labPos.x, labPos.z, labW + 2, labD + 2);

    const labBodyGeo = new THREE.BoxGeometry(labW, labH, labD);
    const labBody = new THREE.Mesh(labBodyGeo, mats.labHull);
    labBody.position.set(labPos.x, labElev + labH / 2, labPos.z);
    labBody.castShadow = true;
    labBody.receiveShadow = true;
    labGroup.add(labBody);
    addHoloEdges(labBody, "lab");

    const airlockGeo = new THREE.BoxGeometry(3.5, 3.5, 3.5);
    const airlock = new THREE.Mesh(airlockGeo, mats.habRoof);
    airlock.position.set(labPos.x - labW / 2 - 1.7, labElev + 2.0, labPos.z);
    airlock.castShadow = true;
    labGroup.add(airlock);
    addHoloEdges(airlock, "lab");

    const domeGeo = new THREE.SphereGeometry(3.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMesh = new THREE.Mesh(domeGeo, mats.labTrim);
    domeMesh.position.set(labPos.x - 4, labElev + labH, labPos.z);
    domeMesh.castShadow = true;
    labGroup.add(domeMesh);
    addHoloEdges(domeMesh, "lab");

    const slitGeo = new THREE.BoxGeometry(0.8, 3.4, 2.8);
    const slitMat = new THREE.MeshBasicMaterial({ color: 0x050b14 });
    const slitMesh = new THREE.Mesh(slitGeo, slitMat);
    slitMesh.position.set(labPos.x - 4, labElev + labH + 1.6, labPos.z);
    labGroup.add(slitMesh);

    const mastGeo = new THREE.CylinderGeometry(0.12, 0.2, 12, 8);
    const mastMesh = new THREE.Mesh(mastGeo, mats.towerSteel);
    mastMesh.position.set(labPos.x + 6, labElev + labH + 6, labPos.z);
    mastMesh.castShadow = true;
    labGroup.add(mastMesh);

    const anemometerGroup = new THREE.Group();
    anemometerGroup.position.set(labPos.x + 6, labElev + labH + 12.2, labPos.z);
    for (let c = 0; c < 3; c++) {
      const armAng = (c * 2 * Math.PI) / 3;
      const cupGeo = new THREE.SphereGeometry(0.2, 8, 8, 0, Math.PI);
      const cup = new THREE.Mesh(cupGeo, mats.stiltHydraulic);
      cup.position.set(Math.cos(armAng) * 0.6, 0, Math.sin(armAng) * 0.6);
      cup.rotation.y = -armAng;
      anemometerGroup.add(cup);
    }
    labGroup.add(anemometerGroup);

    const labEntryLight = new THREE.PointLight(0xc084fc, 1.6, 18);
    labEntryLight.position.set(labPos.x - labW / 2 - 2, labElev + 3.5, labPos.z);
    labGroup.add(labEntryLight);

    const labLight = new THREE.PointLight(0xa78bfa, 1.5, 26);
    labLight.position.set(labPos.x, labElev + labH + 3.5, labPos.z);
    labGroup.add(labLight);

    scene.add(labGroup);
    interactiveMeshes.push(labBody);

    // ── 6. ZONE 5: DEEP-SPACE TELEMETRY & RADOME TOWER (Z-05) ──
    const comGroup = new THREE.Group();
    comGroup.userData = { zoneId: "comm-tower" };
    const comPos = { x: -2, z: -46 };
    const towerH = 24;

    const knollGeo = new THREE.CylinderGeometry(10, 16, 4, 24);
    const knollMesh = new THREE.Mesh(knollGeo, mats.bundConcrete);
    knollMesh.position.set(comPos.x, 2, comPos.z);
    knollMesh.receiveShadow = true;
    comGroup.add(knollMesh);
    addHoloEdges(knollMesh, "comm-tower");
    addContactShadow(comGroup, comPos.x, comPos.z, 24, 24, true);

    const legGeo = new THREE.CylinderGeometry(0.25, 0.35, towerH, 8);
    const rBase = 4.4;
    const legAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

    legAngles.forEach((ang) => {
      const leg = new THREE.Mesh(legGeo, mats.towerSteel);
      leg.position.set(
        comPos.x + Math.cos(ang) * rBase,
        4 + towerH / 2,
        comPos.z + Math.sin(ang) * rBase
      );
      leg.rotation.x = Math.sin(ang) * 0.07;
      leg.rotation.z = -Math.cos(ang) * 0.07;
      leg.castShadow = true;
      comGroup.add(leg);
    });

    for (let h = 8; h <= towerH + 2; h += 3.5) {
      const radiusAtH = rBase * (1 - h / (towerH * 1.5));
      const braceGeo = new THREE.TorusGeometry(radiusAtH, 0.12, 6, 24);
      const braceMesh = new THREE.Mesh(braceGeo, mats.towerSteel);
      braceMesh.rotation.x = Math.PI / 2;
      braceMesh.position.set(comPos.x, h, comPos.z);
      comGroup.add(braceMesh);
    }

    const radomeGeo = new THREE.IcosahedronGeometry(3.8, 2);
    const radomeMesh = new THREE.Mesh(radomeGeo, mats.radomeGeodesic);
    radomeMesh.position.set(comPos.x, 4 + towerH + 2.8, comPos.z);
    radomeMesh.castShadow = true;
    comGroup.add(radomeMesh);
    addHoloEdges(radomeMesh, "comm-tower");

    const dishGroup = new THREE.Group();
    dishGroup.position.set(comPos.x, 4 + towerH - 3, comPos.z + 3.2);

    const dishGeo = new THREE.CylinderGeometry(2.6, 0.4, 0.8, 20, 1, true);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.15,
      metalness: 0.85,
      side: THREE.DoubleSide,
    });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.rotation.x = Math.PI / 2.2;
    dishGroup.add(dishMesh);
    addHoloEdges(dishMesh, "comm-tower");

    const feedGeo = new THREE.CylinderGeometry(0.15, 0.25, 1.4, 8);
    const feed = new THREE.Mesh(feedGeo, mats.stiltHydraulic);
    feed.position.set(0, 0, 1.2);
    feed.rotation.x = Math.PI / 2;
    dishGroup.add(feed);

    comGroup.add(dishGroup);

    const dishGlow = new THREE.PointLight(0x38bdf8, 2.2, 18);
    dishGlow.position.set(comPos.x, 4 + towerH - 3, comPos.z + 4.5);
    comGroup.add(dishGlow);

    const beaconGeo = new THREE.SphereGeometry(0.55, 12, 12);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff4757 });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(comPos.x, 4 + towerH + 7.0, comPos.z);
    comGroup.add(beaconMesh);

    const comLight = new THREE.PointLight(0x38bdf8, 2.0, 42);
    comLight.position.set(comPos.x, 4 + towerH + 3.5, comPos.z);
    comGroup.add(comLight);

    scene.add(comGroup);
    interactiveMeshes.push(radomeMesh);

    // ── 7. ZONE 6: STORAGE & LOGISTICS DEPOT (Z-06) ──
    // Authentic polar supply complex, autonomous rover, rough-terrain telehandler,
    // snow-covered containers, marked logistics lanes, and high-mast yard floodlights.
    const stoGroup = new THREE.Group();
    stoGroup.userData = { zoneId: "storage" };
    const stoPos = { x: 44, z: 42 };
    const stoW = 24, stoH = 8.5, stoD = 16;

    addContactShadow(stoGroup, stoPos.x, stoPos.z, stoW + 14, stoD + 16);

    // Helper: Stenciled Polar Logistics Signage Textures
    const makeSignTexture = (text, subtitle, accent = "#38bdf8") => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#071420";
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, 500, 116);
      ctx.fillStyle = accent;
      ctx.fillRect(6, 6, 16, 116);
      ctx.font = "bold 30px monospace";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, 34, 52);
      ctx.font = "18px monospace";
      ctx.fillStyle = accent;
      ctx.fillText(subtitle, 34, 90);
      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 4;
      return tex;
    };

    // Main Insulated Logistics Warehouse Hangar
    const stoBodyGeo = new THREE.BoxGeometry(stoW, stoH, stoD);
    const stoBody = new THREE.Mesh(stoBodyGeo, mats.storageHull);
    stoBody.position.set(stoPos.x, stoH / 2 + 0.4, stoPos.z);
    stoBody.castShadow = true;
    stoBody.receiveShadow = true;
    stoGroup.add(stoBody);
    addHoloEdges(stoBody, "storage");

    // Arched Insulated Corrugated Roof Shell
    const stoRoofGeo = new THREE.CylinderGeometry(stoD / 2, stoD / 2, stoW - 2, 20, 1, false, 0, Math.PI);
    const stoRoof = new THREE.Mesh(stoRoofGeo, mats.storageRoof);
    stoRoof.rotation.z = Math.PI / 2;
    stoRoof.position.set(stoPos.x, stoH + 0.4, stoPos.z);
    stoRoof.castShadow = true;
    stoGroup.add(stoRoof);
    addHoloEdges(stoRoof, "storage");

    // Snow Accumulation Ridge Cap on Warehouse Roof
    const roofSnowGeo = new THREE.BoxGeometry(stoW - 2.5, 0.4, 2.2);
    const roofSnow = new THREE.Mesh(roofSnowGeo, mats.snowCap);
    roofSnow.position.set(stoPos.x, stoH + stoD / 2 + 0.35, stoPos.z);
    stoGroup.add(roofSnow);

    // Stenciled Logistics Facade Signage
    const signTex1 = makeSignTexture("Z-06 // LOGISTICS DEPOT", "STATION SUPPLY & VEHICLE WORKSHOP", "#38bdf8");
    const signMat1 = new THREE.MeshBasicMaterial({ map: signTex1 });
    const sign1 = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.7), signMat1);
    sign1.position.set(stoPos.x, 7.8, stoPos.z + stoD / 2 + 0.12);
    stoGroup.add(sign1);

    const signTex2 = makeSignTexture("BAY-1 // INBOUND CARGO", "MAX CLEARANCE 4.8M", "#f59e0b");
    const signMat2 = new THREE.MeshBasicMaterial({ map: signTex2 });
    const sign2 = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.4), signMat2);
    sign2.position.set(stoPos.x - 4, 6.2, stoPos.z + stoD / 2 + 0.12);
    stoGroup.add(sign2);

    const signTex3 = makeSignTexture("AIRLOCK 06 // CREW ACCESS", "AUTHORIZED PERSONNEL ONLY", "#2ed6a1");
    const signMat3 = new THREE.MeshBasicMaterial({ map: signTex3 });
    const sign3 = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.0), signMat3);
    sign3.position.set(stoPos.x + 6, 4.4, stoPos.z + stoD / 2 + 0.12);
    stoGroup.add(sign3);

    // Industrial Roll-Up Loading Bay Cargo Doors with Hazard Chevron Trim
    const doorGeo = new THREE.BoxGeometry(6.5, 5.5, 0.4);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x14222d, roughness: 0.4, metalness: 0.7 });
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(stoPos.x - 4, 3.2, stoPos.z + stoD / 2 + 0.05);
    stoGroup.add(doorMesh);
    addHoloEdges(doorMesh, "storage");

    // Vehicle Loading & Unloading Ramp
    const rampGeo = new THREE.BoxGeometry(8.5, 0.4, 6.5);
    const rampMesh = new THREE.Mesh(rampGeo, mats.bundConcrete);
    rampMesh.position.set(stoPos.x - 4, 0.25, stoPos.z + stoD / 2 + 3.2);
    rampMesh.rotation.x = 0.08;
    rampMesh.receiveShadow = true;
    stoGroup.add(rampMesh);

    // Ramp Hazard Border Edge Strips
    [-4 - 4.25, -4 + 4.25].forEach((rx) => {
      const edgeGeo = new THREE.BoxGeometry(0.3, 0.6, 6.5);
      const edge = new THREE.Mesh(edgeGeo, mats.forkliftYellow);
      edge.position.set(stoPos.x + rx, 0.4, stoPos.z + stoD / 2 + 3.2);
      edge.rotation.x = 0.08;
      stoGroup.add(edge);
    });

    // ── 4 STACKED ISO SHIPPING CONTAINERS WITH 3D SNOW ACCUMULATION ──
    const dunnageGeo = new THREE.BoxGeometry(6.8, 0.35, 2.8);
    const d1 = new THREE.Mesh(dunnageGeo, mats.dunnageWood);
    d1.position.set(stoPos.x - stoW / 2 - 4.5, 0.18, stoPos.z - 3);
    const d2 = new THREE.Mesh(dunnageGeo, mats.dunnageWood);
    d2.position.set(stoPos.x - stoW / 2 - 4.5, 0.18, stoPos.z + 2.8);
    stoGroup.add(d1, d2);

    const cGeo = new THREE.BoxGeometry(6.4, 2.5, 2.5);

    // Container 1: Safety Orange (Emergency Food Rations & Survival Kits)
    const c1 = new THREE.Mesh(cGeo, mats.cargoOrange);
    c1.position.set(stoPos.x - stoW / 2 - 4.5, 1.45, stoPos.z - 3);
    c1.castShadow = true;
    stoGroup.add(c1);
    addHoloEdges(c1, "storage");

    // Container 2: Antarctic Blue (Scientific Expedition Gear) stacked on C1
    const c2 = new THREE.Mesh(cGeo, mats.cargoBlue);
    c2.position.set(stoPos.x - stoW / 2 - 4.5, 3.95, stoPos.z - 3);
    c2.castShadow = true;
    stoGroup.add(c2);
    addHoloEdges(c2, "storage");

    // Sculpted 3D Snow Drift Cap on Container 2
    const snowCapGeo = new THREE.BoxGeometry(6.4, 0.35, 2.5);
    const snowCap2 = new THREE.Mesh(snowCapGeo, mats.snowCap);
    snowCap2.position.set(stoPos.x - stoW / 2 - 4.5, 5.3, stoPos.z - 3);
    stoGroup.add(snowCap2);

    // Container 3: High-Visibility Yellow (Mechanical Spares & Generator Parts)
    const c3 = new THREE.Mesh(cGeo, mats.cargoYellow);
    c3.position.set(stoPos.x - stoW / 2 - 4.5, 1.45, stoPos.z + 2.8);
    c3.castShadow = true;
    stoGroup.add(c3);
    addHoloEdges(c3, "storage");

    // Container 4: Polar Medical White with Red Cross Accent (Extreme Cold Medical)
    const c4 = new THREE.Mesh(cGeo, mats.cargoWhite);
    c4.position.set(stoPos.x - stoW / 2 - 4.5, 3.95, stoPos.z + 2.8);
    c4.castShadow = true;
    stoGroup.add(c4);
    addHoloEdges(c4, "storage");

    // Red Cross Decal on Container 4
    const crossVGeo = new THREE.PlaneGeometry(0.5, 1.6);
    const crossHGeo = new THREE.PlaneGeometry(1.6, 0.5);
    const crossV = new THREE.Mesh(crossVGeo, mats.pistenRed);
    const crossH = new THREE.Mesh(crossHGeo, mats.pistenRed);
    crossV.position.set(stoPos.x - stoW / 2 - 4.5, 3.95, stoPos.z + 2.8 + 1.26);
    crossH.position.set(stoPos.x - stoW / 2 - 4.5, 3.95, stoPos.z + 2.8 + 1.26);
    stoGroup.add(crossV, crossH);

    // Sculpted 3D Snow Drift Cap on Container 4
    const snowCap4 = new THREE.Mesh(snowCapGeo, mats.snowCap);
    snowCap4.position.set(stoPos.x - stoW / 2 - 4.5, 5.3, stoPos.z + 2.8);
    stoGroup.add(snowCap4);

    // ── HEAVY CANTILEVERED SUPPLY RACKS & EQUIPMENT CRATES ──
    const rackGeo = new THREE.BoxGeometry(8, 4.5, 1.8);
    const rackMesh = new THREE.Mesh(rackGeo, mats.towerSteel);
    rackMesh.position.set(stoPos.x + 4, 2.4, stoPos.z - stoD / 2 - 2);
    stoGroup.add(rackMesh);

    [-2.5, 0, 2.5].forEach((offset) => {
      const crateGeo = new THREE.BoxGeometry(1.8, 1.4, 1.4);
      const crate = new THREE.Mesh(crateGeo, mats.crateWood);
      crate.position.set(stoPos.x + 4 + offset, 1.2, stoPos.z - stoD / 2 - 2);
      crate.castShadow = true;
      stoGroup.add(crate);

      const crateTop = new THREE.Mesh(crateGeo, mats.crateWood);
      crateTop.position.set(stoPos.x + 4 + offset, 2.8, stoPos.z - stoD / 2 - 2);
      crateTop.castShadow = true;
      stoGroup.add(crateTop);
    });

    // ── AUTONOMOUS POLAR SUPPLY ROVER (WITH ANIMATED CARGO TRANSFER LOOP) ──
    const roverGroup = new THREE.Group();
    roverGroup.position.set(stoPos.x - 2, 0.45, stoPos.z + 10.5);

    // Rover Blue Chassis Body
    const roverBodyGeo = new THREE.BoxGeometry(3.2, 0.55, 1.8);
    const roverBody = new THREE.Mesh(roverBodyGeo, mats.roverBlue);
    roverBody.position.set(0, 0.45, 0);
    roverBody.castShadow = true;
    roverGroup.add(roverBody);
    addHoloEdges(roverBody, "storage");

    // Silver Bumper & Bull-Bar Roll Cage
    const bumperGeo = new THREE.BoxGeometry(3.4, 0.2, 2.0);
    const bumper = new THREE.Mesh(bumperGeo, mats.roverSilver);
    bumper.position.set(0, 0.35, 0);
    roverGroup.add(bumper);

    // 6 Polar All-Terrain Balloon Wheels
    [-1.1, 0, 1.1].forEach((wx) => {
      [-0.95, 0.95].forEach((wz) => {
        const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.32, 12);
        const wheel = new THREE.Mesh(wheelGeo, mats.pistenTrack);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx, 0.36, wz);
        wheel.castShadow = true;
        roverGroup.add(wheel);
      });
    });

    // Autonomous Lidar Scanner Mast & Spinning Sensor Puck
    const roverMastGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8);
    const roverMast = new THREE.Mesh(roverMastGeo, mats.towerSteel);
    roverMast.position.set(1.1, 1.1, 0);
    roverGroup.add(roverMast);

    const lidarPuckGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 12);
    const lidarPuck = new THREE.Mesh(lidarPuckGeo, mats.roverSilver);
    lidarPuck.position.set(1.1, 1.7, 0);
    roverGroup.add(lidarPuck);

    // Rear Cargo Bed with Shrink-Wrapped Supply Payload
    const palletGeo = new THREE.BoxGeometry(1.6, 0.12, 1.3);
    const pallet = new THREE.Mesh(palletGeo, mats.dunnageWood);
    pallet.position.set(-0.6, 0.78, 0);
    roverGroup.add(pallet);

    const cargoPayloadGeo = new THREE.BoxGeometry(1.5, 0.85, 1.2);
    const cargoPayload = new THREE.Mesh(cargoPayloadGeo, mats.shrinkWrap);
    cargoPayload.position.set(-0.6, 1.28, 0);
    roverGroup.add(cargoPayload);

    // Rover Warning Strobe Beacon
    const roverBeaconGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const roverBeaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const roverBeacon = new THREE.Mesh(roverBeaconGeo, roverBeaconMat);
    roverBeacon.position.set(1.1, 1.86, 0);
    roverGroup.add(roverBeacon);

    stoGroup.add(roverGroup);

    // ── HEAVY ROUGH-TERRAIN FORKLIFT / TELEHANDLER ──
    const teleGroup = new THREE.Group();
    teleGroup.position.set(stoPos.x + 8.5, 0.4, stoPos.z + 11.5);

    // Yellow Telehandler Chassis
    const teleBodyGeo = new THREE.BoxGeometry(3.8, 1.5, 2.2);
    const teleBody = new THREE.Mesh(teleBodyGeo, mats.forkliftYellow);
    teleBody.position.set(0, 1.1, 0);
    teleBody.castShadow = true;
    teleGroup.add(teleBody);
    addHoloEdges(teleBody, "storage");

    // Heavy Counterweight
    const cwGeo = new THREE.BoxGeometry(1.1, 1.3, 2.0);
    const cw = new THREE.Mesh(cwGeo, mats.pistenTrack);
    cw.position.set(-1.45, 1.1, 0);
    teleGroup.add(cw);

    // Operator Safety Roll-Cage Cab
    const cabFrameGeo = new THREE.BoxGeometry(1.7, 1.7, 1.5);
    const cabFrame = new THREE.Mesh(cabFrameGeo, mats.forkliftMast);
    cabFrame.position.set(0.2, 2.4, -0.2);
    teleGroup.add(cabFrame);

    // Telescopic Boom Angled Forward
    const boomGeo = new THREE.BoxGeometry(4.2, 0.45, 0.45);
    const boom = new THREE.Mesh(boomGeo, mats.forkliftYellow);
    boom.position.set(1.2, 2.1, 0.5);
    boom.rotation.z = -0.15;
    teleGroup.add(boom);

    // Front Steel Lifting Forks
    [-0.35, 0.35].forEach((fz) => {
      const forkGeo = new THREE.BoxGeometry(1.8, 0.08, 0.1);
      const fork = new THREE.Mesh(forkGeo, mats.towerSteel);
      fork.position.set(3.2, 0.4, fz + 0.5);
      teleGroup.add(fork);
    });

    // Pallet with Weather-Proof Supply Box on Forks
    const telePallet = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.3), mats.dunnageWood);
    telePallet.position.set(3.2, 0.5, 0.5);
    const teleBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.1), mats.cargoOrange);
    teleBox.position.set(3.2, 1.02, 0.5);
    teleGroup.add(telePallet, teleBox);

    // 4 Large Rough-Terrain Polar Balloon Tires
    [-1.2, 1.2].forEach((tx) => {
      [-1.1, 1.1].forEach((tz) => {
        const tireGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.45, 14);
        const tire = new THREE.Mesh(tireGeo, mats.pistenTrack);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(tx, 0.65, tz);
        tire.castShadow = true;
        teleGroup.add(tire);
      });
    });

    // Telehandler Flashing Warning Beacon
    const teleBeaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const teleBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), teleBeaconMat);
    teleBeacon.position.set(0.2, 3.35, -0.2);
    teleGroup.add(teleBeacon);

    stoGroup.add(teleGroup);

    // ── PISTENBULLY TRACKED SNOWCAT IN MAINTENANCE BAY ──
    const catGroup = new THREE.Group();
    catGroup.position.set(stoPos.x + 9, 0.4, stoPos.z - 2.5);

    const catCabGeo = new THREE.BoxGeometry(3.6, 2.2, 2.6);
    const catCab = new THREE.Mesh(catCabGeo, mats.pistenRed);
    catCab.position.set(0, 1.4, 0);
    catCab.castShadow = true;
    catGroup.add(catCab);
    addHoloEdges(catCab, "storage");

    const bladeGeo = new THREE.BoxGeometry(0.3, 0.9, 3.4);
    const blade = new THREE.Mesh(bladeGeo, mats.towerSteel);
    blade.position.set(0, 0.7, 2.2);
    catGroup.add(blade);

    const trackGeo = new THREE.BoxGeometry(0.7, 0.8, 4.6);
    const leftTrack = new THREE.Mesh(trackGeo, mats.pistenTrack);
    leftTrack.position.set(-1.4, 0.4, 0);
    leftTrack.castShadow = true;
    const rightTrack = new THREE.Mesh(trackGeo, mats.pistenTrack);
    rightTrack.position.set(1.4, 0.4, 0);
    rightTrack.castShadow = true;
    catGroup.add(leftTrack, rightTrack);

    const catBeaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const catBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), catBeaconMat);
    catBeacon.position.set(0, 2.7, 0);
    catGroup.add(catBeacon);

    stoGroup.add(catGroup);

    // ── VEHICLE PARKING BAY WITH HEAVY STEEL BOLLARDS & ENGINE HEATER PEDESTAL ──
    const bollardPositions = [
      [stoPos.x + 4.5, stoPos.z + 8.5],
      [stoPos.x + 13.5, stoPos.z + 8.5],
      [stoPos.x + 4.5, stoPos.z + 14.5],
      [stoPos.x + 13.5, stoPos.z + 14.5],
    ];
    bollardPositions.forEach(([bx, bz]) => {
      const bGeo = new THREE.CylinderGeometry(0.18, 0.2, 1.2, 10);
      const bMesh = new THREE.Mesh(bGeo, mats.bollardSteel);
      bMesh.position.set(bx, 0.6, bz);
      bMesh.castShadow = true;
      stoGroup.add(bMesh);

      // Yellow reflective top cap
      const capGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.2, 10);
      const cap = new THREE.Mesh(capGeo, mats.forkliftYellow);
      cap.position.set(bx, 1.15, bz);
      stoGroup.add(cap);
    });

    // Engine Block Heater Pedestal
    const pedestalGeo = new THREE.BoxGeometry(0.4, 1.1, 0.4);
    const pedestal = new THREE.Mesh(pedestalGeo, mats.towerSteel);
    pedestal.position.set(stoPos.x + 4.2, 0.55, stoPos.z + 11.5);
    const pedLed = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    pedLed.position.set(stoPos.x + 4.2, 1.05, stoPos.z + 11.5);
    stoGroup.add(pedestal, pedLed);

    // ── MARKED LOGISTICS LANES & SEQUENTIAL CHASING RUNWAY GUIDE LEDS ──
    const guideLeds = [];
    for (let k = 0; k < 8; k++) {
      const gx = stoPos.x - 12 + k * 3.2;
      const gz = stoPos.z + stoD / 2 + 3.6;
      const ledGeo = new THREE.SphereGeometry(0.14, 8, 8);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x0369a1 });
      const ledMesh = new THREE.Mesh(ledGeo, ledMat);
      ledMesh.position.set(gx, 0.12, gz);
      stoGroup.add(ledMesh);
      guideLeds.push(ledMesh);
    }

    // High-Visibility Hazard Perimeter Stripes along Apron Boundary
    const hazardGeo = new THREE.PlaneGeometry(32, 0.5);
    const hazardMesh = new THREE.Mesh(hazardGeo, mats.forkliftYellow);
    hazardMesh.rotation.x = -Math.PI / 2;
    hazardMesh.position.set(stoPos.x, 0.08, stoPos.z + stoD / 2 + 7.5);
    stoGroup.add(hazardMesh);

    // ── HEAVY COMPONENT GANTRY CRANE WITH HOIST SWAY ──
    const gantryGeo = new THREE.BoxGeometry(0.45, 6.8, 0.45);
    const g1 = new THREE.Mesh(gantryGeo, mats.cargoYellow);
    g1.position.set(stoPos.x + 5, 3.4, stoPos.z + 6);
    const g2 = new THREE.Mesh(gantryGeo, mats.cargoYellow);
    g2.position.set(stoPos.x + 13, 3.4, stoPos.z + 6);
    const gBeamGeo = new THREE.BoxGeometry(8.5, 0.5, 0.5);
    const gBeam = new THREE.Mesh(gBeamGeo, mats.cargoYellow);
    gBeam.position.set(stoPos.x + 9, 6.7, stoPos.z + 6);
    stoGroup.add(g1, g2, gBeam);

    // Crane Trolley and Suspended Hoisted Container
    const hoistGroup = new THREE.Group();
    hoistGroup.position.set(stoPos.x + 9, 3.8, stoPos.z + 6);

    const hoistCableGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6);
    const hoistCable = new THREE.Mesh(hoistCableGeo, mats.towerSteel);
    hoistCable.position.set(0, 1.2, 0);
    hoistGroup.add(hoistCable);

    const spreaderGeo = new THREE.BoxGeometry(2.4, 0.15, 1.2);
    const spreader = new THREE.Mesh(spreaderGeo, mats.cargoYellow);
    spreader.position.set(0, 0.05, 0);
    hoistGroup.add(spreader);

    const hoistedCrateGeo = new THREE.BoxGeometry(2.2, 1.4, 1.2);
    const hoistedCrate = new THREE.Mesh(hoistedCrateGeo, mats.cargoBlue);
    hoistedCrate.position.set(0, -0.75, 0);
    hoistedCrate.castShadow = true;
    hoistGroup.add(hoistedCrate);
    addHoloEdges(hoistedCrate, "storage");

    stoGroup.add(hoistGroup);

    // ── 14M HIGH-MAST AREA FLOODLIGHT TOWER ──
    const towerGroup = new THREE.Group();
    const towerBasePos = { x: stoPos.x + 16, z: stoPos.z + 14 };
    const mastH = 14.0;

    // 4 Steel Mast Legs with Cross Bracing
    [-0.6, 0.6].forEach((tx) => {
      [-0.6, 0.6].forEach((tz) => {
        const legGeo = new THREE.CylinderGeometry(0.08, 0.12, mastH, 8);
        const leg = new THREE.Mesh(legGeo, mats.towerSteel);
        leg.position.set(towerBasePos.x + tx, mastH / 2, towerBasePos.z + tz);
        leg.castShadow = true;
        towerGroup.add(leg);
      });
    });

    // Upper Maintenance Platform & Lamp Crossbar
    const platGeo = new THREE.BoxGeometry(2.2, 0.2, 2.2);
    const plat = new THREE.Mesh(platGeo, mats.towerSteel);
    plat.position.set(towerBasePos.x, mastH, towerBasePos.z);
    towerGroup.add(plat);

    // 4 High-Output LED Lamp Fixtures
    const lampFixtureGeo = new THREE.BoxGeometry(0.5, 0.35, 0.35);
    const lampFixtureMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const lampHead = new THREE.Mesh(lampFixtureGeo, lampFixtureMat);
    lampHead.position.set(towerBasePos.x, mastH + 0.4, towerBasePos.z);
    lampHead.rotation.x = 0.4;
    lampHead.rotation.y = -0.5;
    towerGroup.add(lampHead);

    // High-Mast Yard Area Floodlight (SpotLight casting broad cyan pool over logistics yard)
    const yardFloodLight = new THREE.SpotLight(0x67e8f9, 2.4, 65, Math.PI / 3.0, 0.42, 1.2);
    yardFloodLight.position.set(towerBasePos.x, mastH + 0.5, towerBasePos.z);
    yardFloodLight.target.position.set(stoPos.x, 0.5, stoPos.z + 4);
    stoGroup.add(yardFloodLight);
    stoGroup.add(yardFloodLight.target);

    // Glare Point Light at Floodlight Fixture
    const yardGlareLight = new THREE.PointLight(0x67e8f9, 1.8, 16);
    yardGlareLight.position.set(towerBasePos.x, mastH + 0.5, towerBasePos.z);
    towerGroup.add(yardGlareLight);

    // Tower Peak Red Aircraft Warning Beacon
    const towerBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4757 }));
    towerBeacon.position.set(towerBasePos.x, mastH + 1.2, towerBasePos.z);
    towerGroup.add(towerBeacon);

    stoGroup.add(towerGroup);

    // ── FACILITY TASK & STATUS LIGHTS ──
    // 1. Loading Bay Overhead Work Floodlight
    const stoWorkLight = new THREE.PointLight(0x67e8f9, 1.8, 22);
    stoWorkLight.position.set(stoPos.x - 4, 6.2, stoPos.z + stoD / 2 + 1.5);
    stoGroup.add(stoWorkLight);

    // 2. Personnel Doorway Warm Porch Light
    const stoEntryLight = new THREE.PointLight(0xffaa00, 1.5, 16);
    stoEntryLight.position.set(stoPos.x + 6, 3.0, stoPos.z + stoD / 2 + 0.5);
    stoGroup.add(stoEntryLight);

    // 3. Logistics Readiness Status Beacon Tower (Reacts to inventory/cold risk)
    const stoStatusLight = new THREE.PointLight(0x2ed6a1, 1.6, 28);
    stoStatusLight.position.set(stoPos.x, stoH + 3.2, stoPos.z);
    stoGroup.add(stoStatusLight);

    scene.add(stoGroup);
    interactiveMeshes.push(stoBody);

    // ── 8. ENCLOSED ELEVATED SKYWALKS ──
    const addSkywalk3D = (p1, p2, width = 2.4, height = 2.8) => {
      const dx = p2[0] - p1[0];
      const dz = p2[1] - p1[1];
      const len = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);

      const tubeGeo = new THREE.BoxGeometry(len, height, width);
      const tube = new THREE.Mesh(tubeGeo, mats.skywalkHull);
      tube.position.set((p1[0] + p2[0]) / 2, 4.2, (p1[1] + p2[1]) / 2);
      tube.rotation.y = -angle;
      tube.castShadow = true;
      tube.receiveShadow = true;
      scene.add(tube);
      addHoloEdges(tube);

      const winGeo = new THREE.BoxGeometry(len - 4, 0.5, width + 0.1);
      const win = new THREE.Mesh(winGeo, mats.windowWarm);
      win.position.set((p1[0] + p2[0]) / 2, 4.2, (p1[1] + p2[1]) / 2);
      win.rotation.y = -angle;
      scene.add(win);

      const midStiltGeo = new THREE.CylinderGeometry(0.3, 0.35, 3.8, 8);
      const midStilt = new THREE.Mesh(midStiltGeo, mats.towerSteel);
      midStilt.position.set((p1[0] + p2[0]) / 2, 1.9, (p1[1] + p2[1]) / 2);
      midStilt.castShadow = true;
      scene.add(midStilt);
    };

    addSkywalk3D([-habW / 2, 0], [genPos.x + genW / 2, genPos.z]); // Skywalk C-01: Hab to Gen
    addSkywalk3D([habW / 2, 0], [labPos.x - labW / 2, labPos.z]);   // Skywalk C-02: Hab to Lab
    addSkywalk3D([habW / 4, habD / 2], [stoPos.x - stoW / 2 + 2, stoPos.z - stoD / 2 + 2]); // Skywalk C-03: Hab to Storage Depot

    // ── 9. ANIMATED INFRASTRUCTURE FLOWS (Power, Fuel, Comms) ──
    const powerFlowCount = 36;
    const powerFlowGeo = new THREE.BufferGeometry();
    const powerPositions = new Float32Array(powerFlowCount * 3);
    const powerMat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.9,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    });
    const powerStream = new THREE.Points(powerFlowGeo, powerMat);
    scene.add(powerStream);

    const fuelFlowCount = 20;
    const fuelFlowGeo = new THREE.BufferGeometry();
    const fuelPositions = new Float32Array(fuelFlowCount * 3);
    const fuelMat = new THREE.PointsMaterial({
      color: 0xff4757,
      size: 0.95,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
    });
    const fuelStream = new THREE.Points(fuelFlowGeo, fuelMat);
    scene.add(fuelStream);

    const commsFlowCount = 36;
    const commsFlowGeo = new THREE.BufferGeometry();
    const commsPositions = new Float32Array(commsFlowCount * 3);
    const commsMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.85,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const commsStream = new THREE.Points(commsFlowGeo, commsMat);
    scene.add(commsStream);

    // ── 10. SUBTLE POLAR SNOW ──
    const fallingCount = 750;
    const fallGeo = new THREE.BufferGeometry();
    const fallPositions = new Float32Array(fallingCount * 3);
    const fallVelocities = new Float32Array(fallingCount * 3);

    for (let i = 0; i < fallingCount; i++) {
      fallPositions[i * 3] = (Math.random() - 0.5) * 240;
      fallPositions[i * 3 + 1] = Math.random() * 55;
      fallPositions[i * 3 + 2] = (Math.random() - 0.5) * 240;

      fallVelocities[i * 3] = (Math.random() - 0.5) * 0.9;
      fallVelocities[i * 3 + 1] = -(0.55 + Math.random() * 0.8);
      fallVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
    }
    fallGeo.setAttribute("position", new THREE.BufferAttribute(fallPositions, 3));
    const fallMat = new THREE.PointsMaterial({
      color: 0xd8ecf8,
      size: 0.28,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
    });
    const fallParticles = new THREE.Points(fallGeo, fallMat);
    scene.add(fallParticles);

    const driftCount = 250;
    const driftGeo = new THREE.BufferGeometry();
    const driftPositions = new Float32Array(driftCount * 3);
    const driftVelocities = new Float32Array(driftCount * 3);

    for (let i = 0; i < driftCount; i++) {
      driftPositions[i * 3] = (Math.random() - 0.5) * 200;
      driftPositions[i * 3 + 1] = 0.2 + Math.random() * 1.8;
      driftPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;

      driftVelocities[i * 3] = 1.2 + Math.random() * 1.5;
      driftVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
      driftVelocities[i * 3 + 2] = 1.2 + Math.random() * 1.5;
    }
    driftGeo.setAttribute("position", new THREE.BufferAttribute(driftPositions, 3));
    const driftMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.35,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
    });
    const driftParticles = new THREE.Points(driftGeo, driftMat);
    scene.add(driftParticles);

    // Save references for dynamic weather/telemetry updates
    dynamicElementsRef.current = {
      scene,
      renderer,
      camera,
      controls,
      ambientLight,
      sunLight,
      hemiLight,
      fillLight,
      cyanRimLight,
      genBody,
      mats,
      genLight,
      chimneyMesh0,
      tipMesh0,
      stoStatusLight,
      fallGeo,
      fallMat,
      fallVelocities,
      fallingCount,
      driftVelocities,
      driftCount,
      auroraMesh1,
      auroraMesh2,
      skyMat,
      starMat,
      zoneEdgeMeshes,
    };

    // ── Raycasting & Mouse Interaction ──
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const flyToCamera = (endPos, endTarget, duration = 1100, arc = 0) => {
      const trans = transitionRef.current;
      trans.active = true;
      trans.startTime = performance.now();
      trans.duration = duration;
      trans.startPos.copy(camera.position);
      trans.endPos.copy(endPos);
      trans.startTarget.copy(controls.target);
      trans.endTarget.copy(endTarget);

      const linearDist = trans.startPos.distanceTo(endPos);
      trans.arcHeight = arc > 0 ? arc : Math.min(14, Math.max(0, linearDist * 0.12));

      controls.enabled = false;
    };
    flyToCameraRef.current = flyToCamera;

    const onPointerDown = (e) => {
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
      cancelCameraFlight();
    };

    const onPointerMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes, true);

      if (intersects.length > 0) {
        let root = intersects[0].object;
        while (root.parent && !root.userData?.zoneId) {
          root = root.parent;
        }
        const zoneId = root.userData?.zoneId;
        if (zoneId) {
          if (hoveredZoneIdRef.current !== zoneId) {
            if (hoveredZoneIdRef.current && zoneEdgeMeshes[hoveredZoneIdRef.current]) {
              zoneEdgeMeshes[hoveredZoneIdRef.current].forEach((line) => {
                line.material = mats.holoEdgeDefault;
              });
            }
            hoveredZoneIdRef.current = zoneId;
            if (zoneEdgeMeshes[zoneId]) {
              zoneEdgeMeshes[zoneId].forEach((line) => {
                line.material = mats.holoEdgeActive;
              });
            }
          }

          const zoneObj = propsRef.current.zonesDef?.find((z) => z.id === zoneId);
          if (zoneObj && propsRef.current.onHoverZone) propsRef.current.onHoverZone(zoneObj);
          renderer.domElement.style.cursor = "pointer";
          return;
        }
      }

      if (hoveredZoneIdRef.current && zoneEdgeMeshes[hoveredZoneIdRef.current]) {
        zoneEdgeMeshes[hoveredZoneIdRef.current].forEach((line) => {
          line.material = mats.holoEdgeDefault;
        });
        hoveredZoneIdRef.current = null;
      }
      if (propsRef.current.onHoverZone) propsRef.current.onHoverZone(null);
      renderer.domElement.style.cursor = "grab";
    };

    const onClick = (e) => {
      const startPos = pointerDownPosRef.current;
      const dragDist = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y);
      if (dragDist > 5) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes, true);

      if (intersects.length > 0) {
        let root = intersects[0].object;
        while (root.parent && !root.userData?.zoneId) {
          root = root.parent;
        }
        const zoneId = root.userData?.zoneId;
        if (zoneId) {
          const zoneObj = propsRef.current.zonesDef?.find((z) => z.id === zoneId);
          if (zoneObj && propsRef.current.onSelectZone) propsRef.current.onSelectZone(zoneObj);

          const focus = ZONE_FOCUS_COORDS[zoneId];
          if (focus && flyToCameraRef.current) {
            setActiveCamPreset(zoneId === "comm-tower" ? "tower" : zoneId);
            flyToCameraRef.current(focus.pos, focus.target, 1100, focus.arc);
          }
        }
      }
    };

    const onWheel = () => {
      cancelCameraFlight();
    };

    const onTouchStart = (e) => {
      if (e.touches && e.touches.length > 0) {
        pointerDownPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      cancelCameraFlight();
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });

    // ── ANIMATION & RENDER LOOP ──
    const clock = new THREE.Clock();
    let beaconBlinkTimer = 0;

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Cinematic Camera Flight Interpolation
      const trans = transitionRef.current;
      if (trans.active) {
        const now = performance.now();
        const elapsedFlight = now - trans.startTime;
        const t = Math.min(1.0, elapsedFlight / trans.duration);

        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        controls.target.lerpVectors(trans.startTarget, trans.endTarget, ease);
        camera.position.lerpVectors(trans.startPos, trans.endPos, ease);

        if (trans.arcHeight > 0) {
          const arcOffset = Math.sin(t * Math.PI) * trans.arcHeight;
          camera.position.y += arcOffset;
        }

        if (t >= 1.0) {
          trans.active = false;
          camera.position.copy(trans.endPos);
          controls.target.copy(trans.endTarget);
          controls.enabled = true;
          controls.update();
        }
      } else {
        controls.update();

        if (camera.position.y < 2.2) {
          camera.position.y = 2.2;
        }
        controls.target.x = THREE.MathUtils.clamp(controls.target.x, -65, 65);
        controls.target.z = THREE.MathUtils.clamp(controls.target.z, -65, 65);
        controls.target.y = THREE.MathUtils.clamp(controls.target.y, 1.5, 18);
      }

      // ── Animate Infrastructure Flow Streams ──
      // 1. Power Flow: Gen (-44, 4.5, -14) -> Hab (0, 4.5, 0) -> Lab (44, 4.5, -16) & Storage (44, 4.5, 42)
      for (let i = 0; i < powerFlowCount; i++) {
        const progress = (elapsed * 0.45 + i / powerFlowCount) % 1.0;
        let px, py = 4.3, pz;
        if (progress < 0.33) {
          const segT = progress * 3;
          px = THREE.MathUtils.lerp(-44, 0, segT);
          pz = THREE.MathUtils.lerp(-14, 0, segT);
        } else if (progress < 0.66) {
          const segT = (progress - 0.33) * 3;
          px = THREE.MathUtils.lerp(0, 44, segT);
          pz = THREE.MathUtils.lerp(0, -16, segT);
        } else {
          const segT = (progress - 0.66) * 3;
          px = THREE.MathUtils.lerp(0, 44, segT);
          pz = THREE.MathUtils.lerp(0, 42, segT);
        }
        powerPositions[i * 3] = px;
        powerPositions[i * 3 + 1] = py + Math.sin(elapsed * 4 + i) * 0.12;
        powerPositions[i * 3 + 2] = pz;
      }
      powerFlowGeo.setAttribute("position", new THREE.BufferAttribute(powerPositions, 3));
      powerFlowGeo.attributes.position.needsUpdate = true;

      // 2. Fuel Flow: Fuel (-46, 2.5, 28) -> Gen (-44, 2.5, -14)
      for (let i = 0; i < fuelFlowCount; i++) {
        const progress = (elapsed * 0.35 + i / fuelFlowCount) % 1.0;
        fuelPositions[i * 3] = THREE.MathUtils.lerp(-46, -44, progress);
        fuelPositions[i * 3 + 1] = 2.4;
        fuelPositions[i * 3 + 2] = THREE.MathUtils.lerp(28, -14, progress);
      }
      fuelFlowGeo.setAttribute("position", new THREE.BufferAttribute(fuelPositions, 3));
      fuelFlowGeo.attributes.position.needsUpdate = true;

      // 3. Comms Flow: Radome (-2, 5.2, -46) -> Hab (0, 5.2, 0) & Lab (44, 5.2, -16) & Storage (44, 5.2, 42)
      for (let i = 0; i < commsFlowCount; i++) {
        const progress = (elapsed * 0.8 + i / commsFlowCount) % 1.0;
        let cx, cy = 5.2, cz;
        if (i % 3 === 0) {
          cx = THREE.MathUtils.lerp(-2, 0, progress);
          cz = THREE.MathUtils.lerp(-46, 0, progress);
        } else if (i % 3 === 1) {
          cx = THREE.MathUtils.lerp(-2, 44, progress);
          cz = THREE.MathUtils.lerp(-46, -16, progress);
        } else {
          cx = THREE.MathUtils.lerp(0, 44, progress);
          cz = THREE.MathUtils.lerp(0, 42, progress);
        }
        commsPositions[i * 3] = cx;
        commsPositions[i * 3 + 1] = cy;
        commsPositions[i * 3 + 2] = cz;
      }
      commsFlowGeo.setAttribute("position", new THREE.BufferAttribute(commsPositions, 3));
      commsFlowGeo.attributes.position.needsUpdate = true;

      // ── Animate Atmospheric Snow ──
      const fPos = fallGeo.attributes.position.array;
      const fVel = dynamicElementsRef.current?.fallVelocities || fallVelocities;
      for (let i = 0; i < fallingCount; i++) {
        fPos[i * 3] += fVel[i * 3];
        fPos[i * 3 + 1] += fVel[i * 3 + 1];
        fPos[i * 3 + 2] += fVel[i * 3 + 2];

        if (fPos[i * 3 + 1] < 0) {
          fPos[i * 3 + 1] = 52;
          fPos[i * 3] = (Math.random() - 0.5) * 240;
          fPos[i * 3 + 2] = (Math.random() - 0.5) * 240;
        }
      }
      fallGeo.attributes.position.needsUpdate = true;

      const dPos = driftGeo.attributes.position.array;
      const dVel = dynamicElementsRef.current?.driftVelocities || driftVelocities;
      for (let i = 0; i < driftCount; i++) {
        dPos[i * 3] += dVel[i * 3];
        dPos[i * 3 + 2] += dVel[i * 3 + 2];

        if (Math.abs(dPos[i * 3]) > 110 || Math.abs(dPos[i * 3 + 2]) > 110) {
          dPos[i * 3] = (Math.random() - 0.5) * 160 - 40;
          dPos[i * 3 + 1] = 0.2 + Math.random() * 1.8;
          dPos[i * 3 + 2] = (Math.random() - 0.5) * 160 - 40;
        }
      }
      driftGeo.attributes.position.needsUpdate = true;

      // 1. Dual-Curtain Aurora Wave Displacements
      const aPos1 = auroraGeo1.attributes.position;
      for (let i = 0; i < aPos1.count; i++) {
        const u = aPos1.getX(i);
        const wave = Math.sin(u * 0.05 + elapsed * 0.8) * 3.8 + Math.cos(u * 0.1 + elapsed * 0.4) * 1.6;
        aPos1.setZ(i, wave);
      }
      auroraGeo1.computeVertexNormals();
      aPos1.needsUpdate = true;

      const aPos2 = auroraGeo2.attributes.position;
      for (let i = 0; i < aPos2.count; i++) {
        const u = aPos2.getX(i);
        const wave = Math.sin(u * 0.06 - elapsed * 0.65) * 3.0 + Math.cos(u * 0.12 + elapsed * 0.5) * 1.4;
        aPos2.setZ(i, wave);
      }
      auroraGeo2.computeVertexNormals();
      aPos2.needsUpdate = true;

      // 2. Twinkling Polar Stars Scintillation
      starMat.opacity = 0.72 + Math.sin(elapsed * 2.2) * 0.12;

      // 3. Autonomous Polar Supply Rover Dynamic Transfer Patrol
      const roverT = elapsed * 0.35;
      const rx = stoPos.x - 2 + Math.sin(roverT) * 8.5;
      const rz = stoPos.z + 10.5 + Math.cos(roverT * 2) * 1.5;
      const rdx = Math.cos(roverT) * 8.5;
      const rdz = -Math.sin(roverT * 2) * 3.0;
      roverGroup.position.set(rx, 0.45, rz);
      roverGroup.rotation.y = Math.atan2(rdx, rdz);
      lidarPuck.rotation.y = elapsed * 8.0;
      roverBeaconMat.color.setHex((elapsed * 4.0) % 1.0 > 0.5 ? 0xf59e0b : 0x451a03);

      // 4. Sequential Chasing Runway Guide LEDs along Logistics Lane
      guideLeds.forEach((led, idx) => {
        const phase = (elapsed * 5.0 - idx * 0.8) % (Math.PI * 2);
        const isBright = Math.sin(phase) > 0.3;
        led.material.color.setHex(isBright ? 0x00ffff : 0x0369a1);
      });

      // 5. Gantry Crane Hoist Cable & Suspended Container Sway
      hoistGroup.rotation.z = Math.sin(elapsed * 1.4) * 0.035;
      hoistGroup.position.y = 3.8 + Math.sin(elapsed * 0.9) * 0.12;

      // 6. Warning Beacons on Vehicles
      teleBeaconMat.color.setHex(((elapsed + 0.3) * 4.0) % 1.0 > 0.5 ? 0xf59e0b : 0x451a03);
      catBeaconMat.color.setHex(((elapsed + 0.6) * 4.0) % 1.0 > 0.5 ? 0xf59e0b : 0x451a03);

      anemometerGroup.rotation.y = elapsed * 5.0;
      dishGroup.rotation.y = Math.sin(elapsed * 0.35) * 0.25;

      // Obstacle Beacon Flash
      beaconBlinkTimer += delta;
      if (beaconBlinkTimer > 1.0) {
        beaconBlinkTimer = 0;
        beaconMat.color.setHex(beaconMat.color.getHex() === 0xff4757 ? 0x220508 : 0xff4757);
      }

      renderer.render(scene, camera);
    };

    animate();

    // ── Window Resize ──
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // ── Cleanup on Unmount ONLY ──
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      controls.dispose();
      renderer.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      fallGeo.dispose();
      fallMat.dispose();
      driftGeo.dispose();
      driftMat.dispose();
      powerFlowGeo.dispose();
      powerMat.dispose();
      fuelFlowGeo.dispose();
      fuelMat.dispose();
      commsFlowGeo.dispose();
      commsMat.dispose();
      auroraGeo1.dispose();
      auroraMat1.dispose();
      auroraGeo2.dispose();
      auroraMat2.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      dynamicElementsRef.current = null;
    };
  }, []); // Mounted strictly ONCE

  // ── 2. REACTIVE EFFECT: Weather & Telemetry Updates ──
  useEffect(() => {
    const elements = dynamicElementsRef.current;
    if (!elements) return;

    const isBlizzard = (weather?.windSpeedKmH ?? 0) >= 50 || (engine?.ambientTemp ?? -20) <= -40;
    const isWarning = (weather?.windSpeedKmH ?? 0) >= 35 || (engine?.ambientTemp ?? -20) <= -30;
    const isGenCrit = engine?.generatorStatus === "CRITICAL";
    const isColdRisk = (engine?.ambientTemp ?? -20) < -35;

    // Atmospheric Fog & Ambient Polar Sky Hues (Calibrated with Sky Dome)
    const fogColor = isBlizzard ? 0x071524 : isWarning ? 0x0a1f33 : 0x0e273d;
    elements.scene.fog.color.setHex(fogColor);
    elements.scene.fog.density = isBlizzard ? 0.011 : 0.0042;

    if (elements.skyMat) {
      elements.skyMat.uniforms.topColor.value.setHex(isBlizzard ? 0x051322 : 0x020b18);
      elements.skyMat.uniforms.midColor.value.setHex(isBlizzard ? 0x081c30 : 0x0c2540);
      elements.skyMat.uniforms.horizonColor.value.setHex(isBlizzard ? 0x0e2538 : 0x1a4a6e);
    }
    if (elements.starMat) {
      elements.starMat.opacity = isBlizzard ? 0.18 : 0.82;
    }

    elements.renderer.toneMappingExposure = isBlizzard ? 0.95 : 1.18;

    elements.sunLight.color.setHex(isBlizzard ? 0xbfdbfe : isWarning ? 0xffedd5 : 0xfff8ec);
    elements.sunLight.intensity = isBlizzard ? 1.6 : 2.6;
    elements.hemiLight.intensity = isBlizzard ? 0.6 : 0.95;
    elements.cyanRimLight.intensity = isBlizzard ? 2.4 : 2.0;

    // Generator Critical Alert State
    if (elements.genBody) {
      elements.genBody.material = isGenCrit ? elements.mats.genCrit : elements.mats.genHull;
    }
    if (elements.chimneyMesh0) {
      elements.chimneyMesh0.material = isGenCrit ? elements.mats.genCrit : elements.mats.towerSteel;
    }
    if (elements.tipMesh0) {
      elements.tipMesh0.material.color.setHex(isGenCrit ? 0xff4757 : 0xf59e0b);
    }
    if (elements.genLight) {
      elements.genLight.color.setHex(isGenCrit ? 0xff4757 : 0x52bfff);
      elements.genLight.intensity = isGenCrit ? 3.0 : 1.8;
    }

    // Storage Depot Status Beacon (Reacts to cold risk & heated door seal load)
    if (elements.stoStatusLight) {
      elements.stoStatusLight.color.setHex(isColdRisk ? 0xf59e0b : 0x2ed6a1);
      elements.stoStatusLight.intensity = isColdRisk ? 2.2 : 1.6;
    }

    // Dynamic Blizzard Wind Vector Physics
    const windAngle = ((weather?.windDirectionDeg ?? 210) * Math.PI) / 180;
    const windSpeedFactor = Math.max(0.4, (weather?.windSpeedKmH ?? 18) / 25);

    const fVels = elements.fallVelocities;
    for (let i = 0; i < elements.fallingCount; i++) {
      fVels[i * 3] = Math.sin(windAngle) * (1.2 + Math.random() * 1.5) * windSpeedFactor;
      fVels[i * 3 + 1] = -(0.55 + Math.random() * 0.8);
      fVels[i * 3 + 2] = Math.cos(windAngle) * (1.2 + Math.random() * 1.5) * windSpeedFactor;
    }
    elements.fallMat.size = isBlizzard ? 0.45 : 0.28;
    elements.fallMat.opacity = isBlizzard ? 0.55 : 0.32;
    elements.fallMat.color.setHex(isBlizzard ? 0xffffff : 0xd8ecf8);

    const dVels = elements.driftVelocities;
    for (let i = 0; i < elements.driftCount; i++) {
      dVels[i * 3] = Math.sin(windAngle) * (2.2 + Math.random() * 2.0) * windSpeedFactor;
      dVels[i * 3 + 2] = Math.cos(windAngle) * (2.2 + Math.random() * 2.0) * windSpeedFactor;
    }

    if (elements.auroraMesh1) {
      elements.auroraMesh1.material.opacity = isBlizzard ? 0.15 : 0.42;
    }
    if (elements.auroraMesh2) {
      elements.auroraMesh2.material.opacity = isBlizzard ? 0.10 : 0.32;
    }
  }, [weather, engine]);

  // ── Camera Preset Trigger ──
  const setCameraPreset = (presetKey) => {
    setActiveCamPreset(presetKey);
    const config = PRESET_CONFIGS[presetKey];
    if (config && flyToCameraRef.current) {
      flyToCameraRef.current(config.pos, config.target, config.duration, config.arc);
    }
  };

  // ── Smooth Zoom (+ / -) Tool Handler ──
  const handleZoomTool = (delta) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    cancelCameraFlight();

    const offset = camera.position.clone().sub(controls.target);
    const currentDist = offset.length();
    const nextDist = THREE.MathUtils.clamp(currentDist + delta, controls.minDistance, controls.maxDistance);
    offset.setLength(nextDist);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  };

  return (
    <div className="volumetric-3d-stage">
      <div ref={mountRef} className="three-canvas-container" />

      {/* 3D Camera Preset HUD Toolbar with Storage Depot Button */}
      <div className="three-camera-presets">
        <span className="three-preset-label">
          <Camera size={11} /> 3D CAMERA:
        </span>
        {[
          { id: "orbit", label: "ORBIT (DEFAULT)" },
          { id: "top", label: "ORTHO TOP" },
          { id: "habitat", label: "MAIN HABITAT" },
          { id: "generator", label: "GENERATOR BAY" },
          { id: "tower", label: "COMM RADOME" },
          { id: "storage", label: "STORAGE DEPOT" },
        ].map((cam) => (
          <button
            key={cam.id}
            className={`three-preset-btn ${activeCamPreset === cam.id ? "active" : ""}`}
            onClick={() => setCameraPreset(cam.id)}
            title={`Smooth cinematic flight to ${cam.label}`}
          >
            {cam.label}
          </button>
        ))}

        {/* Smooth Zoom & View Reset Tools */}
        <div className="three-preset-divider" />
        <button
          className="three-tool-btn"
          onClick={() => handleZoomTool(-14)}
          title="Smooth Zoom In (+)"
        >
          <Plus size={11} />
        </button>
        <button
          className="three-tool-btn"
          onClick={() => handleZoomTool(14)}
          title="Smooth Zoom Out (-)"
        >
          <Minus size={11} />
        </button>
        <button
          className="three-tool-btn"
          onClick={() => setCameraPreset("orbit")}
          title="Reset Camera to Orbit Overview"
        >
          <Maximize2 size={11} />
        </button>
      </div>

      {/* Interactive 3D Orbit Legend */}
      <div className="three-interaction-hint">
        <Rotate3D size={12} className="cyan-icon" />
        <span>DRAG TO ORBIT 360° · RIGHT-CLICK TO PAN · SCROLL TO ZOOM · CLICK ANY BUILDING FOR TELEMETRY</span>
      </div>
    </div>
  );
}
