/**
 * Phosphor persistence for the scope, as a long-persistence radar tube has it: whatever
 * the 2D engine draws is kept in an accumulation buffer that decays a little every frame,
 * so the sweep, moving aircraft and closing fixes leave a short amber afterglow. It is
 * luminance on the instrument, not a glow on the interface.
 *
 * The engine draws each frame into an offscreen 2D canvas; this uploads it as a texture,
 * folds it into a ping-pong accumulation buffer, and composites the result with fine grain.
 */

const VS = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`

const ACCUMULATE = `#version 300 es
precision mediump float;
in vec2 uv;
out vec4 o;
uniform sampler2D src;
uniform sampler2D prev;
uniform float decay;
void main() { o = max(texture(src, uv), texture(prev, uv) * decay); }`

const COMPOSITE = `#version 300 es
precision mediump float;
in vec2 uv;
out vec4 o;
uniform sampler2D src;
uniform sampler2D acc;
uniform float seed;
uniform float glow;
float hash(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec4 s = texture(src, uv);
  vec4 after = max(texture(acc, uv) - s, 0.0) * glow;
  // Afterglow drifts toward the tube's amber, whatever colour painted it.
  after.rgb = mix(after.rgb, vec3(0.91, 0.66, 0.23) * after.a, 0.55);
  vec4 c = s + after * (1.0 - s.a);
  float g = (hash(gl_FragCoord.xy + seed) - 0.5) * 0.05 * c.a;
  c.rgb = clamp(c.rgb + g, 0.0, c.a);
  o = c;
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

function program(gl: WebGL2RenderingContext, fs: string) {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.bindAttribLocation(p, 0, 'p')
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  return p
}

export class Phosphor {
  private gl: WebGL2RenderingContext
  private accumulate: WebGLProgram
  private composite: WebGLProgram
  private src: WebGLTexture
  private acc: [WebGLTexture, WebGLTexture]
  private fbo: [WebGLFramebuffer, WebGLFramebuffer]
  private read = 0
  private w = 0
  private h = 0

  static create(canvas: HTMLCanvasElement): Phosphor | null {
    try {
      const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false })
      return gl ? new Phosphor(gl) : null
    } catch {
      return null
    }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.accumulate = program(gl, ACCUMULATE)
    this.composite = program(gl, COMPOSITE)
    const quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    this.src = this.texture()
    this.acc = [this.texture(), this.texture()]
    this.fbo = [gl.createFramebuffer()!, gl.createFramebuffer()!]
  }

  private texture() {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return
    const gl = this.gl
    this.w = w
    this.h = h
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.acc[i])
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[i])
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.acc[i], 0)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /** `persistence` 0 turns the afterglow off (reduced motion); 1 is the full tube. */
  render(source: HTMLCanvasElement, dtMs: number, persistence: number) {
    const gl = this.gl
    if (this.w === 0) return
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.src)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)

    const write = 1 - this.read
    gl.viewport(0, 0, this.w, this.h)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[write])
    gl.useProgram(this.accumulate)
    gl.uniform1i(gl.getUniformLocation(this.accumulate, 'src'), 0)
    gl.uniform1i(gl.getUniformLocation(this.accumulate, 'prev'), 1)
    // Frame-rate independent: about 0.86 per 60Hz frame, so trails last a few hundred ms.
    gl.uniform1f(gl.getUniformLocation(this.accumulate, 'decay'), persistence > 0 ? Math.pow(0.86, dtMs / 16.7) : 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.acc[this.read])
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.useProgram(this.composite)
    gl.uniform1i(gl.getUniformLocation(this.composite, 'src'), 0)
    gl.uniform1i(gl.getUniformLocation(this.composite, 'acc'), 1)
    gl.uniform1f(gl.getUniformLocation(this.composite, 'seed'), (performance.now() % 1000) / 7)
    gl.uniform1f(gl.getUniformLocation(this.composite, 'glow'), 0.5 * persistence)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.acc[write])
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    this.read = write
  }
}
