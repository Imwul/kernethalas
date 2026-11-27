import type { CreatureSummon } from '../content/creature-action-rules';
import { creatureById, creatureName } from '../content/entries/creatures';
import type { RollResult } from '../lib/dice';
import { usePlayDraftState, usePlayRoll } from '../lib/play-draft';
import { PhysicalDiceRoll } from './PhysicalDiceRoll';
import { XRef } from './bits';

export type CombatSummonControls = {
  activeCount: (creatureId: string) => number;
  add: (creatureId: string, count: number) => void;
};

const SUMMON_PENDING = -1;

export function CreatureSummonRoll({ summon, encounter }: { summon: CreatureSummon; encounter?: CombatSummonControls }) {
  const [roll, setRoll] = usePlayDraftState<RollResult | undefined>('summons', undefined);
  const [added, setAdded] = usePlayDraftState<number | null>('summon-added', null);
  const [done, setDone] = usePlayDraftState<number[]>('summon-done', []);
  const commit = usePlayRoll();
  const total = roll?.expr === summon.die ? roll.total : 0;
  const count = Number.isInteger(total) && total >= 1 && total <= 4 ? total : 0;
  const roster = summon.kind === 'roster' ? summon : undefined;
  const summoned = roster && creatureById.get(roster.creatureId);
  const name = summoned && creatureName(summoned);
  const activeCount = roster ? encounter?.activeCount(roster.creatureId) ?? 0 : 0;
  const available = roster ? Math.max(0, roster.limit - activeCount) : 0;
  const countToAdd = Math.min(count, available);
  const applied = !!encounter && added !== null && added !== SUMMON_PENDING;

  return (
    <section className="creature-summon" aria-label="소환 처리">
      {applied ? <p className="loot-roll-result" role="status">
        <span className="readout">{count}</span>
        <span>{added > 0 ? `${name} ${added}체를 전투에 추가했습니다.` : '상한에 도달해 추가 소환이 없습니다.'}</span>
      </p> : <PhysicalDiceRoll label="소환 수" dice={summon.die} value={roll}
        onValue={(value) => {
          setRoll(value);
          if (roster && encounter) setAdded(SUMMON_PENDING);
          if (summon.kind === 'single-attack') setDone([]);
        }} resultText={({ total }) => `${total}체`} />}
      {roster && (
        <div className="creature-summon-info">
          <p><XRef id={roster.creatureId}>{name}</XRef> · 동시에 최대 {roster.limit}체</p>
          {encounter && <p>교전 중 {activeCount}체 · 추가 가능 {available}체</p>}
          {encounter && count > 0 && !applied && (
            <button className="btn primary" type="button" data-play-next="" onClick={() => commit(() => {
              if (countToAdd > 0) encounter.add(roster.creatureId, countToAdd);
              setAdded(countToAdd);
            })}>{countToAdd > 0 ? `전투에 ${countToAdd}체 추가` : '추가 소환 없음 확정'}</button>
          )}
        </div>
      )}
      {summon.kind === 'single-attack' && count > 0 && (
        <fieldset className="creature-summon-check">
          <legend>Shadow Reaper 공격 처리</legend>
          <p>Combat Skill {summon.combatSkill} · {summon.damage[1]} {summon.damage[0]} · 한 번 공격하고 사라짐</p>
          <div>
            {Array.from({ length: count }, (_, index) => index + 1).map((number) => (
              <label key={number}>
                <input type="checkbox" checked={done.includes(number)} onChange={(event) => {
                  const checked = event.target.checked;
                  setDone((previous) => checked ? [...previous, number] : previous.filter((item) => item !== number));
                }} />
                <span>{summon.name} {number} 공격 처리</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </section>
  );
}
