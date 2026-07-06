import { useEffect, useRef } from 'react';
import * as THREE from 'three';

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
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
    camera.position.set(0, 1.9, 7);
    camera.lookAt(0, .55, 0);
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
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(highlight, '#090810', 2.2));
    const keyLight = new THREE.DirectionalLight('#ffffff', 3.2);
    keyLight.position.set(-3, 6, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(secondary, 4, 12);
    rimLight.position.set(4, 2, 3);
    scene.add(rimLight);

    const geometry = geometryFor(sides);
    const material = new THREE.MeshStandardMaterial({ color: primary, roughness: .36, metalness: .12, flatShading: true });
    const die = new THREE.Mesh(geometry, material);
    die.castShadow = true;
    die.receiveShadow = true;
    scene.add(die);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 22), new THREE.LineBasicMaterial({ color: highlight, transparent: true, opacity: .75 }));
    die.add(edges);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.35, 64), new THREE.ShadowMaterial({ color: '#000000', opacity: .32 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.03;
    floor.receiveShadow = true;
    scene.add(floor);

    const numberSprite = resultSprite(result, secondary);
    numberSprite.visible = false;
    numberSprite.scale.set(1.18, 1.18, 1);
    scene.add(numberSprite);
    const dLabel = resultSprite(`d${sides}`, highlight, true);
    dLabel.scale.set(.78, .32, 1);
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

    const start = performance.now();
    const duration = reducedMotion ? 20 : 1450;
    let frame = 0;
    let notified = false;
    function animate(now) {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const fall = Math.min(1, t / .68);
      const bounceT = Math.max(0, (t - .68) / .32);
      die.position.x = -1.35 + ease * 1.35;
      die.position.y = 3.2 * Math.pow(1 - fall, 2) + (bounceT ? Math.abs(Math.sin(bounceT * Math.PI * 2.5)) * .55 * (1 - bounceT) : 0);
      die.rotation.x = (1 - ease) * Math.PI * (6 + (result % 3)) + .22;
      die.rotation.y = (1 - ease) * Math.PI * (5 + (result % 4)) - .28;
      die.rotation.z = (1 - ease) * Math.PI * 3 + .08;
      const settled = t > .84;
      numberSprite.visible = settled;
      numberSprite.material.opacity = Math.min(1, (t - .84) / .12);
      numberSprite.position.set(die.position.x, die.position.y + .04, 1.18);
      dLabel.position.set(0, -1.48, .05);
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
      edges.material.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      numberSprite.material.map?.dispose();
      numberSprite.material.dispose();
      dLabel.material.map?.dispose();
      dLabel.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [sides, result]);

  return <div ref={hostRef} className="diceStage" aria-label={`Dado d${sides} rolando; resultado ${result}`} />;
}

function geometryFor(sides) {
  if (sides === 4) return new THREE.TetrahedronGeometry(1.25);
  if (sides === 6) return new THREE.BoxGeometry(1.65, 1.65, 1.65, 1, 1, 1);
  if (sides === 8) return new THREE.OctahedronGeometry(1.25);
  if (sides === 10) return new THREE.CylinderGeometry(.95, .95, 1.55, 10, 1, false);
  if (sides === 12) return new THREE.DodecahedronGeometry(1.18);
  if (sides === 20) return new THREE.IcosahedronGeometry(1.22);
  return new THREE.IcosahedronGeometry(1.18, 2);
}

function resultSprite(value, color, compact = false) {
  const canvas = document.createElement('canvas');
  canvas.width = compact ? 320 : 256;
  canvas.height = compact ? 128 : 256;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!compact) {
    context.fillStyle = 'rgba(10, 9, 16, .86)';
    context.beginPath();
    context.arc(128, 128, 90, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 8;
    context.stroke();
  }
  context.fillStyle = compact ? color : '#ffffff';
  context.font = `800 ${compact ? 68 : String(value).length > 2 ? 92 : 118}px system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(value), canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, opacity: compact ? .9 : 0 });
  return new THREE.Sprite(material);
}
