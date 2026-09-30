export type DisplayMode = 'cartoon' | 'surface' | 'atoms';
export type Role = 'active' | 'support' | 'loop';
export type ElementKind = 'C' | 'N' | 'O' | 'S';
export type Vec3 = [number, number, number];

export interface Residue {
  id: number;
  code: string;
  name: string;
  role: Role;
  color: string;
  x: number;
  y: number;
  z: number;
}

export interface LigandAtom {
  id: string;
  element: ElementKind;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface Ligand {
  code: string;
  name: string;
  /** 配体在该构象中的整体位姿 */
  position: Vec3;
  rotationY: number;
  atoms: LigandAtom[];
  bonds: [string, string][];
}

export interface Transform {
  scale: number;
  rotY: number;
  offset: Vec3;
  jitter: number;
  seed: number;
}

export interface ConformerMetrics {
  volume: string;
  hbonds: number | null;
  summary: string;
}

export type TemplateKey = 'open' | 'closed' | 'apo' | 'mutant';

export interface ConformerTemplate {
  key: TemplateKey;
  defaultName: string;
  pdbCode: string;
  stateLabel: string;
  color: string;
  transform: Transform;
  hasLigand: boolean;
  ligandPose?: { position: Vec3; rotationY: number };
  /** 该构象中未解析 / 不存在的残基 */
  excludeResidueIds: number[];
  metrics: ConformerMetrics;
}

/**
 * 一个构象是完全自包含的：坐标、残基集合、配体、指标与显示状态都属于它自己。
 * 残基在 residues 中缺席即表示该构象缺少此残基；ligand 为 null 即无配体（Apo）。
 */
export interface Conformation {
  id: string;
  name: string;
  pdbCode: string;
  stateLabel: string;
  color: string;
  visible: boolean;
  opacity: number;
  transform: Transform;
  residues: Residue[];
  missingResidueIds: number[];
  ligand: Ligand | null;
  backbone: { helix: Vec3[]; sheet: Vec3[] };
  metrics: ConformerMetrics;
}
