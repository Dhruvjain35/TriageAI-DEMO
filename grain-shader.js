/*
 * Triage.ai — Grain Gradient Shader (vanilla WebGL)
 * Adapted from Paper Design shader concept.
 * Copyright (c) 2026 Dhruv Jain & Sriyan Bodla. All rights reserved.
 */

const VERT = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_softness;
uniform float u_intensity;
uniform float u_grain;

// Colors (dark clinical palette)
const vec3 c_back = vec3(0.0, 0.0, 0.0);
const vec3 c1 = vec3(0.09, 0.07, 0.30);  // deep indigo
const vec3 c2 = vec3(0.05, 0.12, 0.35);  // dark blue
const vec3 c3 = vec3(0.15, 0.04, 0.28);  // deep violet

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.15;

  // Animated gradient from corners
  float d1 = length(uv - vec2(0.0, 0.0));           // bottom-left
  float d2 = length(uv - vec2(1.0, 1.0));           // top-right
  float d3 = length(uv - vec2(0.8, 0.0));           // bottom-right area

  // Soft animated movement
  float s1 = smoothstep(1.2 + sin(t) * 0.15, 0.0, d1) * u_intensity;
  float s2 = smoothstep(1.0 + cos(t * 0.7) * 0.1, 0.0, d2) * u_intensity * 0.8;
  float s3 = smoothstep(0.9 + sin(t * 1.3) * 0.12, 0.0, d3) * u_intensity * 0.6;

  // Blend colors
  vec3 col = c_back;
  col = mix(col, c1, s1 * u_softness);
  col = mix(col, c2, s2 * u_softness);
  col = mix(col, c3, s3 * u_softness);

  // Film grain
  float grain = (hash(uv * u_resolution + vec2(t * 100.0, t * 73.0)) - 0.5) * u_grain;
  col += grain;

  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}`;

function initGrainShader(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
  if (!gl) return;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uSoft = gl.getUniformLocation(prog, 'u_softness');
  const uInt = gl.getUniformLocation(prog, 'u_intensity');
  const uGrain = gl.getUniformLocation(prog, 'u_grain');

  gl.uniform1f(uSoft, 0.76);
  gl.uniform1f(uInt, 0.45);
  gl.uniform1f(uGrain, 0.06);

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };

  resize();
  window.addEventListener('resize', resize);

  let frame;
  const render = (now) => {
    gl.uniform1f(uTime, now * 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    frame = requestAnimationFrame(render);
  };

  frame = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
  };
}
