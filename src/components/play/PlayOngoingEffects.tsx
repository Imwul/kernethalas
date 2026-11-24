import { useId, useState } from 'react';
import { encounterInteger } from '../../lib/encounter-start';
import { LINGERING_CONDITIONS, ongoingAbilityId, usePlayOngoingEffects, type RestKind } from '../../lib/play-effects';
import { XRef } from '../bits';
import '../../styles/play-ongoing.css';

export function PlayOngoingEffects() {
  const { current, trackAbility, setCondition, release, clearUsed } = usePlayOngoingEffects();
  const heading = useId();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<RestKind | 'sustain'>('rest');
  const [raw, setRaw] = useState('');
  const reserved = encounterInteger(raw);
  const valid = name.trim() && (kind !== 'sustain' || reserved !== null && reserved > 0);

  return (
    <section aria-labelledby={heading} className="play-ongoing play-ongoing-body">
        <h2 id={heading} className="sr-only">현재 남은 상태와 능력</h2>
        <fieldset className="play-ongoing-conditions">
          <legend>남아 있는 상태</legend>
          {LINGERING_CONDITIONS.map(({ id, label }) => (
            <label key={id}><input type="checkbox" checked={current.conditions.includes(id)} onChange={(event) => setCondition(id, event.target.checked)} />{label}</label>
          ))}
        </fieldset>
        {current.conditions.length > 0 && <p>다음 방 · Health −{current.conditions.length} · Armor 무시{current.conditions.includes('poisoned') && ' · 중독 1은 Poison'}</p>}
        <XRef id="lingering-damage">지속 피해 규칙</XRef>

        {current.abilities.length > 0 && <ul className="play-ongoing-abilities" aria-label="유지 및 사용 기록">
          {current.abilities.map((item) => (
            <li key={item.id}>
              <div><strong>{item.name}</strong>
                {item.reserved && <span>유지 중 · 최대 Aether −{item.reserved}</span>}
                {item.used && <span>사용함 · {item.used === 'camp' ? '야영 후 재사용' : '숨 고르기 또는 야영 후 재사용'}</span>}
              </div>
              <div className="play-ongoing-actions">
                {item.reserved && <button type="button" className="btn ghost" aria-label={`${item.name} 유지 해제 기록`} onClick={() => release(item)}>유지 해제 기록</button>}
                {item.used && <button type="button" className="linkbtn" aria-label={`${item.name} 사용 표시 정정`} onClick={() => clearUsed(item)}>사용 표시 정정</button>}
              </div>
            </li>
          ))}
        </ul>}
        <div className="play-ongoing-add">
          <h3>사용·유지 상태 직접 추가</h3>
          <form className="play-ongoing-form" onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            const title = name.trim();
            trackAbility({ id: ongoingAbilityId(title), name: title,
              ...(kind === 'sustain' && reserved !== null ? { reserved } : kind !== 'sustain' ? { used: kind } : {}) });
            setName('');
            setRaw('');
          }}>
            <label className="field"><span>능력 이름</span><input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="field"><span>기록할 상태</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
                <option value="rest">사용함 · 휴식당 1회</option>
                <option value="camp">사용함 · 야영당 1회</option>
                <option value="sustain">유지 중</option>
              </select>
            </label>
            {kind === 'sustain' && <label className="field"><span>제한된 최대 Aether</span>
              <input inputMode="numeric" value={raw} onChange={(event) => setRaw(event.target.value)} />
            </label>}
            <button className="btn ghost" type="submit" disabled={!valid}>상태 기록</button>
          </form>
        </div>
        <XRef id="once-per-rest">재사용 규칙</XRef>
    </section>
  );
}
