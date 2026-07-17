import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const LABEL_FORWARD = new THREE.Vector3(0, 0, -1);

export default function ThreeDice({ sides, result, onSettled }) {
  const hostRef = useRef(null);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !result) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue('--accent').trim() || '#655ca3';
    const highlight = styles.getPropertyValue('--primary-700').trim() || '#a39dc8';
    const secondary = styles.getPropertyValue('--gold').trim() || '#a7b57d';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
    camera.position.set(0, 3.8, 7.1);
    camera.lookAt(0, .15, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(highlight, '#090810', 2.25));
    const keyLight = new THREE.DirectionalLight('#ffffff', 3.5);
    keyLight.position.set(-3.5, 7, 4.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(secondary, 5, 14);
    rimLight.position.set(4, 2.5, 3.5);
    scene.add(rimLight);

    const geometry = geometryFor(sides);
    const material = new THREE.MeshStandardMaterial({
      color: primary,
      roughness: .3,
      metalness: .16,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    const die = new THREE.Group();
    const body = new THREE.Mesh(geometry, material);
    body.castShadow = true;
    body.receiveShadow = true;
    die.add(body);
    scene.add(die);

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: highlight,
      transparent: true,
      opacity: .78,
    });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 18), edgeMaterial);
    body.add(edges);

    const faces = logicalFaces(geometry);
    const selectedIndex = (Math.max(1, result) - 1) % faces.length;
    const labelResources = [];
    let selectedFace = null;
    faces.forEach((face, index) => {
      const offset = (index - selectedIndex + faces.length) % faces.length;
      const value = ((result - 1 + offset) % sides) + 1;
      const selected = index === selectedIndex;
      const label = faceLabel(value, face, selected, { secondary, highlight });
      die.add(label.mesh);
      labelResources.push(label);
      if (selected) selectedFace = { ...face, labelUp: label.up };
    });

    const targetQuaternion = settledQuaternion(selectedFace);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.55, 64),
      new THREE.ShadowMaterial({ color: '#000000', opacity: .38 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.3;
    floor.receiveShadow = true;
    scene.add(floor);

    const landingHalo = new THREE.Mesh(
      new THREE.RingGeometry(1.35, 1.72, 64),
      new THREE.MeshBasicMaterial({ color: secondary, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    landingHalo.rotation.x = -Math.PI / 2;
    landingHalo.position.y = -1.285;
    scene.add(landingHalo);

    const dLabel = resultSprite(`d${sides}`, highlight);
    dLabel.scale.set(.82, .33, 1);
    dLabel.position.set(0, -1.62, .05);
    scene.add(dLabel);

    function resize() {
      const width = Math.max(host.clientWidth, 260);
      const height = Math.max(host.clientHeight, 220);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const startQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      .7 + result * .17,
      -1.1 + result * .11,
      .4 + result * .07,
      'XYZ',
    ));
    const spinAtLanding = spinQuaternion(startQuaternion, result, .7);
    const start = performance.now();
    const duration = reducedMotion ? 30 : 1750;
    let frame = 0;
    let notified = false;

    function animate(now) {
      const t = Math.min(1, (now - start) / duration);
      const fallT = Math.min(1, t / .7);
      const fallEase = fallT * fallT;
      const landingT = Math.max(0, (t - .7) / .3);
      const settleEase = landingT * landingT * (3 - 2 * landingT);

      die.position.x = -1.65 * Math.pow(1 - fallT, 2);
      die.position.z = .42 * Math.sin(fallT * Math.PI) * (1 - fallT);
      die.position.y = 3.45 * (1 - fallEase);
      if (landingT > 0) {
        die.position.y += Math.abs(Math.sin(landingT * Math.PI * 2.45)) * .48 * (1 - landingT);
        die.quaternion.slerpQuaternions(spinAtLanding, targetQuaternion, settleEase);
      } else {
        die.quaternion.copy(spinQuaternion(startQuaternion, result, fallT));
      }

      landingHalo.material.opacity = landingT > 0
        ? Math.sin(Math.min(1, landingT * 1.6) * Math.PI) * .32 * (1 - landingT)
        : 0;
      landingHalo.scale.setScalar(.75 + landingT * .45);
      renderer.render(scene, camera);

      if (t < 1) frame = requestAnimationFrame(animate);
      else if (!notified) {
        notified = true;
        settledRef.current?.();
      }
    }
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      edges.geometry.dispose();
      edgeMaterial.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      landingHalo.geometry.dispose();
      landingHalo.material.dispose();
      labelResources.forEach(({ geometry: labelGeometry, material: labelMaterial, texture }) => {
        labelGeometry.dispose();
        texture.dispose();
        labelMaterial.dispose();
      });
      dLabel.material.map?.dispose();
      dLabel.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [sides, result]);

  return <div ref={hostRef} className="diceStage" role="img" aria-label={`Dado d${sides} rolando e pousando com o número ${result} para cima`} />;
}

function spinQuaternion(start, result, progress) {
  const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    progress * Math.PI * (7 + result % 3),
    progress * Math.PI * (9 + result % 4),
    progress * Math.PI * (5 + result % 2),
    'XYZ',
  ));
  return spin.multiply(start);
}

function settledQuaternion(face) {
  if (!face) return new THREE.Quaternion();
  const align = new THREE.Quaternion().setFromUnitVectors(face.normal, UP);
  const alignedLabelUp = face.labelUp.clone().applyQuaternion(align).projectOnPlane(UP).normalize();
  const angle = Math.atan2(
    UP.dot(alignedLabelUp.clone().cross(LABEL_FORWARD)),
    alignedLabelUp.dot(LABEL_FORWARD),
  );
  const twist = new THREE.Quaternion().setFromAxisAngle(UP, angle);
  return twist.multiply(align).normalize();
}

function geometryFor(sides) {
  if (sides === 4) return new THREE.TetrahedronGeometry(1.28);
  if (sides === 6) return new THREE.BoxGeometry(1.75, 1.75, 1.75);
  if (sides === 8) return new THREE.OctahedronGeometry(1.28);
  if (sides === 10) return pentagonalBipyramidGeometry(1.28);
  if (sides === 12) return new THREE.DodecahedronGeometry(1.22);
  if (sides === 20) return new THREE.IcosahedronGeometry(1.25);
  return new THREE.IcosahedronGeometry(1.25, 1);
}

function pentagonalBipyramidGeometry(radius) {
  const vertices = [0, radius, 0, 0, -radius, 0];
  const ringRadius = radius * 1.02;
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
    vertices.push(Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius);
  }
  const triangles = [];
  for (let index = 0; index < 5; index += 1) {
    const current = 2 + index;
    const next = 2 + (index + 1) % 5;
    triangles.push(0, next, current, 1, current, next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  return geometry;
}

function logicalFaces(geometry) {
  const positions = geometry.getAttribute('position');
  const indices = geometry.index;
  const triangleCount = indices ? indices.count / 3 : positions.count / 3;
  const groups = [];

  function vertexAt(triangle, corner) {
    const offset = triangle * 3 + corner;
    return new THREE.Vector3().fromBufferAttribute(positions, indices ? indices.getX(offset) : offset);
  }

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const a = vertexAt(triangle, 0);
    const b = vertexAt(triangle, 1);
    const c = vertexAt(triangle, 2);
    const center = a.clone().add(b).add(c).divideScalar(3);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (normal.dot(center) < 0) normal.negate();
    const distance = normal.dot(center);
    let group = groups.find((candidate) => candidate.normal.dot(normal) > .999 && Math.abs(candidate.distance - distance) < .025);
    if (!group) {
      group = { normal, distance, vertices: [] };
      groups.push(group);
    }
    [a, b, c].forEach((vertex) => {
      if (!group.vertices.some((existing) => existing.distanceToSquared(vertex) < .00001)) group.vertices.push(vertex);
    });
  }

  return groups.map((group) => {
    const center = group.vertices.reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3()).divideScalar(group.vertices.length);
    const radius = Math.min(...group.vertices.map((vertex) => vertex.distanceTo(center)));
    return { normal: group.normal.clone(), center, radius };
  });
}

function faceLabel(value, face, selected, colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 256, 256);
  context.fillStyle = selected ? 'rgba(10, 9, 16, .92)' : 'rgba(10, 9, 16, .55)';
  context.beginPath();
  context.arc(128, 128, selected ? 89 : 75, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = selected ? colors.secondary : colors.highlight;
  context.lineWidth = selected ? 9 : 5;
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = `900 ${String(value).length > 2 ? 80 : String(value).length > 1 ? 104 : 122}px system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(value), 128, 132);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const size = Math.max(.28, face.radius * (selected ? 1.08 : .88));
  const geometry = new THREE.PlaneGeometry(size, size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(face.center).addScaledVector(face.normal, .022);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion).normalize();
  return { mesh, geometry, material, texture, up };
}

function resultSprite(value, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.font = '800 68px system-ui';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(value), canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, opacity: .9 }));
}
