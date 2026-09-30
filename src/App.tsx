import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  BONDS,
  ELEMENT_COLORS,
  LIGAND_OFFSET,
  LIGAND_TEMPLATE,
  PALETTE,
  RESIDUE_META,
  buildDemoConformers,
  defaultSelection,
  deformPoints,
  duplicateConformer,
  helixPoints,
  nearestLigandAtom,
  parseConformerInput,
  sheetPoints,
  type Conformer,
  type DisplayMode,
  type Selection
} from './conformers';

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

/** 单个构象的 3D 呈现：颜色/透明度独立；仅当前分析构象可交互，缺失残基/配体不渲染 */
function ConformerMesh({
  conf,
  isCurrent,
  selection,
  onSelectResidue,
  onSelectAtom,
  mode,
  ligandRotation
}: {
  conf: Conformer;
  isCurrent: boolean;
  selection: Selection;
  onSelectResidue: (id: number) => void;
  onSelectAtom: (id: string) => void;
  mode: DisplayMode;
  ligandRotation: number;
}) {
  const transparent = conf.opacity < 1;
  const materialProps = { transparent, opacity: conf.opacity, depthWrite: !transparent };
  const ribbon = useMemo(() => deformPoints(helixPoints, conf.phase, 0.28), [conf.phase]);
  const sheet = useMemo(() => deformPoints(sheetPoints, conf.phase * 1.3, 0.22), [conf.phase]);
  const presentResidues = RESIDUE_META.filter(meta => conf.residueCoords[meta.id] !== undefined);
  const presentAtoms = LIGAND_TEMPLATE.filter(atom => conf.ligandPresent && conf.ligandCoords[atom.id] !== undefined);

  const pointerOn = isCurrent ? () => { document.body.style.cursor = 'pointer'; } : undefined;
  const pointerOff = isCurrent ? () => { document.body.style.cursor = 'auto'; } : undefined;

  return (
    <group>
      <Text
        position={[ribbon[0].x, ribbon[0].y + 0.55, ribbon[0].z]}
        fontSize={0.17}
        color={conf.color}
        anchorX="left"
        outlineWidth={0.02}
        outlineColor="#061218"
      >
        {conf.name}
      </Text>
      <Line points={ribbon} color={conf.color} lineWidth={mode === 'surface' ? 11 : 5} {...materialProps} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      <Line points={sheet} color={conf.color} lineWidth={mode === 'surface' ? 12 : 6} {...materialProps} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      {presentResidues.map(meta => {
        const coords = conf.residueCoords[meta.id]!;
        const selected = isCurrent && selection.residueId === meta.id;
        const radius = mode === 'atoms' ? (selected ? 0.3 : 0.24) : (selected ? 0.28 : 0.18);
        return (
          <group key={meta.id} position={coords}>
            <mesh
              onClick={isCurrent ? event => { event.stopPropagation(); onSelectResidue(meta.id); } : undefined}
              onPointerOver={pointerOn}
              onPointerOut={pointerOff}
            >
              <sphereGeometry args={[radius, 16, 12]} />
              <meshStandardMaterial
                color={conf.color}
                emissive={selected ? '#ffffff' : '#000000'}
                emissiveIntensity={selected ? 0.55 : 0}
                {...materialProps}
              />
            </mesh>
            {isCurrent && (
              <Text
                position={[0, radius + 0.22, 0]}
                fontSize={0.13}
                color={selected ? '#ffe9a2' : '#8baeb9'}
                anchorX="center"
                outlineWidth={0.015}
                outlineColor="#061218"
              >
                {meta.code}
              </Text>
            )}
          </group>
        );
      })}
      {conf.ligandPresent && (
        <group position={[LIGAND_OFFSET.x, LIGAND_OFFSET.y, LIGAND_OFFSET.z]} rotation={[0, ligandRotation, 0]}>
          {BONDS.map(([from, to]) => {
            const a = conf.ligandCoords[from];
            const b = conf.ligandCoords[to];
            if (a === undefined || b === undefined) return null;
            return (
              <Line
                key={`${from}-${to}`}
                points={[new THREE.Vector3(...a), new THREE.Vector3(...b)]}
                color={conf.color}
                lineWidth={3}
                transparent
                opacity={conf.opacity}
                depthWrite={!transparent}
              />
            );
          })}
          {presentAtoms.map(atom => {
            const coords = conf.ligandCoords[atom.id]!;
            const selected = isCurrent && selection.atomId === atom.id;
            return (
              <mesh
                key={atom.id}
                position={coords}
                onClick={isCurrent ? event => { event.stopPropagation(); onSelectAtom(atom.id); } : undefined}
                onPointerOver={pointerOn}
                onPointerOut={pointerOff}
              >
                <sphereGeometry args={[atom.radius * (selected ? 1.3 : 1), 16, 12]} />
                <meshStandardMaterial
                  color={ELEMENT_COLORS[atom.element]}
                  emissive={selected ? ELEMENT_COLORS[atom.element] : '#000000'}
                  emissiveIntensity={selected ? 0.7 : 0}
                  {...materialProps}
                />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}

/** 当前构象的相互作用虚线：仅连接该构象中存在的残基与配体原子 */
function InteractionLines({ conf }: { conf: Conformer }) {
  const lines = useMemo(() => {
    if (!conf.ligandPresent) return [];
    return RESIDUE_META
      .filter(meta => meta.role === 'active' && conf.residueCoords[meta.id] !== undefined)
      .flatMap(meta => {
        const start = new THREE.Vector3(...conf.residueCoords[meta.id]!);
        const hit = nearestLigandAtom(conf, start);
        if (hit === null || hit.distance > 5) return [];
        return [{ key: `${meta.id}-${hit.id}`, points: [start, hit.point] as [THREE.Vector3, THREE.Vector3] }];
      });
  }, [conf]);
  return (
    <group>
      {lines.map(line => (
        <Line key={line.key} points={line.points} color="#eac66c" lineWidth={2.5} dashed dashSize={0.16} gapSize={0.12} transparent opacity={0.9} depthWrite={false} />
      ))}
    </group>
  );
}

export default function App() {
  const [conformers, setConformers] = useState<Conformer[]>(buildDemoConformers);
  const [currentId, setCurrentId] = useState<string | null>(() => conformers[0]?.id ?? null);
  const [mode, setMode] = useState<DisplayMode>('cartoon');
  const [selMap, setSelMap] = useState<Record<string, Selection>>({});
  const [ligandRotation, setLigandRotation] = useState(0.2);
  const [showInteractions, setShowInteractions] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const current = conformers.find(item => item.id === currentId) ?? conformers[0] ?? null;
  const selection: Selection = current ? (selMap[current.id] ?? defaultSelection(current)) : { residueId: null, atomId: null };

  const selectResidue = (residueId: number) => {
    if (current === null) return;
    setSelMap(prev => ({
      ...prev,
      [current.id]: { ...(prev[current.id] ?? defaultSelection(current)), residueId }
    }));
  };
  const selectAtom = (atomId: string) => {
    if (current === null) return;
    setSelMap(prev => ({
      ...prev,
      [current.id]: { ...(prev[current.id] ?? defaultSelection(current)), atomId }
    }));
  };

  const updateConformer = (id: string, patch: Partial<Conformer>) => {
    setConformers(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  /** 删除构象：后继者取同一下标（后一项前移），否则取最后一项；无后继则进入空场景 */
  const deleteConformer = (id: string) => {
    const index = conformers.findIndex(item => item.id === id);
    const next = conformers.filter(item => item.id !== id);
    if (id === current?.id) {
      const successor = next.length === 0 ? null : index < next.length ? next[index] : next[next.length - 1];
      setCurrentId(successor === null ? null : successor.id);
    }
    setSelMap(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setConformers(next);
  };

  const duplicateCurrent = () => {
    const source = current ?? conformers[0];
    if (source === undefined) return;
    const copy = duplicateConformer(source, `${source.name} · 副本`, PALETTE[conformers.length % PALETTE.length]);
    setConformers(prev => [...prev, copy]);
    setCurrentId(copy.id);
  };

  const loadDemo = () => {
    const demo = buildDemoConformers();
    setConformers(demo);
    setCurrentId(demo[0]?.id ?? null);
    setSelMap({});
  };

  const submitInput = () => {
    try {
      const conf = parseConformerInput(inputText);
      setConformers(prev => [...prev, conf]);
      setCurrentId(conf.id);
      setInputError(null);
      setInputText('');
      setShowInput(false);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : '解析失败，请检查数据格式');
    }
  };

  const selectedMeta = RESIDUE_META.find(item => item.id === selection.residueId) ?? null;
  const residuePresent = current !== null && selectedMeta !== null && current.residueCoords[selectedMeta.id] !== undefined;
  const residueCoords = residuePresent && current !== null && selectedMeta !== null ? current.residueCoords[selectedMeta.id]! : null;
  const ligandHit = useMemo(() => {
    if (current === null || residueCoords === null) return null;
    return nearestLigandAtom(current, new THREE.Vector3(...residueCoords));
  }, [current, residueCoords]);
  const ligandDistance = ligandHit === null ? null : ligandHit.distance;

  const metrics = useMemo(() => {
    if (current === null) return null;
    const activePresent = RESIDUE_META.filter(item => item.role === 'active' && current.residueCoords[item.id] !== undefined);
    const hydrogenBonds = current.ligandPresent
      ? activePresent.filter(item => {
          const hit = nearestLigandAtom(current, new THREE.Vector3(...current.residueCoords[item.id]!));
          return hit !== null && hit.distance < 4.2;
        }).length
      : 0;
    return {
      volume: Math.round(430 + current.phase * 47 + activePresent.length * 15),
      residueCount: activePresent.length,
      hydrogenBonds
    };
  }, [current]);

  const selectedAtomMeta = LIGAND_TEMPLATE.find(item => item.id === selection.atomId) ?? null;
  const atomPresent = current?.ligandPresent === true && selectedAtomMeta !== null && current.ligandCoords[selectedAtomMeta.id] !== undefined;
  const presentResidueCount = RESIDUE_META.filter(item => current?.residueCoords[item.id] !== undefined).length;
  const presentLigandAtoms = LIGAND_TEMPLATE.filter(item => current?.ligandCoords[item.id] !== undefined);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <span className="eyebrow">STRUCTURAL BIOLOGY / MULTI-CONFORMER WORKSPACE</span>
            <h1>Protein Atlas <span>·</span> 多构象结构对比</h1>
          </div>
        </div>
        <div className="header-meta">
          <span className="dataset">PDB-LITE / 1MOL{current === null ? '' : ` · ${current.name}`}</span>
          <button onClick={() => setShowInteractions(value => !value)}>{showInteractions ? '隐藏相互作用' : '显示相互作用'}</button>
          <button onClick={() => setLigandRotation(value => value + 0.35)}>旋转配体 ↻</button>
        </div>
      </header>
      <main className="layout">
        <section className="model-card">
          <div className="model-head">
            <div>
              <span className="eyebrow">MOLECULAR VIEWER</span>
              <h2>蛋白质结合口袋 · {current === null ? '无构象' : current.name}</h2>
            </div>
            <div className="mode-switch">
              {(['cartoon', 'surface', 'atoms'] as DisplayMode[]).map(item => (
                <button key={item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>
                  {item === 'cartoon' ? '卡通带状' : item === 'surface' ? '表面模型' : '原子视图'}
                </button>
              ))}
            </div>
          </div>
          <div className="canvas-wrap">
            {conformers.length === 0 ? (
              <div className="empty-scene">
                <div className="empty-icon">◇</div>
                <p>暂无结构构象</p>
                <small>加载示例构象，或从右侧「录入数据」粘贴 JSON / PDB 结构</small>
                <button className="primary" onClick={loadDemo}>加载示例构象</button>
              </div>
            ) : (
              <Canvas shadows camera={{ position: [8, 5.5, 9], fov: 40 }}>
                <color attach="background" args={['#09151d']} />
                <ambientLight intensity={1.2} />
                <directionalLight position={[5, 8, 5]} intensity={2.4} castShadow />
                <pointLight position={[-4, 3, 3]} color="#7fe0ff" intensity={18} distance={11} />
                <group rotation={[0.08, -0.25, 0]}>
                  {conformers.filter(item => item.visible).map(item => (
                    <ConformerMesh
                      key={item.id}
                      conf={item}
                      isCurrent={item.id === current?.id}
                      selection={item.id === current?.id ? selection : { residueId: null, atomId: null }}
                      onSelectResidue={selectResidue}
                      onSelectAtom={selectAtom}
                      mode={mode}
                      ligandRotation={ligandRotation}
                    />
                  ))}
                  {showInteractions && current?.ligandPresent === true && <InteractionLines conf={current} />}
                </group>
                <ContactShadows position={[0, -1.5, 0]} opacity={0.32} scale={10} blur={2.5} />
                <OrbitControls makeDefault minDistance={5} maxDistance={16} />
              </Canvas>
            )}
            <div className="viewer-legend">
              <span><i className="dot protein" />蛋白骨架</span>
              <span><i className="dot ligand" />配体原子</span>
              <span><i className="dot interaction" />相互作用</span>
            </div>
            <div className="viewer-hint">左键旋转 · 滚轮缩放 · 点击当前构象残基或原子</div>
          </div>
        </section>
        <aside className="sidebar">
          <section className="panel intro-panel">
            <span className="eyebrow">ACTIVE SITE</span>
            <h3>结合口袋分析</h3>
            <p>同一蛋白的多个构象在同一坐标系中叠合对比。每个构象独立控制显示、透明度与颜色；残基、配体、相互作用与指标均归属于当前分析构象，缺失坐标不会被替代。</p>
            <div className="metrics">
              <Metric label="口袋体积" value={metrics === null ? '—' : `${metrics.volume} Å³`} note={current === null ? '无构象' : '预测区域'} />
              <Metric label="结合残基" value={metrics === null ? '—' : String(metrics.residueCount)} note="active / 存在" />
              <Metric label="氢键" value={metrics === null ? '—' : String(metrics.hydrogenBonds)} note="几何筛选 < 4.2Å" />
            </div>
          </section>

          <section className="panel conformer-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">CONFORMERS</span>
                <h3>构象列表</h3>
              </div>
              <span className="count">{conformers.length}</span>
            </div>
            <div className="conformer-list">
              {conformers.length === 0 && <div className="conformer-empty">暂无构象，加载示例或录入数据开始对比</div>}
              {conformers.map(item => {
                const isCurrent = item.id === current?.id;
                return (
                  <div key={item.id} className={isCurrent ? 'conformer current' : 'conformer'}>
                    <div className="conformer-select" role="button" onClick={() => setCurrentId(item.id)}>
                      <span className={isCurrent ? 'conf-radio on' : 'conf-radio'} />
                      <input
                        type="color"
                        className="conf-swatch"
                        value={item.color}
                        title="点击修改构象颜色"
                        onClick={event => event.stopPropagation()}
                        onChange={event => updateConformer(item.id, { color: event.target.value })}
                      />
                      <span className="conf-name">
                        {item.name}
                        {isCurrent && <em className="conf-tag">当前分析</em>}
                      </span>
                    </div>
                    <div className="conf-actions">
                      <button
                        className={item.visible ? 'conf-vis on' : 'conf-vis'}
                        title={item.visible ? '隐藏此构象' : '显示此构象'}
                        onClick={() => updateConformer(item.id, { visible: !item.visible })}
                      >
                        {item.visible ? '显示' : '隐藏'}
                      </button>
                      <button className="conf-del" title="删除此构象" onClick={() => deleteConformer(item.id)}>✕</button>
                    </div>
                    <div className="conf-opacity">
                      <span>透明度</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={item.opacity}
                        onChange={event => updateConformer(item.id, { opacity: Number.parseFloat(event.target.value) })}
                      />
                      <em>{Math.round(item.opacity * 100)}%</em>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="conformer-add">
              <button className="add-btn" onClick={duplicateCurrent} disabled={conformers.length === 0}>＋ 复制当前构象</button>
              <button className="add-btn" onClick={() => { setShowInput(value => !value); setInputError(null); }}>录入数据</button>
              <button className="add-btn" onClick={loadDemo}>加载示例</button>
            </div>
            {showInput && (
              <div className="conformer-input">
                <textarea
                  value={inputText}
                  onChange={event => setInputText(event.target.value)}
                  rows={8}
                  placeholder={'支持 JSON 或 PDB 格式：\n{"name":"构象 D","residues":{"41":[-1.6,0.4,0.5],"78":[-0.7,1.15,-0.25]},"ligand":{"present":true,"atoms":{"N1":[0.98,-0.18,0.18]}}}\n\n或粘贴 PDB 的 ATOM / HETATM 记录（CA 坐标自动居中缩放）'}
                />
                {inputError && <div className="input-error">⚠ {inputError}</div>}
                <div className="input-actions">
                  <button className="primary" onClick={submitInput}>解析并加入构象</button>
                  <button onClick={() => { setShowInput(false); setInputError(null); }}>取消</button>
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">RESIDUES{current === null ? '' : ` · ${current.name}`}</span>
                <h3>关键残基</h3>
              </div>
              <span className="count">{presentResidueCount}/{RESIDUE_META.length}</span>
            </div>
            <div className="residue-list">
              {RESIDUE_META.map(meta => {
                const present = current?.residueCoords[meta.id] !== undefined;
                const selected = selection.residueId === meta.id;
                return (
                  <button
                    key={meta.id}
                    className={['residue', selected ? 'selected' : '', present ? '' : 'missing'].join(' ')}
                    onClick={() => selectResidue(meta.id)}
                  >
                    <span className="residue-color" style={{ background: present ? meta.color : '#3a4d56' }} />
                    <span>
                      <b>{meta.code}</b>
                      <small>{meta.name}</small>
                    </span>
                    {present
                      ? <em>{meta.role === 'active' ? 'ACTIVE' : meta.role === 'support' ? 'SUPPORT' : 'LOOP'}</em>
                      : <em className="missing-tag">缺失</em>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel detail-panel">
            <span className="eyebrow">SELECTED RESIDUE{current === null ? '' : ` · ${current.name}`}</span>
            {selectedMeta === null ? (
              <div className="missing-box">
                <strong>未选择残基</strong>
                <p>从上方残基列表或 3D 视图中选择一个残基查看详情。</p>
              </div>
            ) : !residuePresent ? (
              <div className="missing-box">
                <strong>残基缺失 · {selectedMeta.code}</strong>
                <p>「{current?.name ?? '当前构象'}」中不存在 {selectedMeta.code}（{selectedMeta.name}）的坐标——该残基可能未解析或被突变替换。场景不会用其他构象的坐标替代它。</p>
              </div>
            ) : (
              <>
                <div className="detail-title">
                  <h3>{selectedMeta.code}</h3>
                  <span>{selectedMeta.name}</span>
                </div>
                <div className="detail-grid">
                  <div>
                    <span>空间坐标</span>
                    <b>{residueCoords![0].toFixed(2)} / {residueCoords![1].toFixed(2)} / {residueCoords![2].toFixed(2)} Å</b>
                  </div>
                  <div>
                    <span>残基角色</span>
                    <b>{selectedMeta.role === 'active' ? '结合活性位点' : selectedMeta.role === 'support' ? '口袋支撑' : '柔性环区'}</b>
                  </div>
                  <div>
                    <span>配体距离</span>
                    <b>{current?.ligandPresent === true && ligandDistance !== null ? `${ligandDistance.toFixed(2)} Å` : '—（无配体）'}</b>
                  </div>
                  <div>
                    <span>相互作用</span>
                    <b>{selectedMeta.role === 'active' ? (ligandDistance !== null && ligandDistance < 4.2 ? '氢键 / 极性' : '远端位点') : '范德华力'}</b>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="panel atom-panel">
            <span className="eyebrow">LIGAND ATOM{current === null ? '' : ` · ${current.name}`}</span>
            {current === null || !current.ligandPresent ? (
              <div className="missing-box">
                <strong>apo 状态 · 无配体</strong>
                <p>「{current?.name ?? '当前构象'}」未结合配体，该构象无配体原子坐标可分析。</p>
              </div>
            ) : (
              <>
                <div className="atom-row">
                  <span className="atom-badge">{selectedAtomMeta === null ? '?' : selectedAtomMeta.element}</span>
                  <div>
                    <b>{selectedAtomMeta === null ? '未选择' : selectedAtomMeta.id}</b>
                    <small>点击模型中的配体原子切换</small>
                  </div>
                  <span className="atom-value">
                    {selectedAtomMeta === null ? '—' : selectedAtomMeta.element === 'N' ? '供体' : selectedAtomMeta.element === 'O' ? '受体' : '骨架'}
                  </span>
                </div>
                <div className="atom-chips">
                  {presentLigandAtoms.map(atom => (
                    <button
                      key={atom.id}
                      className={selection.atomId === atom.id ? 'chip active' : 'chip'}
                      onClick={() => selectAtom(atom.id)}
                    >
                      {atom.id}
                    </button>
                  ))}
                  {presentLigandAtoms.length === 0 && <span className="chips-empty">配体无可用原子</span>}
                </div>
              </>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
