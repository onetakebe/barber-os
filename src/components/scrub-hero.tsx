"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Hero cujo "vídeo" avança conforme a página rola. A seção é mais alta que a
 * tela; um palco fixo (sticky) ocupa a viewport e o progresso do scroll dentro
 * da seção escolhe qual frame desenhar num canvas.
 *
 * É uma sequência de imagens, não um <video>: elemento de vídeo depende de
 * política de autoplay, de download sob demanda e de seek — cada navegador
 * falha de um jeito (Safari não baixa sem play, iOS em baixa energia recusa
 * play, seek em andamento não pinta). Frames pré-carregados desenham sempre.
 *
 * Os dois frames nítidos (início e fim) ficam por cima do canvas nas
 * extremidades: parado no topo ou no fim, o visitante vê a foto. Sem JS fica o
 * primeiro; com "reduzir movimento", o último.
 */
export function ScrubHero({
  frameCount,
  frameDir,
  frameStart,
  frameEnd,
  alt,
  children,
}: {
  frameCount: number;
  /** Pasta com `frame-001.webp` … `frame-NNN.webp`. String, não função: a página é
      Server Component e só passa valores serializáveis para cá. */
  frameDir: string;
  frameStart: string;
  frameEnd: string;
  alt: string;
  children: ReactNode;
}) {
  const trackRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const canvas = canvasRef.current;
    if (!track || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      track.dataset.stage = "end";
      track.style.setProperty("--scrub", "1");
      return;
    }

    const frames: (HTMLImageElement | null)[] = Array.from(
      { length: frameCount },
      () => null,
    );
    let target = 0;
    let current = 0;
    let drawn = -1;
    let raf = 0;
    let disposed = false;

    // Frame mais próximo já carregado, para nunca desenhar um buraco enquanto o
    // resto da sequência chega.
    const nearestLoaded = (index: number) => {
      for (let offset = 0; offset < frameCount; offset++) {
        if (frames[index - offset]) return index - offset;
        if (frames[index + offset]) return index + offset;
      }
      return -1;
    };

    // Equivalente a object-fit: cover com object-position 68% 50%.
    const draw = (index: number) => {
      const image = frames[index];
      if (!image) return;
      const { width, height } = canvas;
      const scale = Math.max(
        width / image.naturalWidth,
        height / image.naturalHeight,
      );
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const x = (width - drawWidth) * 0.68;
      const y = (height - drawHeight) * 0.5;
      ctx.drawImage(image, x, y, drawWidth, drawHeight);
      drawn = index;
    };

    const render = () => {
      const index = nearestLoaded(Math.round(current * (frameCount - 1)));
      if (index >= 0 && index !== drawn) draw(index);
    };

    const tick = () => {
      raf = 0;
      current += (target - current) * 0.2;
      if (Math.abs(target - current) < 0.0015) current = target;
      render();
      if (current !== target) raf = requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const stage = () => {
      if (target < 0.015) return "start";
      if (target > 0.985) return "end";
      return drawn >= 0 ? "mid" : target < 0.5 ? "start" : "end";
    };

    const update = () => {
      const rect = track.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      target =
        scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
      track.style.setProperty("--scrub", target.toFixed(4));
      track.dataset.stage = stage();
      schedule();
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      drawn = -1;
      update();
    };

    // Carrega em ordem: o começo é o que o visitante vê primeiro.
    const load = (index: number) => {
      if (index >= frameCount || disposed) return;
      const image = new window.Image();
      image.decoding = "async";
      image.onload = () => {
        if (disposed) return;
        frames[index] = image;
        if (index === 0 || drawn < 0) resize();
        else schedule();
        load(index + 1);
      };
      image.onerror = () => load(index + 1);
      image.src = `${frameDir}/frame-${String(index + 1).padStart(3, "0")}.webp`;
    };

    resize();
    load(0);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", resize);
    };
  }, [frameCount, frameDir]);

  return (
    <section
      ref={trackRef}
      data-stage="start"
      className="scrub-hero relative h-[190svh] lg:h-[240vh]"
    >
      <div className="sticky top-0 h-svh overflow-hidden bg-surface-base">
        {/* `.image-grain` fixa position: relative, então o inset-0 fica no pai. */}
        <div className="absolute inset-0">
          <div className="image-grain size-full">
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className="absolute inset-0 size-full"
            />
            <Image
              src={frameStart}
              alt={alt}
              fill
              priority
              sizes="100vw"
              className="scrub-hero__frame scrub-hero__frame--start object-cover object-[68%_center]"
            />
            <Image
              src={frameEnd}
              alt=""
              fill
              loading="eager"
              sizes="100vw"
              className="scrub-hero__frame scrub-hero__frame--end object-cover object-[68%_center]"
            />
          </div>
        </div>

        {/* Véu para o texto: escurece a base e a esquerda, onde a copy senta, e
            deixa o rosto (à direita, no alto) respirar. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[3] bg-gradient-to-t from-surface-base via-surface-base/55 via-45% to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[3] bg-gradient-to-r from-surface-base/70 via-surface-base/15 via-45% to-transparent"
        />

        <div className="relative z-[4] mx-auto flex h-full max-w-[1500px] flex-col justify-end px-5 pb-14 pt-24 sm:pb-16 lg:px-10 lg:pb-20">
          {children}
        </div>

        {/* Régua do avanço: uma hairline que preenche conforme o vídeo anda. */}
        <div
          aria-hidden="true"
          className="absolute bottom-14 right-5 top-24 z-[4] hidden w-px bg-white/15 sm:bottom-16 lg:right-10 lg:bottom-20 lg:block"
        >
          <div className="scrub-hero__progress absolute inset-x-0 top-0 bg-white" />
        </div>
      </div>
    </section>
  );
}
