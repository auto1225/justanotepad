import type { Mesh } from './model3d'

/**
 * 3D 그림판 — WebGL 로 삼각형을 그리고 마우스로 돌린다.
 * 라이브러리를 들이지 않고 필요한 만큼만 쓴다 (셰이더 두 개, 행렬 몇 줄).
 */

export interface ViewState { rotX: number; rotY: number; zoom: number }

const VERT = `
attribute vec3 aPos; attribute vec3 aNor;
uniform mat4 uMvp; uniform mat4 uModel;
varying vec3 vNor;
void main() { vNor = mat3(uModel) * aNor; gl_Position = uMvp * vec4(aPos, 1.0); }`

const FRAG = `
precision mediump float;
varying vec3 vNor; uniform vec3 uColor;
void main() {
  vec3 n = normalize(vNor);
  float key = max(dot(n, normalize(vec3(0.4, 0.7, 0.6))), 0.0);
  float fill = max(dot(n, normalize(vec3(-0.5, 0.2, 0.4))), 0.0) * 0.35;
  float light = 0.28 + key * 0.72 + fill;
  gl_FragColor = vec4(uColor * light, 1.0);
}`

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || '셰이더 오류')
  return sh
}

function multiply(a: number[], b: number[]): number[] {
  const out = new Array(16).fill(0)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    let s = 0
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
    out[c * 4 + r] = s
  }
  return out
}

/** 3D 그림판 하나를 만든다 — 돌려 보기·지우기까지 함께 준다 */
export function createModelView(canvas: HTMLCanvasElement, mesh: Mesh, state: ViewState, onChange?: (s: ViewState) => void) {
  /* preserveDrawingBuffer 를 켜 둔다 — 그린 그림을 그대로 읽어
     저장본에 넣을 미리보기(poster)를 만들기 때문이다 (끄면 빈 그림이 나온다) */
  const gl = (canvas.getContext('webgl', { antialias: true, alpha: true, preserveDrawingBuffer: true }) ||
    canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true })) as WebGLRenderingContext | null
  if (!gl) throw new Error('이 브라우저에서는 3D 를 그릴 수 없다')

  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(program)
  gl.useProgram(program)

  const posBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0)

  const norBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, norBuf)
  gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW)
  const aNor = gl.getAttribLocation(program, 'aNor')
  gl.enableVertexAttribArray(aNor)
  gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 0, 0)

  const uMvp = gl.getUniformLocation(program, 'uMvp')
  const uModel = gl.getUniformLocation(program, 'uModel')
  const uColor = gl.getUniformLocation(program, 'uColor')
  gl.enable(gl.DEPTH_TEST)

  const view: ViewState = { ...state }

  function draw() {
    const w = canvas.width, h = canvas.height
    gl!.viewport(0, 0, w, h)
    gl!.clearColor(0, 0, 0, 0)
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT)

    const s = 1 / (mesh.radius * 1.35) * view.zoom
    const [cx, cy, cz] = mesh.center
    const move = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -cx, -cy, -cz, 1]
    const scale = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]
    const cx2 = Math.cos(view.rotX), sx = Math.sin(view.rotX)
    const cy2 = Math.cos(view.rotY), sy = Math.sin(view.rotY)
    const rotX = [1, 0, 0, 0, 0, cx2, sx, 0, 0, -sx, cx2, 0, 0, 0, 0, 1]
    const rotY = [cy2, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy2, 0, 0, 0, 0, 1]
    const model = multiply(multiply(rotX, rotY), multiply(scale, move))

    const aspect = w / h
    const f = 1 / Math.tan(0.62 / 2)
    const near = 0.05, far = 40
    const proj = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]
    const camera = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -2.6, 1]
    const mvp = multiply(proj, multiply(camera, model))

    gl!.uniformMatrix4fv(uMvp, false, new Float32Array(mvp))
    gl!.uniformMatrix4fv(uModel, false, new Float32Array(model))
    gl!.uniform3fv(uColor, new Float32Array(mesh.color))
    gl!.drawArrays(gl!.TRIANGLES, 0, mesh.positions.length / 3)
  }

  let dragging = false
  let lastX = 0, lastY = 0
  const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId) }
  const onMove = (e: PointerEvent) => {
    if (!dragging) return
    view.rotY += (e.clientX - lastX) * 0.01
    view.rotX += (e.clientY - lastY) * 0.01
    view.rotX = Math.max(-1.4, Math.min(1.4, view.rotX))
    lastX = e.clientX; lastY = e.clientY
    draw()
  }
  const onUp = () => { if (dragging) { dragging = false; onChange?.({ ...view }) } }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    view.zoom = Math.max(0.3, Math.min(4, view.zoom * (e.deltaY > 0 ? 0.92 : 1.08)))
    draw()
    onChange?.({ ...view })
  }
  /** 키보드로도 돌린다 — 화살표는 회전, +- 는 크기 */
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.35 : 0.12
    if (e.key === 'ArrowLeft') view.rotY -= step
    else if (e.key === 'ArrowRight') view.rotY += step
    else if (e.key === 'ArrowUp') view.rotX = Math.max(-1.4, view.rotX - step)
    else if (e.key === 'ArrowDown') view.rotX = Math.min(1.4, view.rotX + step)
    else if (e.key === '+' || e.key === '=') view.zoom = Math.min(4, view.zoom * 1.12)
    else if (e.key === '-') view.zoom = Math.max(0.3, view.zoom * 0.89)
    else if (e.key === '0') { view.rotX = 0; view.rotY = 0; view.zoom = 1 }
    else return
    e.preventDefault()
    draw()
    onChange?.({ ...view })
  }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointerleave', onUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('keydown', onKey)
  draw()

  return {
    draw,
    state: view,
    destroy() {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('keydown', onKey)
      gl!.deleteBuffer(posBuf)
      gl!.deleteBuffer(norBuf)
      gl!.deleteProgram(program)
    },
  }
}
