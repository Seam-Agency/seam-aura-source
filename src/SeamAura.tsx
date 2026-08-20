import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  clamp,
  clampDpr,
  DEFAULT_AURA_PALETTE,
  DEFAULT_PULSE_ANGLE,
  pulseOriginFromAngle,
  resolveEdgeWidth,
  sineIn,
} from "./aura-math";
import type {
  AuraMode,
  AuraPalette,
  NormalizedPoint,
  SeamAuraProps,
} from "./types";
import { createAuraRenderer, type AuraRenderer } from "./webgl";
import "./SeamAura.css";

type RendererStatus = "fallback" | "webgl";

interface RuntimeOptions {
  active: boolean;
  intensity: number;
  edgeWidth: number;
  speed: number;
  pulseKey: string | number | undefined;
  pulseOrigin: NormalizedPoint;
  pulseDuration: number;
  source: TexImageSource | null;
  flipSourceY: boolean;
  maxDpr: number;
  mode: AuraMode;
  paused: boolean;
  respectReducedMotion: boolean;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function SeamAura({
  children,
  active = true,
  intensity = 1,
  edgeWidth = 50,
  colors = DEFAULT_AURA_PALETTE,
  speed = 1,
  pulseKey,
  pulseAngle = DEFAULT_PULSE_ANGLE,
  pulseOrigin,
  pulseDuration = 2,
  source = null,
  flipSourceY = true,
  maxDpr = 2,
  mode = "absolute",
  paused = false,
  respectReducedMotion = true,
  className,
  contentClassName,
  canvasClassName,
  canvasStyle,
  style,
  ...rest
}: SeamAuraProps) {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<AuraRenderer | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);
  const initialColorsRef = useRef(colors);
  const [rendererStatus, setRendererStatus] =
    useState<RendererStatus>("fallback");
  const resolvedPulseOrigin = pulseOrigin ?? pulseOriginFromAngle(pulseAngle);

  const stableColors = useMemo(
    () => [...colors] as AuraPalette,
    [colors[0], colors[1], colors[2], colors[3]],
  );

  const runtimeRef = useRef<RuntimeOptions>({
    active,
    intensity,
    edgeWidth,
    speed,
    pulseKey,
    pulseOrigin: resolvedPulseOrigin,
    pulseDuration,
    source,
    flipSourceY,
    maxDpr,
    mode,
    paused,
    respectReducedMotion,
  });

  runtimeRef.current = {
    active,
    intensity: clamp(intensity, 0, 3),
    edgeWidth,
    speed: clamp(speed, -4, 4),
    pulseKey,
    pulseOrigin: [
      clamp(resolvedPulseOrigin[0], -0.5, 1.5),
      clamp(resolvedPulseOrigin[1], -0.5, 1.5),
    ],
    pulseDuration: clamp(pulseDuration, 0.1, 10),
    source,
    flipSourceY,
    maxDpr: clampDpr(maxDpr),
    mode,
    paused,
    respectReducedMotion,
  };

  useEffect(() => {
    rendererRef.current?.setColors(stableColors);
    requestRenderRef.current?.();
  }, [stableColors]);

  useEffect(() => {
    requestRenderRef.current?.();
  }, [
    active,
    edgeWidth,
    flipSourceY,
    intensity,
    maxDpr,
    mode,
    paused,
    pulseDuration,
    pulseKey,
    resolvedPulseOrigin[0],
    resolvedPulseOrigin[1],
    respectReducedMotion,
    source,
    speed,
  ]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    let renderer: AuraRenderer | null = null;
    let animationFrame: number | null = null;
    let lastFrameTime = window.performance.now();
    let effectTime = 0;
    let activation = runtimeRef.current.active ? 1 : 0;
    let pulse = 0;
    let previousPulseKey = runtimeRef.current.pulseKey;
    let previousPulseOrigin: NormalizedPoint = [
      runtimeRef.current.pulseOrigin[0],
      runtimeRef.current.pulseOrigin[1],
    ];
    let wasActive = runtimeRef.current.active;
    let isIntersecting = true;
    let isDocumentVisible = document.visibilityState !== "hidden";
    let reducedMotion = false;
    let width = 0;
    let height = 0;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function startLoop() {
      if (
        animationFrame === null &&
        renderer &&
        isIntersecting &&
        isDocumentVisible
      ) {
        lastFrameTime = window.performance.now();
        animationFrame = window.requestAnimationFrame(renderFrame);
      }
    }

    const syncMotionPreference = () => {
      reducedMotion = motionQuery.matches;
      startLoop();
    };

    const measure = () => {
      if (runtimeRef.current.mode === "fixed") {
        width = window.innerWidth;
        height = window.innerHeight;
      } else {
        const bounds = root.getBoundingClientRect();
        width = bounds.width;
        height = bounds.height;
      }
      startLoop();
    };

    const initialiseRenderer = () => {
      try {
        renderer?.dispose();
        renderer = createAuraRenderer(canvas, initialColorsRef.current);
        rendererRef.current = renderer;
        setRendererStatus(renderer ? "webgl" : "fallback");
        startLoop();
      } catch {
        renderer = null;
        rendererRef.current = null;
        setRendererStatus("fallback");
      }
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      renderer = null;
      rendererRef.current = null;
      setRendererStatus("fallback");
    };

    const onContextRestored = () => initialiseRenderer();

    const onVisibilityChange = () => {
      isDocumentVisible = document.visibilityState !== "hidden";
      if (!isDocumentVisible && animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      } else {
        startLoop();
      }
    };

    function renderFrame(now: number) {
      animationFrame = null;
      if (!renderer || !isIntersecting || !isDocumentVisible) return;

      const delta = Math.min(0.1, Math.max(0, (now - lastFrameTime) / 1000));
      lastFrameTime = now;
      const options = runtimeRef.current;
      const shouldReduceMotion = options.respectReducedMotion && reducedMotion;

      const pulseOriginChanged =
        previousPulseOrigin[0] !== options.pulseOrigin[0] ||
        previousPulseOrigin[1] !== options.pulseOrigin[1];
      if (
        previousPulseKey !== options.pulseKey ||
        pulseOriginChanged ||
        (!wasActive && options.active)
      ) {
        pulse = 0;
        previousPulseKey = options.pulseKey;
        previousPulseOrigin = [
          options.pulseOrigin[0],
          options.pulseOrigin[1],
        ];
      }
      wasActive = options.active;

      if (shouldReduceMotion) {
        pulse = 1;
        activation = options.active ? 1 : 0;
      } else if (!options.paused) {
        effectTime += delta;
        pulse = clamp(pulse + delta / options.pulseDuration, 0, 1);
        const target = options.active ? 1 : 0;
        activation += (target - activation) * (1 - Math.exp(-delta * 12));
      }

      const dpr = Math.min(
        options.maxDpr,
        Math.max(0.5, window.devicePixelRatio || 1),
      );
      const amount = sineIn(activation) * options.intensity;

      renderer.draw({
        width,
        height,
        dpr,
        time: shouldReduceMotion ? 0.18 : effectTime,
        amount,
        edgeWidth: resolveEdgeWidth(
          options.edgeWidth,
          width,
          height,
          options.mode === "container" ? 0.3 : 0.1,
        ),
        pulse: shouldReduceMotion ? 1 : pulse,
        pulseOrigin: options.pulseOrigin,
        speed: shouldReduceMotion ? 0 : options.speed,
        source: options.source,
        flipSourceY: options.flipSourceY,
      });

      const target = options.active ? 1 : 0;
      const activationIsMoving = Math.abs(target - activation) > 0.001;
      const ambientIsMoving = options.active && Math.abs(options.speed) > 0.001;
      const pulseIsMoving = options.active && pulse < 1;

      if (
        !shouldReduceMotion &&
        !options.paused &&
        (activationIsMoving || ambientIsMoving || pulseIsMoving)
      ) {
        startLoop();
      }
    }

    syncMotionPreference();
    measure();
    initialiseRenderer();
    requestRenderRef.current = startLoop;

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    resizeObserver?.observe(root);
    const intersectionObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            isIntersecting = entry?.isIntersecting ?? true;
            if (!isIntersecting && animationFrame !== null) {
              window.cancelAnimationFrame(animationFrame);
              animationFrame = null;
            } else {
              startLoop();
            }
          });
    intersectionObserver?.observe(root);

    motionQuery.addEventListener("change", syncMotionPreference);
    window.addEventListener("resize", measure, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      motionQuery.removeEventListener("change", syncMotionPreference);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      renderer?.dispose();
      rendererRef.current = null;
      requestRenderRef.current = null;
    };
  }, []);

  const spinDuration = `${1.256637 / Math.max(0.05, Math.abs(speed))}s`;
  const rootStyle = {
    ...style,
    "--seam-aura-active": active ? 1 : 0,
    "--seam-aura-width": `${Math.max(1, edgeWidth)}px`,
    "--seam-aura-color-0": stableColors[0],
    "--seam-aura-color-1": stableColors[1],
    "--seam-aura-color-2": stableColors[2],
    "--seam-aura-color-3": stableColors[3],
    "--seam-aura-spin-duration": spinDuration,
  } as CSSProperties;

  const Root = mode === "container" ? "span" : "div";

  return (
    <Root
      {...rest}
      ref={(node) => {
        rootRef.current = node;
      }}
      className={joinClassNames(
        "seam-aura",
        mode === "fixed" && "seam-aura--fixed",
        mode === "container" && "seam-aura--container",
        className,
      )}
      data-active={active ? "true" : "false"}
      data-paused={paused ? "true" : "false"}
      data-renderer={rendererStatus}
      data-source={source ? "true" : "false"}
      style={rootStyle}
    >
      {mode !== "container" && (
        <div className={joinClassNames("seam-aura__content", contentClassName)}>
          {children}
        </div>
      )}
      <div className="seam-aura__fallback" aria-hidden="true">
        <div className="seam-aura__fallback-border" />
      </div>
      <canvas
        ref={canvasRef}
        className={joinClassNames("seam-aura__canvas", canvasClassName)}
        style={canvasStyle}
        aria-hidden="true"
      />
    </Root>
  );
}
