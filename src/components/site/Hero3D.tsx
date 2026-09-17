"use client";

import { useEffect, useRef, useState } from "react";

type Props = { imageUrl: string; alt: string };

/**
 * Lightweight WebGL hero: a floating plated dish built from an optimised texture
 * and low-poly geometry. Falls back to a static premium image when WebGL is
 * unavailable, on low-powered devices, or when the user prefers reduced motion.
 */
export function Hero3D({ imageUrl, alt }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower =
      (navigator.hardwareConcurrency ?? 4) <= 4 ||
      /Android|iPhone|iPod|iPad/i.test(navigator.userAgent) ||
      window.innerWidth < 900;
    if (reduceMotion || lowPower) {
      setSkipped(true);
      return;
    }

    let disposed = false;
    let frame = 0;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        const THREE = await import("three");
        const probe = document.createElement("canvas");
        const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
        if (!gl) {
          setSkipped(true);
          return;
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(0, 0.2, 6.2);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
        mount.appendChild(renderer.domElement);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.setAttribute("aria-hidden", "true");

        const group = new THREE.Group();
        scene.add(group);

        const loader = new THREE.TextureLoader();
        const texture = await loader.loadAsync(imageUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 2;

        const dish = new THREE.Mesh(
          new THREE.CircleGeometry(1.75, 64),
          new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
        );
        dish.position.y = 0.06;
        group.add(dish);

        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(1.79, 0.085, 20, 96),
          new THREE.MeshStandardMaterial({ color: 0xe0b264, metalness: 0.65, roughness: 0.32 }),
        );
        group.add(rim);

        const base = new THREE.Mesh(
          new THREE.CircleGeometry(1.62, 64),
          new THREE.MeshStandardMaterial({ color: 0x241811, metalness: 0.2, roughness: 0.7 }),
        );
        base.position.z = -0.03;
        group.add(base);

        const garnishColors = [0xd9673a, 0x3f5b46, 0xe0b264, 0xf2e7d7];
        const garnishes = garnishColors.map((color, index) => {
          const mesh = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.09 + index * 0.012, 0),
            new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.15 }),
          );
          const angle = (index / garnishColors.length) * Math.PI * 2;
          mesh.position.set(Math.cos(angle) * 2.35, Math.sin(angle) * 1.35 + 0.2, 0.4 + index * 0.1);
          mesh.userData.speed = 0.35 + index * 0.12;
          group.add(mesh);
          return mesh;
        });

        scene.add(new THREE.AmbientLight(0xffffff, 1.1));
        const key = new THREE.DirectionalLight(0xffd9a8, 2.1);
        key.position.set(2.6, 3.2, 4.4);
        scene.add(key);
        const fill = new THREE.PointLight(0xd9673a, 12, 12);
        fill.position.set(-3.2, -1.8, 2.6);
        scene.add(fill);

        let pointerX = 0;
        let pointerY = 0;
        const onPointerMove = (event: PointerEvent) => {
          const rect = mount.getBoundingClientRect();
          pointerX = (event.clientX - rect.left) / rect.width - 0.5;
          pointerY = (event.clientY - rect.top) / rect.height - 0.5;
        };
        window.addEventListener("pointermove", onPointerMove, { passive: true });

        const resize = () => {
          const rect = mount.getBoundingClientRect();
          const width = Math.max(rect.width, 320);
          const height = Math.max(rect.height, 320);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resize();
        window.addEventListener("resize", resize);

        const clock = new THREE.Clock();
        const render = () => {
          if (disposed) return;
          const t = clock.getElapsedTime();
          group.rotation.y += (pointerX * 0.5 + Math.sin(t * 0.25) * 0.08 - group.rotation.y) * 0.05;
          group.rotation.x += (-pointerY * 0.32 - group.rotation.x) * 0.05;
          group.position.y = Math.sin(t * 0.8) * 0.11;
          garnishes.forEach((mesh) => {
            mesh.rotation.x = t * mesh.userData.speed;
            mesh.rotation.y = t * mesh.userData.speed * 0.7;
            mesh.position.z = 0.4 + Math.sin(t * 0.9 + mesh.position.x) * 0.18;
          });
          renderer.render(scene, camera);
          frame = requestAnimationFrame(render);
        };
        render();
        setLive(true);

        cleanup = () => {
          cancelAnimationFrame(frame);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("resize", resize);
          renderer.dispose();
          texture.dispose();
          if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        };
      } catch {
        setSkipped(true);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [imageUrl]);

  return (
    <div className="relative mx-auto h-[300px] w-full max-w-[420px] sm:h-[380px] lg:h-[460px] lg:max-w-[520px]">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(224,178,100,0.28),transparent_62%)] blur-2xl" />
      <div ref={mountRef} className="absolute inset-0" />
      {!live ? (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Static fallback keeps the hero premium without WebGL */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            className="animate-floaty h-full w-full rounded-full object-cover shadow-[0_40px_80px_-40px_rgba(0,0,0,0.85)]"
            loading="eager"
          />
          {skipped ? null : <span className="absolute h-full w-full rounded-full border border-gold/30" />}
        </div>
      ) : null}
    </div>
  );
}
