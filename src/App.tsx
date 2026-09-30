import { useMemo, useState } from 'react';
import Viewer from './components/Viewer';
import { AtomPanel, ConformerPanel, DetailPanel, MetricsPanel, ResiduePanel } from './components/panels';
import type { Conformation, ConformerTemplate, DisplayMode } from './model/types';
import { createConformation, defaultSelection, getTemplate, uniqueConformerName } from './model/conformers';

function initialConformations() {
  return [getTemplate('open'), getTemplate('closed'), getTemplate('apo')].map(t => createConformation(t));
}

export default function App() {
  const [conformations, setConformations] = useState(initialConformations);
  const [currentId, setCurrentId] = useState<string | null>(() => null);
  const [selectedResidueId, setSelectedResidueId] = useState<number>(102);
  const [selectedAtomId, setSelectedAtomId] = useState<string>('N1');
  const [mode, setMode] = useState<DisplayMode>('cartoon');
  const [showInteractions, setShowInteractions] = useState(true);

  // 保证 currentId 始终指向现存构象（健壮性兜底；正常切换路径下不会触发）
  const current = useMemo(() => {
    if (conformations.length === 0) return undefined;
    return conformations.find(conf => conf.id === currentId) ?? conformations[0];
  }, [conformations, currentId]);
  const effectiveCurrentId = current?.id ?? null;

  const updateConformer = (id: string, patch: Partial<Conformation>) =>
    setConformations(list => list.map(conf => (conf.id === id ? { ...conf, ...patch } : conf)));

  const switchCurrent = (id: string) => setCurrentId(id);

  /** 3D 中点击任何构象的残基：先把该构象设为当前，再选中它自己的残基 */
  const pickResidue = (conformerId: string, residueId: number) => {
    setCurrentId(conformerId);
    setSelectedResidueId(residueId);
  };

  /** 3D 中点击任何构象的配体原子：原子 id 只在该构象自己的配体中有效 */
  const pickAtom = (conformerId: string, atomId: string) => {
    setCurrentId(conformerId);
    setSelectedAtomId(atomId);
  };

  const loadConformer = (template: ConformerTemplate, customName: string) => {
    const name = uniqueConformerName(
      customName || template.defaultName,
      conformations.map(conf => conf.name),
    );
    const conf = createConformation(template, name);
    setConformations(list => [...list, conf]);
    // 新加载的构象成为当前分析对象，并落到它自己的合法选择上
    setCurrentId(conf.id);
    setSelectedResidueId(defaultSelection(conf).residueId);
    setSelectedAtomId(defaultSelection(conf).atomId);
  };

  /** 删除构象：优先选择后继（同位置的下一个），末尾删除则选择新的末尾，保证始终有稳定的当前对象 */
  const removeConformer = (id: string) => {
    const index = conformations.findIndex(conf => conf.id === id);
    if (index === -1) return;
    const wasCurrent = id === effectiveCurrentId;
    const next = conformations.slice(0, index).concat(conformations.slice(index + 1));
    setConformations(next);

    if (next.length === 0) {
      setCurrentId(null);
      setSelectedAtomId('');
      return;
    }
    if (wasCurrent) {
      // 后继优先（删除最后一个时退化为前驱，即新末尾），不依赖被删对象
      const successor = next[Math.min(index, next.length - 1)];
      setCurrentId(successor.id);
      const sel = defaultSelection(successor);
      setSelectedResidueId(sel.residueId);
      setSelectedAtomId(sel.atomId);
    } else if (effectiveCurrentId !== null) {
      // 删除的是非当前构象：校验当前选择在它自己的构象中仍然合法
      const stillCurrent = next.find(conf => conf.id === effectiveCurrentId);
      if (stillCurrent) {
        if (!stillCurrent.residues.some(r => r.id === selectedResidueId)) {
          setSelectedResidueId(defaultSelection(stillCurrent).residueId);
        }
        if (!stillCurrent.ligand?.atoms.some(a => a.id === selectedAtomId)) {
          setSelectedAtomId(defaultSelection(stillCurrent).atomId);
        }
      }
    }
  };

  const resetWorkspace = () => {
    const list = initialConformations();
    setConformations(list);
    const first = list[0];
    setCurrentId(first.id);
    setSelectedResidueId(defaultSelection(first).residueId);
    setSelectedAtomId(defaultSelection(first).atomId);
  };

  const rotateLigand = () => {
    if (!current?.ligand) return;
    const ligand = current.ligand;
    updateConformer(current.id, { ligand: { ...ligand, rotationY: ligand.rotationY + 0.35 } });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <span className="eyebrow">STRUCTURAL BIOLOGY / ANALYSIS WORKSPACE</span>
            <h1>
              Protein Atlas <span>·</span> 多构象结构对比工作区
            </h1>
          </div>
        </div>
        <div className="header-meta">
          <span className="dataset">
            {conformations.length} 个构象{current ? ` / 当前：${current.name} · ${current.pdbCode}` : ' / 空工作区'}
          </span>
          <button onClick={() => setShowInteractions(value => !value)}>
            {showInteractions ? '隐藏相互作用' : '显示相互作用'}
          </button>
          <button onClick={rotateLigand} disabled={!current?.ligand} title={current?.ligand ? '旋转当前构象配体' : '当前构象无配体'}>
            旋转配体 ↻
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="model-card">
          <div className="model-head">
            <div>
              <span className="eyebrow">MOLECULAR VIEWER</span>
              <h2>
                {current
                  ? <>蛋白质结合口袋对比 · 当前分析：<span className="head-conf-name" style={{ color: current.color }}>{current.name}</span></>
                  : '蛋白质结合口袋对比'}
              </h2>
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
            <Viewer
              conformations={conformations}
              currentId={effectiveCurrentId}
              selectedResidueId={selectedResidueId}
              selectedAtomId={selectedAtomId}
              displayMode={mode}
              showInteractions={showInteractions}
              onPickResidue={pickResidue}
              onPickAtom={pickAtom}
            />
            {conformations.length === 0 && (
              <div className="viewer-empty">
                <div className="viewer-empty-card">
                  <b>场景为空</b>
                  <span>所有构象均已删除，3D 场景仍可渲染</span>
                  <button onClick={resetWorkspace}>加载示例构象</button>
                </div>
              </div>
            )}
            <div className="viewer-legend">
              {conformations.filter(conf => conf.visible).map(conf => (
                <span key={conf.id} className={conf.id === effectiveCurrentId ? 'legend-conf current' : 'legend-conf'}>
                  <i className="dot" style={{ background: conf.color }} />
                  {conf.name}
                </span>
              ))}
              {showInteractions && current?.ligand && (
                <span><i className="dot interaction" />相互作用（当前）</span>
              )}
            </div>
            <div className="viewer-hint">左键旋转 · 滚轮缩放 · 点击残基或原子会同时切换所属构象</div>
          </div>
        </section>

        <aside className="sidebar">
          <ConformerPanel
            conformations={conformations}
            currentId={effectiveCurrentId}
            onSwitch={switchCurrent}
            onToggleVisible={id => updateConformer(id, { visible: !conformations.find(c => c.id === id)?.visible })}
            onSetColor={(id, color) => updateConformer(id, { color })}
            onSetOpacity={(id, opacity) => updateConformer(id, { opacity })}
            onRemove={removeConformer}
            onLoad={loadConformer}
            onResetWorkspace={resetWorkspace}
          />
          {current ? (
            <>
              <MetricsPanel current={current} />
              <ResiduePanel current={current} selectedResidueId={selectedResidueId} onSelect={setSelectedResidueId} />
              <DetailPanel current={current} selectedResidueId={selectedResidueId} onSelect={setSelectedResidueId} />
              <AtomPanel current={current} selectedAtomId={selectedAtomId} onSelect={setSelectedAtomId} onRotate={rotateLigand} />
            </>
          ) : (
            <section className="panel">
              <span className="eyebrow">NO ACTIVE CONFORMER</span>
              <h3>无当前分析对象</h3>
              <p className="panel-note">加载或录入一个构象后，残基、配体、指标与详情将在此显示。</p>
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}
