import assert from 'node:assert';
import {
  canonicalSequence,
  createConformation,
  defaultSelection,
  getTemplate,
  ligandCenter,
  ligandDistance,
  uniqueConformerName,
} from '../src/model/conformers';

// 1. 每个构象的残基坐标都是自己的；缺失残基不进入集合
const open = createConformation(getTemplate('open'));
const closed = createConformation(getTemplate('closed'));
const apo = createConformation(getTemplate('apo'));
const mutant = createConformation(getTemplate('mutant'));

assert.strictEqual(open.residues.length, canonicalSequence.length, '开放态 7 个残基');
assert.strictEqual(closed.residues.length, 6, '闭合态缺少 SER219');
assert.strictEqual(apo.residues.length, 5, 'Apo 缺少 PHE183/GLY244');
assert.strictEqual(mutant.residues.length, 6, '突变体缺少 HIS102');
assert.ok(!closed.residues.some(r => r.id === 219));
assert.ok(!mutant.residues.some(r => r.id === 102));
assert.strictEqual(closed.missingResidueIds.includes(219), true);

// 2. 同一残基在不同构象中坐标不同（闭合态做了收缩+抖动）
const openH102 = open.residues.find(r => r.id === 102)!;
const closedH102 = closed.residues.find(r => r.id === 102)!;
assert.notDeepStrictEqual(
  [openH102.x, openH102.y, openH102.z],
  [closedH102.x, closedH102.y, closedH102.z],
  'HIS102 坐标在两构象中必须不同',
);

// 3. 确定性：同模板生成两次，坐标一致
const closed2 = createConformation(getTemplate('closed'));
for (let i = 0; i < closed.residues.length; i++) {
  const a = closed.residues[i];
  const b = closed2.residues[i];
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.z - b.z) < 1e-9, '抖动应确定');
}

// 4. Apo 无配体：距离必须为 null，不能用坐标顶替
assert.ok(open.ligand !== null);
assert.strictEqual(apo.ligand, null, 'Apo 无配体');
assert.strictEqual(ligandDistance(apo.residues[0], apo.ligand), null, '无配体距离为 null');

// 5. 距离完全使用当前构象坐标
const dOpen = ligandDistance(openH102, open.ligand)!;
const dClosed = ligandDistance(closedH102, closed.ligand)!;
assert.ok(dOpen > 0 && dClosed > 0);
assert.ok(Math.abs(dOpen - dClosed) > 1e-6, '两构象配体距离不同');

// 6. 配体中心位于合理范围
const center = ligandCenter(open.ligand!);
assert.ok(center.every(v => Number.isFinite(v)));

// 7. 默认选择必须落在该构象实际存在的对象上
const apoSel = defaultSelection(apo);
assert.ok(apo.residues.some(r => r.id === apoSel.residueId), 'Apo 默认残基存在');
assert.strictEqual(apoSel.atomId, '', 'Apo 默认原子为空');
const mutSel = defaultSelection(mutant);
assert.notStrictEqual(mutSel.residueId, 102, '突变体默认不能选缺失的 102');

// 8. 稳定后继（复刻 App 删除规则）
function successor(list: typeof open[], index: number, removedId: string) {
  const next = list.slice(0, index).concat(list.slice(index + 1));
  if (next.length === 0) return null;
  return next[Math.min(index, next.length - 1)].id;
}
const list = [open, closed, apo, mutant];
// 删除中间：后继
assert.strictEqual(successor(list, 1, closed.id), apo.id);
// 删除末尾：前驱
assert.strictEqual(successor(list, 3, mutant.id), apo.id);
// 删除首个
assert.strictEqual(successor(list, 0, open.id), closed.id);

// 9. 名称去重
assert.strictEqual(uniqueConformerName('开放态', ['开放态']), '开放态 2');
assert.strictEqual(uniqueConformerName('开放态', ['开放态', '开放态 2']), '开放态 3');
assert.strictEqual(uniqueConformerName('自定义', []), '自定义');

console.log('所有模型不变量测试通过 ✓');
