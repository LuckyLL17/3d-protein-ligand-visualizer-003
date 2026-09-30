import * as THREE from 'three';

export type DisplayMode = 'cartoon' | 'surface' | 'atoms';
export type Element = 'C' | 'N' | 'O' | 'S';
export type Role = 'active' | 'support' | 'loop';

export type ResidueMeta = { id: number; code: string; name: string; role: Role; color: string };
export type LigandAtomMeta = { id: string; element: Element; radius: number };

/**
 * 构象（conformer）：同一蛋白的一个结构构象。
 * 残基与配体的坐标按构象独立存储；缺失的残基/原子对应键为 undefined，
 * 表示该构象没有此坐标——绝不允许用其他构象的坐标替代。
 */
export type Conformer = {
  id: string;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
  /** 带状骨架的形变相位，用于让不同构象在同一坐标系中可区分 */
  phase: number;
  residueCoords: Record<number, [number, number, number] | undefined>;
  ligandPresent: boolean;
  ligandCoords: Record<string, [number, number, number] | undefined>;
};

export type Selection = { residueId: number | null; atomId: string | null };

/** 残基元数据：跨构象共享的同一蛋白序列信息 */
export const RESIDUE_META: ResidueMeta[] = [
  { id: 41, code: 'GLU41', name: '谷氨酸', color: '#ef8e77', role: 'active' },
  { id: 78, code: 'TYR78', name: '酪氨酸', color: '#f0c76e', role: 'support' },
  { id: 102, code: 'HIS102', name: '组氨酸', color: '#71c9e6', role: 'active' },
  { id: 146, code: 'ASP146', name: '天冬氨酸', color: '#e88389', role: 'active' },
  { id: 183, code: 'PHE183', name: '苯丙氨酸', color: '#c28ce8', role: 'support' },
  { id: 219, code: 'SER219', name: '丝氨酸', color: '#8fd6a2', role: 'loop' },
  { id: 244, code: 'GLY244', name: '甘氨酸', color: '#9aabb4', role: 'loop' }
];

/** 配体原子模板：跨构象共享的同一配体组成 */
export const LIGAND_TEMPLATE: LigandAtomMeta[] = [
  { id: 'C1', element: 'C', radius: 0.17 },
  { id: 'C2', element: 'C', radius: 0.17 },
  { id: 'N1', element: 'N', radius: 0.2 },
  { id: 'O1', element: 'O', radius: 0.18 },
  { id: 'O2', element: 'O', radius: 0.18 },
  { id: 'S1', element: 'S', radius: 0.24 }
];

export const BONDS: [string, string][] = [
  ['C1', 'C2'], ['C1', 'O1'], ['C1', 'O2'], ['C2', 'N1'], ['C2', 'S1']
];

export const ELEMENT_COLORS: Record<Element, string> = {
  C: '#d6e1e4', N: '#54b9e3', O: '#ec7474', S: '#e7c35f'
};

export const PALETTE = ['#63a0e8', '#7fd6a8', '#e8b06b', '#e88389', '#c28ce8', '#71c9e6', '#d58acb', '#8fd6a2'];

/** 配体组在场景中的偏移（与原工作区保持一致） */
export const LIGAND_OFFSET = new THREE.Vector3(0.1, 0.45, 0.15);

export const helixPoints = Array.from({ length: 46 }, (_, index) => {
  const t = index / 45;
  return new THREE.Vector3(
    -3.2 + t * 6.4,
    Math.sin(t * Math.PI * 4) * 0.72 + Math.cos(t * Math.PI * 2) * 0.18,
    Math.cos(t * Math.PI * 3) * 0.74
  );
});

export const sheetPoints = Array.from({ length: 22 }, (_, index) =>
  new THREE.Vector3(
    -3.5 + index * 0.33,
    1.4 + Math.sin(index * 0.55) * 0.16,
    -0.9 + Math.sin(index * 0.55) * 0.25
  )
);

const BASE_RESIDUE: Record<number, [number, number, number]> = {
  41: [-1.6, 0.4, 0.5],
  78: [-0.7, 1.15, -0.25],
  102: [0.4, 0.75, 0.2],
  146: [1.2, 0.15, -0.45],
  183: [1.8, 0.7, 0.35],
  219: [0.55, -0.3, -0.65],
  244: [-1.05, -0.55, -0.3]
};

const BASE_LIGAND: Record<string, [number, number, number]> = {
  C1: [0, 0, 0],
  C2: [0.55, 0.26, 0.08],
  N1: [0.98, -0.18, 0.18],
  O1: [-0.48, 0.35, 0.05],
  O2: [-0.15, -0.5, -0.1],
  S1: [0.42, 0.05, -0.62]
};

let conformerSeq = 0;
export const uid = () => `conf-${Date.now().toString(36)}-${conformerSeq++}`;

/** 基于残基编号的确定性微扰，让不同构象坐标同框但可区分 */
function perturb(base: [number, number, number], seed: number, phase: number, amp: number): [number, number, number] {
  return [
    base[0] + Math.sin(seed * 0.15 + phase) * amp,
    base[1] + Math.cos(seed * 0.12 + phase * 1.1) * amp * 0.8,
    base[2] + Math.sin(seed * 0.18 + phase * 0.7) * amp
  ];
}

function copyAll<T extends string | number>(base: Record<T, [number, number, number]>): Record<T, [number, number, number]> {
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, [...(value as [number, number, number])]])) as Record<T, [number, number, number]>;
}

/** 示例构象集：A 完整、B 缺失 HIS102 与 S1、C 为 apo 态且缺失 SER219 */
export function buildDemoConformers(): Conformer[] {
  const a: Conformer = {
    id: uid(),
    name: '构象 A · 激活态',
    color: '#63a0e8',
    opacity: 1,
    visible: true,
    phase: 0,
    residueCoords: copyAll(BASE_RESIDUE),
    ligandPresent: true,
    ligandCoords: copyAll(BASE_LIGAND)
  };

  const bResidue: Record<number, [number, number, number] | undefined> = {};
  for (const meta of RESIDUE_META) {
    if (meta.id !== 102) bResidue[meta.id] = perturb(BASE_RESIDUE[meta.id], meta.id, 2.1, 0.32);
  }
  const bLigand: Record<string, [number, number, number] | undefined> = {};
  for (const atom of LIGAND_TEMPLATE) {
    if (atom.id !== 'S1') bLigand[atom.id] = perturb(BASE_LIGAND[atom.id], atom.id.charCodeAt(1), 2.1, 0.22);
  }
  const b: Conformer = {
    id: uid(),
    name: '构象 B · HIS102 缺失',
    color: '#7fd6a8',
    opacity: 0.45,
    visible: true,
    phase: 2.1,
    residueCoords: bResidue,
    ligandPresent: true,
    ligandCoords: bLigand
  };

  const cResidue: Record<number, [number, number, number] | undefined> = {};
  for (const meta of RESIDUE_META) {
    if (meta.id !== 219) cResidue[meta.id] = perturb(BASE_RESIDUE[meta.id], meta.id, 4.0, 0.4);
  }
  const c: Conformer = {
    id: uid(),
    name: '构象 C · apo 态',
    color: '#e8b06b',
    opacity: 0.3,
    visible: true,
    phase: 4.0,
    residueCoords: cResidue,
    ligandPresent: false,
    ligandCoords: {}
  };

  return [a, b, c];
}

/** 复制构象：保留缺失状态与配体状态，但对坐标施加小微扰，使副本可区分且避免完全重叠 */
export function duplicateConformer(source: Conformer, name: string, color: string): Conformer {
  const phase = Math.random() * Math.PI * 2;
  const residueCoords: Record<number, [number, number, number] | undefined> = {};
  for (const meta of RESIDUE_META) {
    const coords = source.residueCoords[meta.id];
    if (coords !== undefined) residueCoords[meta.id] = perturb(coords, meta.id, phase, 0.18);
  }
  const ligandCoords: Record<string, [number, number, number] | undefined> = {};
  for (const atom of LIGAND_TEMPLATE) {
    const coords = source.ligandCoords[atom.id];
    if (coords !== undefined) ligandCoords[atom.id] = perturb(coords, atom.id.charCodeAt(1), phase, 0.14);
  }
  return {
    ...source,
    id: uid(),
    name,
    color,
    opacity: Math.max(source.opacity, 0.5),
    visible: true,
    phase,
    residueCoords,
    ligandCoords
  };
}

/** 对带状骨架点施加构象级形变（同坐标系下的构象差异） */
export function deformPoints(points: THREE.Vector3[], phase: number, amp: number): THREE.Vector3[] {
  return points.map((p, index) => {
    const t = index / (points.length - 1);
    return new THREE.Vector3(
      p.x + Math.sin(t * Math.PI * 2 + phase) * amp,
      p.y + Math.cos(t * Math.PI * 2.2 + phase * 1.3) * amp * 0.7,
      p.z + Math.sin(t * Math.PI * 1.7 + phase * 0.8) * amp * 0.8
    );
  });
}

export type LigandHit = { id: string; point: THREE.Vector3; distance: number };

/** 计算某构象中距给定残基最近的配体原子；配体缺失时返回 null，绝不返回替代坐标 */
export function nearestLigandAtom(conformer: Conformer, pos: THREE.Vector3): LigandHit | null {
  if (!conformer.ligandPresent) return null;
  let best: LigandHit | null = null;
  for (const atom of LIGAND_TEMPLATE) {
    const coords = conformer.ligandCoords[atom.id];
    if (!coords) continue;
    const point = new THREE.Vector3(coords[0], coords[1], coords[2]).add(LIGAND_OFFSET);
    const distance = pos.distanceTo(point);
    if (best === null || distance < best.distance) best = { id: atom.id, point, distance };
  }
  return best;
}

/** 构象的默认选择：第一个存在的残基 / 第一个存在的配体原子 */
export function defaultSelection(conformer: Conformer): Selection {
  const firstResidue = RESIDUE_META.find(meta => conformer.residueCoords[meta.id] !== undefined)?.id ?? null;
  const firstAtom = conformer.ligandPresent
    ? LIGAND_TEMPLATE.find(atom => conformer.ligandCoords[atom.id] !== undefined)?.id ?? null
    : null;
  return { residueId: firstResidue, atomId: firstAtom };
}

function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function randomName(): string {
  return `构象 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
}

/** 解析 JSON 录入的构象数据；缺失的残基/配体键保持 undefined */
function parseJsonConformer(text: string): Conformer {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON 解析失败，请检查格式（键名需带引号）');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON 内容必须是对象');
  const record = data as Record<string, unknown>;

  const residueCoords: Record<number, [number, number, number] | undefined> = {};
  const rawResidues = (record.residues ?? record.residueCoords ?? {}) as Record<string, unknown>;
  for (const meta of RESIDUE_META) {
    const raw = rawResidues[meta.id] ?? rawResidues[String(meta.id)];
    if (Array.isArray(raw) && raw.length === 3 && raw.every(v => typeof v === 'number' && Number.isFinite(v))) {
      residueCoords[meta.id] = [raw[0], raw[1], raw[2]];
    }
  }

  const ligandCoords: Record<string, [number, number, number] | undefined> = {};
  const ligandPresent = record.ligand !== null && record.ligand !== undefined && (record.ligand as Record<string, unknown>).present !== false;
  if (ligandPresent) {
    const rawAtoms = ((record.ligand as Record<string, unknown>).atoms ?? {}) as Record<string, unknown>;
    for (const atom of LIGAND_TEMPLATE) {
      const raw = rawAtoms[atom.id];
      if (Array.isArray(raw) && raw.length === 3 && raw.every(v => typeof v === 'number' && Number.isFinite(v))) {
        ligandCoords[atom.id] = [raw[0], raw[1], raw[2]];
      }
    }
  }

  const color = typeof record.color === 'string' && record.color.trim() ? record.color : randomColor();
  const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : randomName();
  return { id: uid(), name, color, opacity: 0.85, visible: true, phase: Math.random() * Math.PI * 2, residueCoords, ligandPresent, ligandCoords };
}

/** 解析 PDB 文本中的 ATOM（仅 CA）/ HETATM 记录；坐标居中并缩放到示例场景量级 */
function parsePdbConformer(text: string): Conformer {
  const residueCoords: Record<number, [number, number, number] | undefined> = {};
  const ligandCoords: Record<string, [number, number, number] | undefined> = {};

  for (const line of text.split(/\r?\n/)) {
    const record = line.slice(0, 6).trim();
    if (record === 'ATOM') {
      const atomName = line.slice(12, 16).trim();
      if (atomName !== 'CA') continue;
      const resSeq = parseInt(line.slice(22, 26).trim(), 10);
      const x = parseFloat(line.slice(30, 38));
      const y = parseFloat(line.slice(38, 46));
      const z = parseFloat(line.slice(46, 54));
      const meta = RESIDUE_META.find(r => r.id === resSeq);
      if (meta !== undefined && [x, y, z].every(Number.isFinite)) residueCoords[resSeq] = [x, y, z];
    } else if (record === 'HETATM') {
      const atomName = line.slice(12, 16).trim();
      const x = parseFloat(line.slice(30, 38));
      const y = parseFloat(line.slice(38, 46));
      const z = parseFloat(line.slice(46, 54));
      const meta = LIGAND_TEMPLATE.find(a => a.id === atomName);
      if (meta !== undefined && [x, y, z].every(Number.isFinite)) ligandCoords[atomName] = [x, y, z];
    }
  }

  const residueIds = Object.keys(residueCoords);
  if (residueIds.length === 0) {
    throw new Error('未解析到可用的 ATOM 记录（需要与示例残基编号一致的 CA 原子，如 41、78、102…）');
  }

  const count = residueIds.length;
  const cx = residueIds.reduce((sum, id) => sum + residueCoords[Number(id)]![0], 0) / count;
  const cy = residueIds.reduce((sum, id) => sum + residueCoords[Number(id)]![1], 0) / count;
  const cz = residueIds.reduce((sum, id) => sum + residueCoords[Number(id)]![2], 0) / count;
  const scale = 0.3;
  for (const id of residueIds) {
    const coords = residueCoords[Number(id)]!;
    residueCoords[Number(id)] = [(coords[0] - cx) * scale, (coords[1] - cy) * scale, (coords[2] - cz) * scale];
  }
  for (const id of Object.keys(ligandCoords)) {
    const coords = ligandCoords[id]!;
    ligandCoords[id] = [(coords[0] - cx) * scale, (coords[1] - cy) * scale, (coords[2] - cz) * scale];
  }

  return {
    id: uid(),
    name: randomName(),
    color: randomColor(),
    opacity: 0.85,
    visible: true,
    phase: Math.random() * Math.PI * 2,
    residueCoords,
    ligandPresent: Object.keys(ligandCoords).length > 0,
    ligandCoords
  };
}

/** 录入数据入口：自动识别 JSON 或 PDB；失败时抛出带中文提示的异常 */
export function parseConformerInput(text: string): Conformer {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error('请先粘贴结构数据');
  if (trimmed.startsWith('{')) return parseJsonConformer(trimmed);
  return parsePdbConformer(trimmed);
}
