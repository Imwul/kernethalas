import { useId, useState } from 'react';
import { readOracleValue } from '../../lib/oracle';
import { usePlayDraftState, usePlayRoll, usePlayRollField } from '../../lib/play-draft';
import { targetAllocation } from '../../lib/target-allocation';
import { XRef } from '../bits';
import { PlayDieHint } from './PlayDieHints';

function memberCount(value: string, minimum: number) {
  return /^\d+$/.test(value) && Number(value) >= minimum && Number(value) <= 20 ? Number(value) : null;
}

export function PlayTargetAllocation({ targets }: { targets: { id: string; label: string }[] }) {
  const id = useId();
  const [pcs, setPcs] = usePlayDraftState('pcs', '1');
  const [allies, setAllies] = usePlayDraftState('allies', '0');
  const [plan, setPlan] = usePlayDraftState<{ picks: string[]; assignments: Record<string, string> }>('plan', { picks: [], assignments: {} });
  const { picks, assignments } = plan;
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const commitRoll = usePlayRoll();
  const pcCount = memberCount(pcs, 1);
  const allyCount = memberCount(allies, 0);
  const allocation = pcCount === null || allyCount === null ? null : targetAllocation(targets.length, pcCount, allyCount, picks);
  const dice = `D${allocation?.sides ?? 0}`;
  const diceField = usePlayRollField('target-tiebreaker', '적 배분 후보 선택', dice, !allocation?.remaining);
  const reset = () => {
    setPlan({ picks: [], assignments: {} });
    setValue('');
    setError('');
  };
  const assignExtra = () => {
    if (!allocation?.remaining) return;
    const roll = readOracleValue(value, allocation.sides);
    const selected = roll === null ? undefined : allocation.candidates[roll - 1];
    if (roll === null || !selected) {
      setError(roll === null ? `1–${allocation.sides} 값을 입력하세요.` : '후보에 없는 눈입니다. 같은 주사위를 다시 굴립니다.');
      return;
    }
    commitRoll(() => setPlan((previous) => ({ picks: [...previous.picks, selected.id], assignments: {} })), {
      label: '적 배분 후보 선택', dice, value: String(roll), source: 'manual', field: diceField['data-play-roll-field'],
    });
    setValue('');
    setError('');
  };
  return (
    <details className="fold play-target-allocation">
      <summary>PC·동료에게 적 배분</summary>
      <section className="play-aux-body" aria-label="전투 대상 배분">
        <div className="play-aux-grid">
          <label className="field"><span>PC 수</span>
            <input inputMode="numeric" value={pcs} aria-invalid={pcCount === null || undefined}
              onChange={(event) => { setPcs(event.target.value); reset(); }} />
          </label>
          <label className="field"><span>동료·Minion 수</span>
            <input inputMode="numeric" value={allies} aria-invalid={allyCount === null || undefined}
              onChange={(event) => { setAllies(event.target.value); reset(); }} />
          </label>
        </div>
        {!allocation && <p className="field-err" role="alert">PC는 1–20명, 동료·Minion은 0–20명으로 입력하세요.</p>}
        {allocation && (
          <>
            <dl className="play-allocation-counts" aria-label="인원별 적 배분 수">
              {allocation.counts.map(({ id: memberId, name, count }) => <div key={memberId}><dt>{name}</dt><dd>{count}마리</dd></div>)}
            </dl>
            {allocation.remaining > 0 ? (
              <div className="play-alloc-tie">
                <p className="play-combat-note">남은 적 {allocation.remaining}마리의 상대를 후보 중에서 정합니다.</p>
                <ol>{allocation.candidates.map(({ id: memberId, name }) => <li key={memberId}>{name}</li>)}</ol>
                <form className="play-aux-form" data-play-roll noValidate onSubmit={(event) => { event.preventDefault(); assignExtra(); }}>
                  <div className="field"><label htmlFor={id}>후보 선택 D{allocation.sides}</label>
                    <PlayDieHint dice={dice} sides={allocation.sides} />
                    <input id={id} inputMode="numeric" {...diceField} value={value} placeholder={`1–${allocation.sides}`}
                      aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : undefined}
                      onChange={(event) => { setValue(event.target.value); setError(''); }} />
                  </div>
                  <button type="submit" className="btn ghost">배분 확인</button>
                  {error && <p id={`${id}-error`} role="alert" className="field-err">{error}</p>}
                </form>
              </div>
            ) : (
              <div className="play-aux-grid" role="group" aria-label="개별 적 배정">
                {targets.map((target) => (
                  <label className="field" key={target.id}><span>{target.label} 상대</span>
                    <select value={assignments[target.id] ?? ''} onChange={(event) => {
                      const member = event.target.value;
                      setPlan((previous) => ({ ...previous, assignments: { ...previous.assignments, [target.id]: member } }));
                    }}>
                      <option value="">배정 선택</option>
                      {allocation.counts.filter(({ count }) => count > 0).map(({ id: memberId, name, count }) => (
                        <option value={memberId} key={memberId} disabled={assignments[target.id] !== memberId
                          && Object.values(assignments).filter((member) => member === memberId).length >= count}>{name}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
        <XRef id="multiple-targets" />
      </section>
    </details>
  );
}
