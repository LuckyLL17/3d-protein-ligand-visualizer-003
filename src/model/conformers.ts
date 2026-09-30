import type {
  ConformerTemplate,
  Conformation,
  Ligand,
  LigandAtom,
  Residue,
  Role,
  TemplateKey,
  Vec3,
} from './types';

/** 标准序列中的关键残基（颜色 / 名称是序列固有属性，不随构象变化） */
const canonicalResidues: Omit<Residue, 'x' | 'y' | 'z'>[] = [
  { id: 41, code: 'GLU41', name: '谷氨酸', role: 'active', color: '#ef8e77' },
  { id: 78, code: 'TYR78', name: '酪氨酸', role: 'support', color: '#f0c76e' },
  { id: 102, code: 'HIS102', name: '组氨酸', role: 'active', color: '#71c9e6' },
  { id: 146, code: 'ASP146', name: '天冬氨酸', role: 'active', color: '#e88389' },
  { id: 183, code: 'PHE183', name: '苯丙氨酸', role: 'support', color: '#c28ce8' },
  { id: 219, code: 'SER219', name: '丝氨酸', role: 'loop', color: '#8fd6a2' },
  { id: 244, code: 'GLY244', name: '甘氨酸', role: 'loop', color: '#9aabb4' },
];

/** 开放态中测得的参考坐标（其它构象通过空间变换 + 确定性抖动得到各自的真实坐标） */
const referenceCoords: Record<number, Vec3> = {
  41: [-1.6, 0.4, 0.5],
  78: [-0.7, 1.15, -0.25],
  102: [0.4, 0.75, 0.2],
  146: [1.2, 0.15, -0.45],
  183: [1.8, 0.7, 0.35],
  219: [0.55, -0.3, -0.65],
  244: [-1.05, -0.55, -0.3],
};

const HELIX_COUNT = 46;
const SHEET_COUNT = 22;

/** 配体 LIG-17 的模板：局部坐标，碳元素在渲染时染成构象色 */
const ligandTemplate: Omit<Ligand, 'position' | 'rotationY'> = {
  code: 'LIG-17',
  name: '小分子配体',
  atoms: [
    { id: 'C1', element: 'C', x: 0, y: 0, z: 0, radius: 0.17 },
    { id: 'C2', element: 'C', x: 0.55, y: 0.26, z: 0.08, radius: 0.17 },
    { id: 'N1', element: 'N', x: 0.98, y: -0.18, z: 0.18, radius: 0.2 },
    { id: 'O1', element: 'O', x: -0.48, y: 0.35, z: 0.05, radius: 0.18 },
    { id: 'O2', element: 'O', x: -0.15, y: -0.5, z: -0.1, radius: 0.18 },
    { id: 'S1', element: 'S', x: 0.42, y: 0.05, z: -0.62, radius: 0.24 },
  ],
  bonds: [['C1', 'C2'], ['C1', 'O1'], ['C1', 'O2'], ['C2', 'N1'], ['C2', 'S1']],
};

export const CONFORMER_TEMPLATES: ConformerTemplate[] = [
  {
    key: 'open',
    defaultName: '开放态',
    pdbCode: '1MOL',
    stateLabel: 'OPEN',
    color: '#6fb7e8',
    transform: { scale: 1, rotY: 0, offset: [0, 0, 0], jitter: 0, seed: 1 },
    hasLigand: true,
    ligandPose: { position: [0.1, 0.45, 0.15], rotationY: 0.2 },
    excludeResidueIds: [],
    metrics: { volume: '486 Å³', hbonds: 4, summary: '口袋敞开，配体以氢键网络固定' },
  },
  {
    key: 'closed',
    defaultName: '闭合态',
    pdbCode: '2MOL',
    stateLabel: 'CLOSED',
    color: '#e5a35c',
    transform: { scale: 0.86, rotY: 0.1, offset: [0, 0.06, 0], jitter: 0.055, seed: 7 },
    hasLigand: true,
    ligandPose: { position: [0.02, 0.4, 0.1], rotationY: 0.62 },
    // 闭合态环区 219 未解析（电子密度缺失）
    excludeResidueIds: [219],
    metrics: { volume: '352 Å³', hbonds: 5, summary: '口袋收缩，催化三联体就位' },
  },
  {
    key: 'apo',
    defaultName: '无配体态',
    pdbCode: '3MOL',
    stateLabel: 'APO',
    color: '#7fd6a4',
    transform: { scale: 1.04, rotY: -0.06, offset: [0.12, 0, 0.06], jitter: 0.07, seed: 13 },
    hasLigand: false,
    excludeResidueIds: [183, 244],
    metrics: { volume: '541 Å³', hbonds: null, summary: '无配体，口袋松散扩张' },
  },
  {
    key: 'mutant',
    defaultName: '突变体构象',
    pdbCode: '4MOL',
    stateLabel: 'MUTANT',
    color: '#d38ce6',
    transform: { scale: 0.95, rotY: 0.04, offset: [-0.08, 0.03, -0.05], jitter: 0.045, seed: 21 },
    hasLigand: true,
    ligandPose: { position: [0.16, 0.5, 0.06], rotationY: 0.95 },
    // 突变体关键催化残基 102 未解析，用于验证“缺残基”场景
    excludeResidueIds: [102],
    metrics: { volume: '428 Å³', hbonds: 2, summary: 'HIS102 缺失，氢键网络被破坏' },
  },
];

export function getTemplate(key: TemplateKey): ConformerTemplate {
  return CONFORMER_TEMPLATES.find(item => item.key === key) ?? CONFORMER_TEMPLATES[0];
}

/** 与坐标分量相关的确定性伪随机数（不同构象抖动不同，但同构象始终稳定） */
function hashNoise(seed: number, id: number, axis: number): number {
  const x = Math.sin(seed * 137.7 + id * 19.13 + axis * 7.91) * 43758.5453;
  return x - Math.floor(x); // 0..1
}

function transformPoint(p: Vec3, t: ConformerTemplate['transform'], tag: number): Vec3 {
  const [px, py, pz] = [p[0] * t.scale, p[1] * t.scale, p[2] * t.scale];
  const cos = Math.cos(t.rotY);
  const sin = Math.sin(t.rotY);
  const nx = px * cos + pz * sin;
  const nz = -px * sin + pz * cos;
  return [
    nx + t.offset[0] + (hashNoise(t.seed, tag, 0) - 0.5) * 2 * t.jitter,
    py + t.offset[1] + (hashNoise(t.seed, tag, 1) - 0.5) * 2 * t.jitter,
    nz + t.offset[2] + (hashNoise(t.seed, tag, 2) - 0.5) * 2 * t.jitter,
  ];
}

function helixBase(index: number): Vec3 {
  const u = index / (HELIX_COUNT - 1);
  return [-3.2 + u * 6.4, Math.sin(u * Math.PI * 4) * 0.72 + Math.cos(u * Math.PI * 2) * 0.18, Math.cos(u * Math.PI * 3) * 0.74];
}

function sheetBase(index: number): Vec3 {
  return [-3.5 + index * 0.33, 1.4 + Math.sin(index * 0.55) * 0.16, -0.9 + Math.sin(index * 0.55) * 0.25];
}

let conformerSeq = 0;

export function createConformation(template: ConformerTemplate, name?: string): Conformation {
  const id = `conf-${Date.now().toString(36)}-${(conformerSeq++).toString(36)}`;
  const missing = new Set(template.excludeResidueIds);

  // 关键：每个残基坐标都由该构象自己的变换计算；缺失残基直接不进入 residues，
  // 下游任何选择都不可能拿到另一个构象的坐标。
  const residues: Residue[] = canonicalResidues
    .filter(item => !missing.has(item.id))
    .map(item => {
      const [x, y, z] = transformPoint(referenceCoords[item.id], template.transform, item.id);
      return { ...item, x, y, z };
    });

  const ligand: Ligand | null = template.hasLigand && template.ligandPose
    ? {
        ...ligandTemplate,
        position: template.ligandPose.position,
        rotationY: template.ligandPose.rotationY,
      }
    : null;

  const helix = Array.from({ length: HELIX_COUNT }, (_, index) => transformPoint(helixBase(index), template.transform, 900 + index));
  const sheet = Array.from({ length: SHEET_COUNT }, (_, index) => transformPoint(sheetBase(index), template.transform, 800 + index));

  return {
    id,
    name: name ?? template.defaultName,
    pdbCode: template.pdbCode,
    stateLabel: template.stateLabel,
    color: template.color,
    visible: true,
    opacity: 1,
    transform: template.transform,
    residues,
    missingResidueIds: template.excludeResidueIds,
    ligand,
    backbone: { helix, sheet },
    metrics: template.metrics,
  };
}

/** 标准序列（用于列表与缺失提示） */
export const canonicalSequence = canonicalResidues;

export function roleLabel(role: Role): string {
  return role === 'active' ? '结合活性位点' : role === 'support' ? '口袋支撑' : '柔性环区';
}

export function interactionKind(role: Role): string {
  return role === 'active' ? '氢键 / 极性' : role === 'support' ? 'π-堆积 / 疏水' : '范德华力';
}

/** 残基到配体几何中心的距离（Å），完全使用当前构象的坐标；无配体时返回 null */
export function ligandDistance(residue: Residue, ligand: Ligand | null): number | null {
  if (!ligand || ligand.atoms.length === 0) return null;
  const c = ligandCenter(ligand);
  return Math.hypot(residue.x - c[0], residue.y - c[1], residue.z - c[2]);
}

/** 配体在世界坐标系中的几何中心 */
export function ligandCenter(ligand: Ligand): Vec3 {
  if (ligand.atoms.length === 0) return ligand.position;
  const cos = Math.cos(ligand.rotationY);
  const sin = Math.sin(ligand.rotationY);
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const atom of ligand.atoms) {
    const rx = atom.x * cos + atom.z * sin;
    const rz = -atom.x * sin + atom.z * cos;
    sx += rx;
    sy += atom.y;
    sz += rz;
  }
  const n = ligand.atoms.length;
  return [ligand.position[0] + sx / n, ligand.position[1] + sy / n, ligand.position[2] + sz / n];
}

export function atomRole(atom: LigandAtom): string {
  if (atom.element === 'N') return '供体';
  if (atom.element === 'O') return '受体';
  return '骨架';
}

/** 该构象默认选中的残基 / 原子 */
export function defaultSelection(conf: Conformation): { residueId: number; atomId: string } {
  return {
    residueId: conf.residues[0]?.id ?? canonicalResidues[0].id,
    atomId: conf.ligand?.atoms.find(a => a.element === 'N')?.id ?? conf.ligand?.atoms[0]?.id ?? '',
  };
}

/** 为录入表单生成一个不与现有名称冲突的构象名 */
export function uniqueConformerName(base: string, names: string[]): string {
  if (!names.includes(base)) return base;
  let i = 2;
  while (names.includes(`${base} ${i}`)) i += 1;
  return `${base} ${i}`;
}
