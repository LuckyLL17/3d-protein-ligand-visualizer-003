import { Canvas } from '@react-three/fiber';
import { ContactShadows, Line, OrbitControls, Text } from '@react-three/drei';
import type * as THREE from 'three';
import type { Conformation, DisplayMode, LigandAtom, Residue, Vec3 } from '../model/types';
import { ligandCenter } from '../model/conformers';

const ELEMENT_COLOR: Record<LigandAtom['element'], string> = {
  C: '#d6e1e4',
  N: '#54b9e3',
  O: '#ec7474',
  S: '#e7c35f',
};

interface ViewerProps {
  conformations: Conformation[];
  currentId: string | null;
  selectedResidueId: number;
  selectedAtomId: string;
  displayMode: DisplayMode;
  showInteractions: boolean;
  onPickResidue: (conformerId: string, residueId: number) => void;
  onPickAtom: (conformerId: string, atomId: string) => void;
}

function LigandView({
  conformer,
  isCurrent,
  selectedAtomId,
  onPickAtom,
}: {
  conformer: Conformation;
  isCurrent: boolean;
  selectedAtomId: string;
  onPickAtom: ViewerProps['onPickAtom'];
}) {
  const ligand = conformer.ligand;
  if (!ligand) return null;
  const opacity = conformer.opacity;
  const dim = opacity < 0.99;
  const atomColor = (atom: LigandAtom) => (atom.element === 'C' ? conformer.color : ELEMENT_COLOR[atom.element]);
  return (
    <group position={ligand.position} rotation={[0, ligand.rotationY, 0]}>
      {ligand.bonds.map(([from, to]) => {
        const a = ligand.atoms.find(item => item.id === from);
        const b = ligand.atoms.find(item => item.id === to);
        // 键两端缺原子时不绘制（不拿其它构象的原子位置顶替）
        if (!a || !b) return null;
        return (
          <Line
            key={`${from}-${to}`}
            points={[[a.x, a.y, a.z], [b.x, b.y, b.z]]}
            color={dim ? conformer.color : '#cbd9dc'}
            lineWidth={isCurrent ? 3 : 2}
            transparent={dim}
            opacity={opacity}
          />
        );
      })}
      {ligand.atoms.map(atom => {
        const selected = isCurrent && selectedAtomId === atom.id;
        return (
          <mesh
            key={atom.id}
            position={[atom.x, atom.y, atom.z]}
            onClick={event => {
              event.stopPropagation();
              onPickAtom(conformer.id, atom.id);
            }}
          >
            <sphereGeometry args={[atom.radius * (selected ? 1.35 : 1), 16, 12]} />
            <meshStandardMaterial
              color={atomColor(atom)}
              emissive={selected ? conformer.color : '#000000'}
              emissiveIntensity={selected ? 0.7 : 0}
              transparent={dim}
              opacity={opacity}
              depthWrite={!dim}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** 当前构象的相互作用：活性残基 → 配体中心，坐标全部来自该构象自身 */
function InteractionLayer({ conformer }: { conformer: Conformation }) {
  if (!conformer.ligand) return null;
  const center = ligandCenter(conformer.ligand);
  return (
    <>
      {conformer.residues
        .filter(item => item.role === 'active')
        .map(item => {
          const points: Vec3[] = [
            [item.x, item.y, item.z],
            [center[0] * 0.38 + item.x * 0.62, center[1] * 0.34 + item.y * 0.66, center[2] * 0.38 + item.z * 0.62],
          ];
          return <Line key={`int-${item.id}`} points={points} color="#eac66c" lineWidth={2} dashed dashSize={0.12} gapSize={0.09} />;
        })}
      <mesh position={center}>
        <octahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial color={conformer.color} emissive={conformer.color} emissiveIntensity={0.5} transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </>
  );
}

function ConformerView({
  conformer,
  isCurrent,
  displayMode,
  selectedResidueId,
  selectedAtomId,
  showInteractions,
  onPickResidue,
  onPickAtom,
}: {
  conformer: Conformation;
  isCurrent: boolean;
  displayMode: DisplayMode;
  selectedResidueId: number;
  selectedAtomId: string;
  showInteractions: boolean;
} & Pick<ViewerProps, 'onPickResidue' | 'onPickAtom'>) {
  if (!conformer.visible) return null;
  const opacity = conformer.opacity;
  const dim = opacity < 0.99;
  const surface = displayMode === 'surface';
  const atomsMode = displayMode === 'atoms';

  const residueMesh = (residue: Residue) => {
    const selected = isCurrent && selectedResidueId === residue.id;
    return (
      <group key={`res-${conformer.id}-${residue.id}`} position={[residue.x, residue.y, residue.z]}>
        <mesh
          onClick={event => {
            event.stopPropagation();
            onPickResidue(conformer.id, residue.id);
          }}
        >
          <sphereGeometry args={[selected ? 0.28 : 0.18, 16, 12]} />
          <meshStandardMaterial
            color={residue.color}
            emissive={selected ? residue.color : '#000000'}
            emissiveIntensity={selected ? 0.8 : 0}
            transparent={dim || surface}
            opacity={surface ? Math.min(opacity, 0.9) : opacity}
            depthWrite={!dim}
          />
        </mesh>
        {isCurrent && (
          <Text position={[0, 0.43, 0]} fontSize={0.14} color={selected ? '#ffe9a2' : '#8baeb9'} anchorX="center">
            {residue.code}
          </Text>
        )}
      </group>
    );
  };

  return (
    <group>
      {!atomsMode && (
        <>
          <Line points={conformer.backbone.helix as unknown as THREE.Vector3[]} color={conformer.color} lineWidth={surface ? 12 : 5} transparent={dim} opacity={opacity} />
          <Line points={conformer.backbone.sheet as unknown as THREE.Vector3[]} color={conformer.color} lineWidth={surface ? 13 : 6} transparent={dim} opacity={opacity} />
        </>
      )}
      {atomsMode &&
        conformer.residues.map(residue => (
          <mesh key={`atm-${conformer.id}-${residue.id}`} position={[residue.x, residue.y, residue.z]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshStandardMaterial color={residue.color} transparent={dim} opacity={opacity} depthWrite={!dim} />
          </mesh>
        ))}
      {conformer.residues.map(residueMesh)}
      <LigandView conformer={conformer} isCurrent={isCurrent} selectedAtomId={selectedAtomId} onPickAtom={onPickAtom} />
      {isCurrent && showInteractions && <InteractionLayer conformer={conformer} />}
    </group>
  );
}

export default function Viewer(props: ViewerProps) {
  const { conformations, currentId, displayMode, selectedResidueId, selectedAtomId, showInteractions, onPickResidue, onPickAtom } = props;
  return (
    <Canvas shadows camera={{ position: [8, 5.5, 9], fov: 40 }}>
      <color attach="background" args={['#09151d']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 8, 5]} intensity={2.4} castShadow />
      <pointLight position={[-4, 3, 3]} color="#7fe0ff" intensity={18} distance={11} />
      <group rotation={[0.08, -0.25, 0]}>
        {conformations.map(conformer => (
          <ConformerView
            key={conformer.id}
            conformer={conformer}
            isCurrent={conformer.id === currentId}
            displayMode={displayMode}
            selectedResidueId={selectedResidueId}
            selectedAtomId={selectedAtomId}
            showInteractions={showInteractions}
            onPickResidue={onPickResidue}
            onPickAtom={onPickAtom}
          />
        ))}
      </group>
      <ContactShadows position={[0, -1.5, 0]} opacity={0.32} scale={10} blur={2.5} />
      <OrbitControls makeDefault minDistance={5} maxDistance={16} />
    </Canvas>
  );
}
