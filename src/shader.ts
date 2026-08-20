export const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * The production effect, kept as a readable WebGL 1 port. Integration adapters
 * cover transparent-pass alpha, edge-safe sampling and light-surface contrast;
 * the palette, signed-distance fields, pulse geometry, source displacement and
 * blue-noise dither preserve the source equations.
 */
export const fragmentShaderSource = `
precision highp float;

uniform sampler2D u_texture;
uniform sampler2D u_blueNoiseTexture;
uniform vec2 u_blueNoiseTexelSize;
uniform vec2 u_blueNoiseCoordOffset;
uniform vec2 u_resolution;
uniform vec2 u_coverAspect;
uniform vec2 u_pulseCenter;
uniform float u_time;
uniform float u_amount;
uniform float u_padding;
uniform float u_pulse;
uniform float u_hasSource;
uniform vec3 u_color0;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;

varying vec2 v_uv;

vec3 getBlueNoise(vec2 coordinate) {
  return texture2D(
    u_blueNoiseTexture,
    coordinate * u_blueNoiseTexelSize + u_blueNoiseCoordOffset
  ).rgb;
}

float linearstep(float edge0, float edge1, float value) {
  return clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float sdBox(vec2 point, vec2 bounds) {
  vec2 delta = abs(point) - bounds;
  return length(max(delta, 0.0)) + min(max(delta.x, delta.y), 0.0);
}

void main() {
  vec3 blueNoise = getBlueNoise(gl_FragCoord.xy);
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 glowUv = (v_uv - 0.5) * u_coverAspect * 2.0;

  float angle = u_time * -5.0;
  mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  glowUv = rotation * glowUv;
  glowUv = glowUv * 0.5 + 0.5;
  glowUv = clamp(glowUv, vec2(0.0), vec2(1.0));

  vec3 topColor = mix(u_color0, u_color1, glowUv.x);
  vec3 bottomColor = mix(u_color3, u_color2, glowUv.x);
  vec3 glowColor = mix(bottomColor, topColor, glowUv.y);
  glowColor *= glowColor * glowColor * 2.0;

  vec2 wavePoint = (v_uv - u_pulseCenter) * aspect;
  float waveLength = length(aspect);
  float wavePointLength = waveLength - length(wavePoint);
  float waveStartLength = 0.5 * waveLength;
  float waveEndLength = 0.5 * waveLength;
  float waveTravelLength = waveLength + waveStartLength + waveEndLength;
  float waveTime = u_pulse * waveTravelLength - waveLength + wavePointLength;
  float waveStart = smoothstep(0.0, waveStartLength, waveTime);
  float waveEnd = smoothstep(
    waveStartLength + waveEndLength,
    waveStartLength,
    waveTime
  );
  float waveDistance = abs(waveTime - waveStartLength);
  float wave = waveStart * waveEnd * u_amount;
  vec2 waveDirection = normalize(wavePoint);

  vec2 borderUv =
    (v_uv - 0.5) * u_resolution +
    waveDirection * wave * 0.01 * u_resolution.x;

  float inner = sdBox(
    borderUv,
    u_resolution * 0.5 - u_padding * 2.0
  ) - u_padding;
  inner = linearstep(0.0, u_padding * 2.5, inner);
  inner = pow(inner, 3.0);

  float outer = sdBox(
    borderUv,
    u_resolution * 0.5 - u_padding * 3.0
  ) - u_padding * 1.5;
  outer = linearstep(0.0, u_padding * 5.5, outer);
  outer = pow(outer, 5.0);

  vec2 sampleUv =
    v_uv +
    waveDirection * smoothstep(0.0, 0.4, abs(waveDistance)) * wave * -0.005;
  // Keep displaced samples inside the source. This prevents an exposed strip
  // when a pulse reaches a frame edge while preserving the source displacement.
  vec2 edgeSafeUv = clamp(sampleUv, vec2(0.001), vec2(0.999));
  vec4 base = texture2D(u_texture, edgeSafeUv);
  vec3 sourceLinear = pow(base.rgb, vec3(2.2));
  float glow = (0.001 + inner + outer * 0.5) * 5.0;

  vec3 emissiveColor = sourceLinear;
  emissiveColor += u_amount * glowColor * glow;
  emissiveColor +=
    wave * (inner * 0.25 + outer * 0.25 + glowColor * 0.05);
  emissiveColor = min(emissiveColor, vec3(1.0));
  vec3 color = emissiveColor;

  glow = dot(glowColor, vec3(0.2126, 0.7152, 0.0722)) * glow;
  float alpha = min(
    1.0,
    base.a + glow + wave * (inner + outer * 0.5 + 0.05)
  );
  alpha *= mix(min(1.0, u_amount), 1.0, u_hasSource);

  gl_FragColor = vec4(
    pow(color, vec3(1.0 / 2.2)) + blueNoise * 0.004,
    alpha
  );
}
`;
