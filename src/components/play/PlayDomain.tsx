import { useState } from 'react';
import {
  DAMAGE_TYPE_TABLE, EMPTY_INFLUENCE, INFLUENCE_TABLE, OVERSEER_TABLE, darknessDetails,
  domainOverseer, influenceText, type DarknessEvent, type InfluenceRoll, type PlayDomainRecord,
} from '../../lib/play-domain';
import { XRef } from '../bits';
import { JournalRoll } from '../LootJournal';

interface Props {
  domain: PlayDomainRecord;
  domains: PlayDomainRecord[];
  activeEffects: DarknessEvent[];
  defeated: boolean;
  onUpdate: (change: Partial<PlayDomainRecord>) => void;
  onSwitch: (id: number | 'new') => void;
  onDismiss: (id: string) => void;
}

export function domainName({ name, id }: PlayDomainRecord) {
  return name.trim() || `도메인 ${id}`;
}

function InfluenceInputs({ label, value, onChange }: { label: string; value: InfluenceRoll; onChange: (next: InfluenceRoll) => void }) {
  return (
    <div className="play-domain-rolls">
      <JournalRoll tableId={INFLUENCE_TABLE.id} label={label} value={value.roll} resultText={influenceText(value)}
        onValue={(roll) => onChange({ roll, damageRoll: null })} />
      {value.roll === 6 && (
        <JournalRoll tableId={DAMAGE_TYPE_TABLE.id} label="Resistant 피해 유형" value={value.damageRoll}
          onValue={(damageRoll) => onChange({ ...value, damageRoll })} />
      )}
    </div>
  );
}

export function PlayDomain({ domain, domains, activeEffects, defeated, onUpdate, onSwitch, onDismiss }: Props) {
  const [destination, setDestination] = useState<number | 'new' | null>(null);
  const overseer = domainOverseer(domain.overseerRoll);
  const extraInfluences = activeEffects.filter(({ roll }) => roll >= 81);
  return (
    <details className="fold play-domain">
      <summary>
        <span>{domainName(domain)}</span>
        {overseer && <span lang="en">{overseer.name}</span>}
        {activeEffects.length > 0 && <span>어둠 {activeEffects.length}개</span>}
      </summary>
      <section className="play-domain-body" aria-label="도메인 효과">
        <div className="play-domain-fields">
          <label className="field"><span>도메인 이름</span>
            <input value={domain.name} onChange={(event) => onUpdate({ name: event.target.value })} />
          </label>
          {domains.length > 1 && (
            <label className="field"><span>도메인 전환</span>
              <select value={destination === 'new' ? domain.id : destination ?? domain.id} onChange={(event) => {
                const next = Number(event.target.value);
                setDestination(next === domain.id ? null : next);
              }}>{domains.map((option) => <option key={option.id} value={option.id}>{domainName(option)}</option>)}</select>
            </label>
          )}
          <button className="btn ghost" type="button" onClick={() => setDestination('new')}>새 도메인</button>
        </div>
        {destination !== null && (
          <div className="play-reset" role="group" aria-label="도메인 전환 확인">
            <p>이번 장소 기록을 정리하고 도메인을 전환합니다.</p>
            <button className="btn primary" type="button" onClick={() => {
              setDestination(null);
              onSwitch(destination);
            }}>{destination === 'new' ? 'D8로 새 도메인 시작' : '선택한 도메인으로 이동'}</button>
            <button className="btn ghost" type="button" onClick={() => setDestination(null)}>취소</button>
          </div>
        )}
        <div className="play-domain-rolls">
          <JournalRoll tableId={OVERSEER_TABLE.id} label="Overseer" value={domain.overseerRoll}
            onValue={(overseerRoll) => onUpdate({ overseerRoll, defeated: false })} />
          <InfluenceInputs label="Overseer 영향력" value={domain.influence} onChange={(influence) => onUpdate({ influence })} />
        </div>
        {defeated && <p className="play-condition">Overseer 처치 · 이 도메인의 영향력 해제</p>}
        <div className="play-domain-effects">
          <h3>지속 중인 짙어지는 어둠</h3>
          {activeEffects.length ? <ul>{activeEffects.map((effect) => (
            <li key={effect.id}>
              <p><strong>D100 {effect.roll}</strong> · {darknessDetails(effect)?.ko}</p>
              <button className="btn ghost" type="button" onClick={() => onDismiss(effect.id)} aria-label={`D100 ${effect.roll} 어둠 효과 해제`}>해제</button>
            </li>
          ))}</ul> : <p className="play-empty">이 도메인에 지속되는 어둠 효과가 없습니다.</p>}
        </div>
        {!defeated && extraInfluences.map((effect) => (
          <InfluenceInputs key={effect.id} label={`어둠 ${effect.roll} 추가 영향력`} value={domain.extra[effect.id] ?? EMPTY_INFLUENCE}
            onChange={(roll) => onUpdate({ extra: { ...domain.extra, [effect.id]: roll } })} />
        ))}
        <div className="play-refs"><XRef id="overseer-influence" /><XRef id="growing-darkness" /></div>
      </section>
    </details>
  );
}
