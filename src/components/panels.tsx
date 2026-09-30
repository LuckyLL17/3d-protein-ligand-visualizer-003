import { useState } from 'react';
import type { Conformation, ConformerTemplate, Ligand, LigandAtom, Residue, Role } from '../model/types';
import {
  atomRole,
  canonicalSequence,
  CONFORMER_TEMPLATES,
  interactionKind,
  ligandDistance,
  roleLabel,
} from '../model/conformers';

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

/* ---------------- 构象工作区 ---------------- */

interface ConformerPanelProps {
  conformations: Conformation[];
  currentId: string | null;
  onSwitch: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onSetColor: (id: string, color: string) => void;
  onSetOpacity: (id: string, opacity: number) => void;
  onRemove: (id: string) => void;
  onLoad: (template: ConformerTemplate, customName: string) => void;
  onResetWorkspace: () => void;
}

export function ConformerPanel(props: ConformerPanelProps) {
  const { conformations, currentId } = props;
  const [draftName, setDraftName] = useState('');

  return (
    <section className="panel conformer-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">CONFORMER WORKSPACE</span>
          <h3>构象工作区</h3>
        </div>
        <span className="count">{conformations.length}</span>
      </div>
      <p className="panel-note">同一蛋白的多个结构构象，可叠加对比；点击行体切换当前分析对象。</p>

      {conformations.length === 0 && (
        <div className="empty-conf">
          <span>工作区中没有构象</span>
          <small>加载示例构象以恢复 3D 场景</small>
          <button className="primary-mini" onClick={props.onResetWorkspace}>重置为示例工作区</button>
        </div>
      )}

      <div className="conf-list">
        {conformations.map(conf => {
          const active = conf.id === currentId;
          return (
            <div key={conf.id} className={active ? 'conf-row current' : 'conf-row'}>
              <button className="conf-main" onClick={() => props.onSwitch(conf.id)} title="切换为当前分析对象">
                <span className="conf-color-wrap">
                  <input
                    type="color"
                    value={conf.color}
                    onChange={event => props.onSetColor(conf.id, event.target.value)}
                    onClick={event => event.stopPropagation()}
                    title="构象颜色"
                  />
                  <i className="conf-color" style={{ background: conf.color }} />
                </span>
                <span className="conf-meta">
                  <b>{conf.name}</b>
                  <small>{conf.pdbCode} · {conf.stateLabel}{conf.ligand ? '' : ' · APO'}</small>
                </span>
                <em className="conf-badge">{active ? '当前' : '切换'}</em>
              </button>
              <div className="conf-controls" onClick={event => event.stopPropagation()}>
                <button
                  className={conf.visible ? 'eye on' : 'eye'}
                  onClick={() => props.onToggleVisible(conf.id)}
                  title={conf.visible ? '隐藏该构象' : '显示该构象'}
                >
                  {conf.visible ? '👁' : '—'}
                </button>
                <label className="opacity-control" title="不透明度">
                  <input
                    type="range"
                    min={0.15}
                    max={1}
                    step={0.05}
                    value={conf.opacity}
                    onChange={event => props.onSetOpacity(conf.id, Number(event.target.value))}
                  />
                </label>
                <button className="conf-delete" onClick={() => props.onRemove(conf.id)} title="删除该构象">
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="conf-add">
        <div className="add-head">
          <span className="eyebrow">LOAD / ENTER</span>
          <small>加载模板或录入新构象</small>
        </div>
        <input
          className="conf-name-input"
          placeholder="构象名称（可留空使用模板名）"
          value={draftName}
          onChange={event => setDraftName(event.target.value)}
        />
        <div className="template-grid">
          {CONFORMER_TEMPLATES.map(template => (
            <button
              key={template.key}
              className="template-btn"
              onClick={() => {
                props.onLoad(template, draftName.trim());
                setDraftName('');
              }}
              title={template.metrics.summary}
            >
              <i className="tpl-dot" style={{ background: template.color }} />
              {template.defaultName}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 指标（当前构象） ---------------- */

export function MetricsPanel({ current }: { current: Conformation }) {
  const activeCount = current.residues.filter(r => r.role === 'active').length;
  const supportCount = current.residues.filter(r => r.role === 'support').length;
  const resolved = current.residues.length;
  const total = canonicalSequence.length;
  return (
    <section className="panel intro-panel">
      <span className="eyebrow">ACTIVE SITE · {current.stateLabel}</span>
      <h3>结合口袋分析</h3>
      <p className="owner-line">
        <i className="tpl-dot" style={{ background: current.color }} />
        数据属于 <b>{current.name}</b>（{current.pdbCode}）。{current.metrics.summary}。
      </p>
      <div className="metrics">
        <Metric label="口袋体积" value={current.metrics.volume} note="预测区域" />
        <Metric label="结合残基" value={`${activeCount + supportCount}`} note={`${activeCount} active / ${supportCount} support`} />
        <Metric
          label="氢键"
          value={current.metrics.hbonds === null ? '—' : String(current.metrics.hbonds)}
          note={current.metrics.hbonds === null ? 'Apo · 无配体' : '几何筛选'}
        />
      </div>
      <div className="resolve-line">
        已解析残基 {resolved}/{total}
        {current.missingResidueIds.length > 0 && (
          <em> · 未解析：{current.missingResidueIds.map(id => canonicalSequence.find(r => r.id === id)?.code ?? id).join('、')}</em>
        )}
      </div>
    </section>
  );
}

/* ---------------- 残基列表（当前构象） ---------------- */

interface ResiduePanelProps {
  current: Conformation;
  selectedResidueId: number;
  onSelect: (id: number) => void;
}

export function ResiduePanel({ current, selectedResidueId, onSelect }: ResiduePanelProps) {
  const present = new Set(current.residues.map(r => r.id));
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">RESIDUES · {current.stateLabel}</span>
          <h3>关键残基</h3>
        </div>
        <span className="count">
          {current.residues.length}/{canonicalSequence.length}
        </span>
      </div>
      <div className="residue-list">
        {canonicalSequence.map(item => {
          const exists = present.has(item.id);
          if (!exists) {
            return (
              <div key={item.id} className="residue missing" title={`${item.code} 在 ${current.name} 中未解析`}>
                <span className="residue-color missing-color" />
                <span>
                  <b>{item.code}</b>
                  <small>{item.name} · 该构象未解析</small>
                </span>
                <em className="missing-tag">缺失</em>
              </div>
            );
          }
          return (
            <button
              key={item.id}
              className={selectedResidueId === item.id ? 'residue selected' : 'residue'}
              onClick={() => onSelect(item.id)}
            >
              <span className="residue-color" style={{ background: item.color }} />
              <span>
                <b>{item.code}</b>
                <small>{item.name}</small>
              </span>
              <em>{roleTag(item.role)}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function roleTag(role: Role): string {
  return role === 'active' ? 'ACTIVE' : role === 'support' ? 'SUPPORT' : 'LOOP';
}

/* ---------------- 残基详情（当前构象） ---------------- */

interface DetailPanelProps {
  current: Conformation;
  selectedResidueId: number;
  onSelect: (id: number) => void;
}

export function DetailPanel({ current, selectedResidueId, onSelect }: DetailPanelProps) {
  // 只在当前构象自己的残基集合中查找；找不到就是真的缺失，绝不回退到其它构象的坐标
  const residue: Residue | undefined = current.residues.find(r => r.id === selectedResidueId);
  const canonical = canonicalSequence.find(r => r.id === selectedResidueId);

  if (!residue) {
    return (
      <section className="panel detail-panel">
        <span className="eyebrow">SELECTED RESIDUE · {current.stateLabel}</span>
        <div className="missing-detail">
          <h3>{canonical?.code ?? `残基 ${selectedResidueId}`}</h3>
          <p>
            该残基在 <b>{current.name}</b>（{current.pdbCode}）中未解析，
            没有可显示的坐标与相互作用数据——不会使用其它构象的坐标替代。
          </p>
          <div className="missing-pick">
            <small>从此构象已解析的残基中选择：</small>
            <div className="missing-chips">
              {current.residues.map(r => (
                <button key={r.id} onClick={() => onSelect(r.id)}>{r.code}</button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const distance = ligandDistance(residue, current.ligand);
  return (
    <section className="panel detail-panel">
      <span className="eyebrow">SELECTED RESIDUE · {current.stateLabel}</span>
      <div className="detail-title">
        <h3>{residue.code}</h3>
        <span>{residue.name} · {current.name}</span>
      </div>
      <div className="detail-grid">
        <div>
          <span>空间坐标</span>
          <b>{residue.x.toFixed(2)} / {residue.y.toFixed(2)} / {residue.z.toFixed(2)} Å</b>
        </div>
        <div>
          <span>残基角色</span>
          <b>{roleLabel(residue.role)}</b>
        </div>
        <div>
          <span>配体距离</span>
          <b>{distance === null ? '—（Apo 无配体）' : `${distance.toFixed(2)} Å`}</b>
        </div>
        <div>
          <span>相互作用</span>
          <b>{current.ligand ? interactionKind(residue.role) : '无配体 · 不适用'}</b>
        </div>
      </div>
      {residue.role === 'active' && current.ligand && distance !== null && (
        <div className="interaction-note">
          <i className="dot interaction" /> 与 {current.ligand.code} 几何中心 {distance.toFixed(2)} Å，{interactionKind(residue.role)}
        </div>
      )}
    </section>
  );
}

/* ---------------- 配体原子面板（当前构象） ---------------- */

interface AtomPanelProps {
  current: Conformation;
  selectedAtomId: string;
  onSelect: (atomId: string) => void;
  onRotate: () => void;
}

export function AtomPanel({ current, selectedAtomId, onSelect, onRotate }: AtomPanelProps) {
  const ligand: Ligand | null = current.ligand;
  if (!ligand) {
    return (
      <section className="panel atom-panel">
        <span className="eyebrow">LIGAND · {current.stateLabel}</span>
        <div className="atom-row">
          <span className="atom-badge">∅</span>
          <div>
            <b>该构象无配体（Apo）</b>
            <small>{current.name} 中不存在配体坐标，未使用其它构象替代</small>
          </div>
        </div>
      </section>
    );
  }

  // 只在当前构象自己的配体原子中查找
  const atom: LigandAtom | undefined = ligand.atoms.find(a => a.id === selectedAtomId) ?? ligand.atoms[0];

  return (
    <section className="panel atom-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">LIGAND ATOM · {current.stateLabel}</span>
          <h3>{ligand.code}</h3>
        </div>
        <button className="primary-mini" onClick={onRotate}>旋转 ↻</button>
      </div>
      <div className="atom-row">
        <span className="atom-badge">{atom.element}</span>
        <div>
          <b>{atom.id}</b>
          <small>{atom.x.toFixed(2)} / {atom.y.toFixed(2)} / {atom.z.toFixed(2)}（局部坐标）</small>
        </div>
        <span className="atom-value">{atomRole(atom)}</span>
      </div>
      <div className="atom-chips">
        {ligand.atoms.map(a => (
          <button
            key={a.id}
            className={a.id === atom.id ? 'atom-chip selected' : 'atom-chip'}
            onClick={() => onSelect(a.id)}
          >
            {a.id}
          </button>
        ))}
      </div>
    </section>
  );
}
