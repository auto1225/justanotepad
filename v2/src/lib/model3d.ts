/**
 * 3D 모델 읽기 — 워드 「삽입 › 3D 모델」 자리.
 *
 * 바깥 그림 라이브러리를 들이지 않는다 (문서 편집기가 3D 엔진을 통째로 지고 다닐 이유가 없다).
 * 대신 널리 쓰는 세 가지를 직접 읽어 삼각형 목록으로 바꾼다:
 *   GLB(glTF 2.0 묶음) · STL(3D 프린터) · OBJ(범용 텍스트)
 * 그리고 작은 WebGL 그림판으로 돌려 가며 본다.
 */

export interface Mesh {
  /** 삼각형 꼭짓점 (x,y,z 반복) */
  positions: Float32Array
  /** 꼭짓점 법선 — 없으면 우리가 만든다 */
  normals: Float32Array
  /** 기본 색 */
  color: [number, number, number]
  /** 가운데와 크기 — 화면에 꽉 차게 맞출 때 쓴다 */
  center: [number, number, number]
  radius: number
}

export type ModelFormat = 'glb' | 'stl' | 'obj'

export function formatOf(name: string): ModelFormat | null {
  const ext = name.toLowerCase().split('.').pop() || ''
  if (ext === 'glb' || ext === 'gltf') return 'glb'
  if (ext === 'stl') return 'stl'
  if (ext === 'obj') return 'obj'
  return null
}

export function parseModel(buffer: ArrayBuffer, format: ModelFormat): Mesh {
  const mesh = format === 'glb' ? parseGlb(buffer) : format === 'stl' ? parseStl(buffer) : parseObj(buffer)
  return finish(mesh)
}

/* ── 마무리: 법선·가운데·크기 ─────────────────────────── */

function finish(raw: { positions: number[]; normals: number[]; color?: [number, number, number] }): Mesh {
  const positions = new Float32Array(raw.positions)
  let normals: Float32Array
  if (raw.normals.length === raw.positions.length) {
    normals = new Float32Array(raw.normals)
  } else {
    normals = new Float32Array(positions.length)
    for (let i = 0; i < positions.length; i += 9) {
      const ax = positions[i], ay = positions[i + 1], az = positions[i + 2]
      const bx = positions[i + 3], by = positions[i + 4], bz = positions[i + 5]
      const cx = positions[i + 6], cy = positions[i + 7], cz = positions[i + 8]
      const ux = bx - ax, uy = by - ay, uz = bz - az
      const vx = cx - ax, vy = cy - ay, vz = cz - az
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len; ny /= len; nz /= len
      for (let k = 0; k < 3; k++) {
        normals[i + k * 3] = nx; normals[i + k * 3 + 1] = ny; normals[i + k * 3 + 2] = nz
      }
    }
  }
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i])
    minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1])
    minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2])
  }
  if (!Number.isFinite(minX)) { minX = minY = minZ = 0; maxX = maxY = maxZ = 1 }
  const center: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]
  const radius = Math.max(1e-4, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2)
  return { positions, normals, color: raw.color || [0.62, 0.68, 0.78], center, radius }
}

/* ── STL ─────────────────────────────────────────────── */

function parseStl(buffer: ArrayBuffer): { positions: number[]; normals: number[] } {
  const head = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(96, buffer.byteLength)))
  if (/^\s*solid/i.test(head) && !looksBinaryStl(buffer)) return parseStlAscii(new TextDecoder().decode(buffer))

  const view = new DataView(buffer)
  const count = view.getUint32(80, true)
  const positions: number[] = []
  const normals: number[] = []
  let o = 84
  for (let i = 0; i < count && o + 50 <= buffer.byteLength; i++, o += 50) {
    const nx = view.getFloat32(o, true), ny = view.getFloat32(o + 4, true), nz = view.getFloat32(o + 8, true)
    for (let v = 0; v < 3; v++) {
      const p = o + 12 + v * 12
      positions.push(view.getFloat32(p, true), view.getFloat32(p + 4, true), view.getFloat32(p + 8, true))
      normals.push(nx, ny, nz)
    }
  }
  return { positions, normals }
}

/** 파일 크기로 이진 STL 인지 가린다 (84 + 50×삼각형수) */
function looksBinaryStl(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false
  const count = new DataView(buffer).getUint32(80, true)
  return 84 + count * 50 === buffer.byteLength
}

function parseStlAscii(text: string): { positions: number[]; normals: number[] } {
  const positions: number[] = []
  const normals: number[] = []
  let normal: [number, number, number] = [0, 0, 1]
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (t.startsWith('facet normal')) {
      const p = t.split(/\s+/).slice(2).map(Number)
      normal = [p[0] || 0, p[1] || 0, p[2] || 1]
    } else if (t.startsWith('vertex')) {
      const p = t.split(/\s+/).slice(1).map(Number)
      positions.push(p[0] || 0, p[1] || 0, p[2] || 0)
      normals.push(...normal)
    }
  }
  return { positions, normals }
}

/* ── OBJ ─────────────────────────────────────────────── */

function parseObj(buffer: ArrayBuffer): { positions: number[]; normals: number[] } {
  const text = new TextDecoder().decode(buffer)
  const v: number[][] = []
  const vn: number[][] = []
  const positions: number[] = []
  const normals: number[] = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (t.startsWith('v ')) v.push(t.split(/\s+/).slice(1, 4).map(Number))
    else if (t.startsWith('vn ')) vn.push(t.split(/\s+/).slice(1, 4).map(Number))
    else if (t.startsWith('f ')) {
      const face = t.split(/\s+/).slice(1).map((chunk) => {
        const [vi, , ni] = chunk.split('/')
        return { v: idx(Number(vi), v.length), n: ni ? idx(Number(ni), vn.length) : -1 }
      })
      // 다각형은 삼각형으로 쪼갠다
      for (let i = 1; i + 1 < face.length; i++) {
        for (const p of [face[0], face[i], face[i + 1]]) {
          const pos = v[p.v] || [0, 0, 0]
          positions.push(pos[0] || 0, pos[1] || 0, pos[2] || 0)
          if (p.n >= 0 && vn[p.n]) normals.push(vn[p.n][0] || 0, vn[p.n][1] || 0, vn[p.n][2] || 0)
        }
      }
    }
  }
  return { positions, normals: normals.length === positions.length ? normals : [] }
}

const idx = (i: number, len: number) => (i > 0 ? i - 1 : len + i)

/* ── GLB (glTF 2.0) ──────────────────────────────────── */

interface GltfJson {
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number; material?: number; mode?: number }> }>
  accessors?: Array<{ bufferView: number; componentType: number; count: number; type: string; byteOffset?: number }>
  bufferViews?: Array<{ buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }>
  materials?: Array<{ pbrMetallicRoughness?: { baseColorFactor?: number[] } }>
}

const COMPONENT_SIZE: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }

function parseGlb(buffer: ArrayBuffer): { positions: number[]; normals: number[]; color?: [number, number, number] } {
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('glTF 묶음(GLB)이 아니다')
  let offset = 12
  let json: GltfJson | null = null
  let bin: Uint8Array | null = null
  while (offset + 8 <= buffer.byteLength) {
    const len = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const body = new Uint8Array(buffer, offset + 8, len)
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body))
    else if (type === 0x004e4942) bin = body
    offset += 8 + len + ((4 - (len % 4)) % 4)
  }
  if (!json || !bin) throw new Error('GLB 안에서 내용을 찾지 못했다')

  const positions: number[] = []
  const normals: number[] = []
  let color: [number, number, number] | undefined

  const read = (accessorIndex: number): number[] => {
    const acc = json!.accessors?.[accessorIndex]
    const bv = acc && json!.bufferViews?.[acc.bufferView]
    if (!acc || !bv) return []
    const compSize = COMPONENT_SIZE[acc.componentType] || 4
    const comps = TYPE_COUNT[acc.type] || 1
    const stride = bv.byteStride || compSize * comps
    const base = (bv.byteOffset || 0) + (acc.byteOffset || 0)
    const dv = new DataView(bin!.buffer, bin!.byteOffset, bin!.byteLength)
    const out: number[] = []
    for (let i = 0; i < acc.count; i++) {
      for (let c = 0; c < comps; c++) {
        const at = base + i * stride + c * compSize
        if (at + compSize > dv.byteLength) return out
        out.push(
          acc.componentType === 5126 ? dv.getFloat32(at, true)
            : acc.componentType === 5125 ? dv.getUint32(at, true)
              : acc.componentType === 5123 ? dv.getUint16(at, true)
                : acc.componentType === 5122 ? dv.getInt16(at, true)
                  : acc.componentType === 5121 ? dv.getUint8(at)
                    : dv.getInt8(at)
        )
      }
    }
    return out
  }

  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      if (prim.mode != null && prim.mode !== 4) continue // 삼각형만
      const pos = read(prim.attributes.POSITION)
      if (!pos.length) continue
      const nor = prim.attributes.NORMAL != null ? read(prim.attributes.NORMAL) : []
      const indices = prim.indices != null ? read(prim.indices) : pos.map((_, i) => i / 3).filter((v) => Number.isInteger(v))
      const list = prim.indices != null ? indices : Array.from({ length: pos.length / 3 }, (_, i) => i)
      for (const i of list) {
        positions.push(pos[i * 3] || 0, pos[i * 3 + 1] || 0, pos[i * 3 + 2] || 0)
        if (nor.length) normals.push(nor[i * 3] || 0, nor[i * 3 + 1] || 0, nor[i * 3 + 2] || 0)
      }
      if (color === undefined && prim.material != null) {
        const f = json.materials?.[prim.material]?.pbrMetallicRoughness?.baseColorFactor
        if (f) color = [f[0] ?? 0.7, f[1] ?? 0.7, f[2] ?? 0.7]
      }
    }
  }
  if (!positions.length) throw new Error('이 모델에서 삼각형을 찾지 못했다')
  return { positions, normals: normals.length === positions.length ? normals : [], color }
}
