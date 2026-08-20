import blueNoiseUrl from "./assets/blue-noise.png?inline";
import { colorToLinearRgb } from "./aura-math";
import { fragmentShaderSource, vertexShaderSource } from "./shader";
import type { AuraPalette, NormalizedPoint } from "./types";

export interface AuraRenderFrame {
  width: number;
  height: number;
  dpr: number;
  time: number;
  amount: number;
  edgeWidth: number;
  pulse: number;
  pulseOrigin: NormalizedPoint;
  speed: number;
  source: TexImageSource | null;
  flipSourceY: boolean;
}

export interface AuraRenderer {
  draw(frame: AuraRenderFrame): void;
  setColors(colors: AuraPalette): void;
  dispose(): void;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate a WebGL shader.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource,
  );
  const program = gl.createProgram();

  if (!program) throw new Error("Unable to allocate a WebGL program.");

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown link error";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function requireUniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (location === null) throw new Error(`Missing shader uniform: ${name}`);
  return location;
}

function requireTexture(gl: WebGLRenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Unable to allocate a WebGL texture.");
  return texture;
}

function initialiseTexture(
  gl: WebGLRenderingContext,
  texture: WebGLTexture,
  unit: number,
  pixel: Uint8Array,
  filter: number,
  wrap: number,
): void {
  gl.activeTexture(unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixel,
  );
}

export function createAuraRenderer(
  canvas: HTMLCanvasElement,
  initialColors: AuraPalette,
): AuraRenderer | null {
  const context = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });

  if (!context) return null;
  const gl: WebGLRenderingContext = context;
  const program = createProgram(gl);
  const buffer = gl.createBuffer();
  const sourceTexture = requireTexture(gl);
  const blueNoiseTexture = requireTexture(gl);

  if (!buffer) {
    gl.deleteTexture(sourceTexture);
    gl.deleteTexture(blueNoiseTexture);
    gl.deleteProgram(program);
    throw new Error("Unable to allocate a WebGL vertex buffer.");
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  initialiseTexture(
    gl,
    sourceTexture,
    gl.TEXTURE0,
    new Uint8Array([0, 0, 0, 0]),
    gl.LINEAR,
    gl.CLAMP_TO_EDGE,
  );
  initialiseTexture(
    gl,
    blueNoiseTexture,
    gl.TEXTURE1,
    new Uint8Array([0, 0, 0, 255]),
    gl.NEAREST,
    gl.REPEAT,
  );

  const position = gl.getAttribLocation(program, "a_position");
  const uniforms = {
    texture: requireUniform(gl, program, "u_texture"),
    blueNoiseTexture: requireUniform(gl, program, "u_blueNoiseTexture"),
    blueNoiseTexelSize: requireUniform(gl, program, "u_blueNoiseTexelSize"),
    blueNoiseCoordOffset: requireUniform(
      gl,
      program,
      "u_blueNoiseCoordOffset",
    ),
    resolution: requireUniform(gl, program, "u_resolution"),
    coverAspect: requireUniform(gl, program, "u_coverAspect"),
    pulseCenter: requireUniform(gl, program, "u_pulseCenter"),
    time: requireUniform(gl, program, "u_time"),
    amount: requireUniform(gl, program, "u_amount"),
    padding: requireUniform(gl, program, "u_padding"),
    pulse: requireUniform(gl, program, "u_pulse"),
    hasSource: requireUniform(gl, program, "u_hasSource"),
    colors: [0, 1, 2, 3].map((index) =>
      requireUniform(gl, program, `u_color${index}`),
    ),
  };

  let disposed = false;
  let pixelWidth = 0;
  let pixelHeight = 0;
  let blueNoiseWidth = 1;
  let blueNoiseHeight = 1;
  let sourceWasUploaded = false;

  const blueNoiseImage = new Image();
  blueNoiseImage.onload = () => {
    if (disposed) return;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blueNoiseTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      blueNoiseImage,
    );
    blueNoiseWidth = blueNoiseImage.naturalWidth || 128;
    blueNoiseHeight = blueNoiseImage.naturalHeight || 128;
  };
  blueNoiseImage.src = blueNoiseUrl;

  function setColors(colors: AuraPalette): void {
    if (disposed) return;
    gl.useProgram(program);
    colors.forEach((color, index) => {
      gl.uniform3fv(uniforms.colors[index], colorToLinearRgb(color));
    });
  }

  function clearSourceTexture(): void {
    if (!sourceWasUploaded) return;
    initialiseTexture(
      gl,
      sourceTexture,
      gl.TEXTURE0,
      new Uint8Array([0, 0, 0, 0]),
      gl.LINEAR,
      gl.CLAMP_TO_EDGE,
    );
    sourceWasUploaded = false;
  }

  function uploadSource(
    source: TexImageSource | null,
    flipY: boolean,
  ): boolean {
    if (!source) {
      clearSourceTexture();
      return false;
    }

    if (source instanceof HTMLVideoElement && source.readyState < 2) {
      clearSourceTexture();
      return false;
    }

    try {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY ? 1 : 0);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      sourceWasUploaded = true;
      return true;
    } catch {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      clearSourceTexture();
      return false;
    }
  }

  gl.useProgram(program);
  gl.uniform1i(uniforms.texture, 0);
  gl.uniform1i(uniforms.blueNoiseTexture, 1);
  setColors(initialColors);

  return {
    setColors,
    draw(frame) {
      if (disposed || frame.width <= 0 || frame.height <= 0) return;

      const nextPixelWidth = Math.max(1, Math.round(frame.width * frame.dpr));
      const nextPixelHeight = Math.max(1, Math.round(frame.height * frame.dpr));

      if (nextPixelWidth !== pixelWidth || nextPixelHeight !== pixelHeight) {
        pixelWidth = nextPixelWidth;
        pixelHeight = nextPixelHeight;
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        gl.viewport(0, 0, pixelWidth, pixelHeight);
      }

      const diagonal = Math.sqrt(
        frame.width * frame.width + frame.height * frame.height,
      );
      const aspectScale =
        (Math.min(frame.height / frame.width, 1) / diagonal) *
        Math.max(frame.width, frame.height);
      const hasSource = uploadSource(frame.source, frame.flipSourceY);

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform2f(uniforms.resolution, pixelWidth, pixelHeight);
      gl.uniform2f(
        uniforms.coverAspect,
        (frame.width / frame.height) * aspectScale,
        aspectScale,
      );
      gl.uniform2f(
        uniforms.pulseCenter,
        frame.pulseOrigin[0],
        1 - frame.pulseOrigin[1],
      );
      gl.uniform2f(
        uniforms.blueNoiseTexelSize,
        1 / blueNoiseWidth,
        1 / blueNoiseHeight,
      );
      gl.uniform2f(
        uniforms.blueNoiseCoordOffset,
        Math.random(),
        Math.random(),
      );
      gl.uniform1f(uniforms.time, frame.time * frame.speed);
      gl.uniform1f(uniforms.amount, frame.amount);
      gl.uniform1f(uniforms.padding, frame.edgeWidth * frame.dpr);
      gl.uniform1f(uniforms.pulse, frame.pulse);
      gl.uniform1f(uniforms.hasSource, hasSource ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      blueNoiseImage.onload = null;
      gl.deleteTexture(sourceTexture);
      gl.deleteTexture(blueNoiseTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
