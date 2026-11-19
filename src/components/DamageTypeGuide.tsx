import { damageReactionText, ignoresArmor, type DamageReactions, type DamageType } from '../lib/damage';
import { XRef } from './bits';
import '../styles/damage-type-guide.css';

const TYPE_GUIDES = {
  Acid: ['산성', '액체나 분비물의 부식', 'Armor 적용 · 피해를 받은 부위의 Armor −1(야영 수리까지)'],
  Arcane: ['비전', '마법과 Aether에서 오는 피해'],
  Bludgeoning: ['타격', '둔기나 충격으로 인한 피해', 'Armor 1 무시'],
  Cold: ['냉기', '극심한 저온이나 냉기 마법'],
  Fire: ['화염', '불길과 열기'],
  Force: ['역장', '폭발이나 마력의 충격'],
  Holy: ['신성', '신성한 힘이나 능력에서 오는 피해'],
  Infernal: ['지옥불', '악마나 지옥의 힘에서 오는 피해'],
  Lightning: ['번개', '전격과 방전'],
  Necrotic: ['사령', '생명력을 쇠하게 하는 힘'],
  Piercing: ['관통', '창끝이나 이빨에 찔리는 피해', 'Armor 적용 · 치명타일 때 별도로 피해 +2'],
  Poison: ['독', '독성 물질이나 독 마법'],
  Psychic: ['정신', '정신과 영혼에 가해지는 충격'],
  Slashing: ['참격', '칼날이나 발톱에 베이는 피해', 'Armor 적용 뒤 피해가 3 이하면 +1'],
} as const satisfies Record<DamageType, readonly [name: string, meaning: string, armor?: string]>;

const CONDITIONS = {
  Cold: { label: '동상', id: 'freezing', en: 'Freezing' },
  Fire: { label: '화상', id: 'burning', en: 'Burning' },
  Poison: { label: '중독', id: 'poisoned', en: 'Poisoned' },
} as const satisfies Partial<Record<DamageType, { label: string; id: string; en: string }>>;

export function DamageTypeGuide({ type, reactions, immuneConditions = [] }: {
  type: DamageType;
  reactions?: DamageReactions;
  immuneConditions?: readonly string[];
}) {
  const [name, meaning, armor] = TYPE_GUIDES[type];
  const condition = type === 'Cold' || type === 'Fire' || type === 'Poison' ? CONDITIONS[type] : null;
  const armorRule = armor ?? (ignoresArmor(type) ? '모든 Armor 무시' : '대상 부위 Armor 적용');

  return (
    <section className="damage-type-guide" aria-label={`${type} 피해 설명`}>
      <header><strong>{name}</strong><span lang="en">{type}</span></header>
      <p>{meaning}</p>
      <dl>
        <div><dt>방어구</dt><dd>{armorRule}</dd></div>
        {reactions && <div><dt>대상 반응</dt><dd>{damageReactionText(reactions)}</dd></div>}
        {condition && <div><dt>관련 상태</dt><dd><XRef id={condition.id}>{condition.label}</XRef> · {immuneConditions.includes(condition.en)
          ? '대상이 이 상태에 면역입니다. 피해 반응은 위에 표시됩니다.'
          : '공격이나 효과에 적힌 경우에만 부여합니다.'}</dd></div>}
      </dl>
    </section>
  );
}
