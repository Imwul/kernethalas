import { usePlayDraftState } from '../../lib/play-draft';
import { showIntegrity, type GearItem, type Integrity, type PaperChange } from '../../lib/play-inventory';
import { resolveUsageDie } from '../../lib/usage-die';
import { UsageDieTool } from '../UsageDieTool';

type ArmorRoll = { name: string; die: Exclude<Integrity, 'broken'>; value: number };
export type ArmorRolls = Record<string, ArmorRoll>;

export function armorRollChanges(battleId: string, rolls: ArmorRolls): PaperChange[] {
  return Object.entries(rolls).flatMap(([itemId, { name, die, value }]) => {
    const result = resolveUsageDie('armor-integrity', die, value);
    if (!result) return [];
    const after = result.kind === 'trigger' ? 'broken' : result.next as Integrity;
    return [{ id: `${battleId}:armor:${itemId}`, text: `${name} 내구도 ${die} → ${showIntegrity(after)}`,
      gear: after === die ? undefined : { kind: 'integrity', itemId, before: die, after } }];
  });
}

export function PlayFightArmor({ items, rolls, onRoll, onReport }: {
  items: GearItem[];
  rolls: ArmorRolls;
  onRoll: (rolls: ArmorRolls) => void;
  onReport: (summary: string) => void;
}) {
  const [target, setTarget] = usePlayDraftState('integrity-target', '');
  const armor = items.filter(({ location, id, count, integrity }) => !!rolls[id] || location === 'equipped' && count > 0 && integrity && integrity !== 'broken');
  const selected = armor.find(({ id }) => id === target);
  const recorded = rolls[target];
  const die = recorded?.die ?? (selected?.integrity === 'broken' ? undefined : selected?.integrity);
  return (
    <div className="play-fight-armor">
      {armor.length > 0 && <label className="field"><span>이번 전투에 사용한 장부 방어구</span>
        <select value={selected?.id ?? ''} onChange={(event) => setTarget(event.target.value)}>
          <option value="">주사위 직접 지정</option>
          {armor.map(({ id, name, integrity }) => <option key={id} value={id}>{name} · {integrity && showIntegrity(integrity)}</option>)}
        </select>
      </label>}
      {selected && die ? <>
        <UsageDieTool key={selected.id} rule="armor-integrity" progress={{ itemId: selected.id, die, recorded, onRoll: (value) => {
          onRoll({ ...rolls, [selected.id]: { name: selected.name, die, value } });
        } }} />
        {recorded && <button className="btn ghost play-wrap-clear" type="button" onClick={() => {
          const next = { ...rolls };
          delete next[selected.id];
          onRoll(next);
        }}>이 내구도 굴림 지우기</button>}
      </> : <UsageDieTool rule="armor-integrity" onReport={onReport} />}
    </div>
  );
}
