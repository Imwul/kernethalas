import { useState, type Dispatch, type SetStateAction } from 'react';
import { DICE_CHAIN } from '../../lib/dice';
import { activeDomainDie, DEFAULT_DOMAIN_PROGRESS, stepDomainDie } from '../../lib/domain-progress';
import {
  DAMAGE_TYPE_TABLE, EMPTY_INFLUENCE, INFLUENCE_TABLE, OVERSEER_TABLE, darknessDetails,
  domainOverseer, influenceText, type DarknessEvent, type InfluenceRoll, type PlayDomainRecord,
} from '../../lib/play-domain';
import type { PlayTimelineEntry } from '../../lib/play-timeline';
import { XRef } from '../bits';
import { JournalRoll } from '../LootJournal';
import { PlayTimeline } from './PlayTimeline';

interface Props {
  domain: PlayDomainRecord;
  domains: PlayDomainRecord[];
  activeEffects: DarknessEvent[];
  defeated: boolean;
  onUpdate: (change: Partial<PlayDomainRecord>) => void;
  onSwitch: (id: number | 'new') => void;
  onDismiss: (id: string) => void;
  domainPlaceId?: string;
  timeline?: PlayTimelineEntry[];
  onTimelineChange?: Dispatch<SetStateAction<PlayTimelineEntry[]>>;
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

export function PlayDomain({ domain, domains, activeEffects, defeated, onUpdate, onSwitch, onDismiss, domainPlaceId,
  timeline, onTimelineChange }: Props) {
  const [destination, setDestination] = useState<number | 'new' | null>(null);
  const overseer = domainOverseer(domain.overseerRoll);
  const progress = domain.progress ?? DEFAULT_DOMAIN_PROGRESS;
  const activeDie = activeDomainDie(progress);
  const raised = stepDomainDie(progress, -1);
  const otherDomains = domains.filter(({ id, progress: candidate }) => id === domain.id || candidate?.mode !== 'intro');
  const progressStarted = !!(progress.lair || progress.exit || progress.lastCheck);
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
          {otherDomains.length > 1 && (
            <label className="field"><span>도메인 전환</span>
              <select value={destination === 'new' ? domain.id : destination ?? domain.id} onChange={(event) => {
                const next = Number(event.target.value);
                setDestination(next === domain.id ? null : next);
              }}>{otherDomains.map((option) => <option key={option.id} value={option.id}>{domainName(option)}</option>)}</select>
            </label>
          )}
          <button className="btn ghost" type="button" onClick={() => setDestination('new')}>새 도메인</button>
        </div>
        {destination !== null && (
          <div className="play-reset" role="group" aria-label="도메인 전환 확인">
            <p>{destination === 'new' ? '새 도메인의 첫 진입을 기록합니다. 긴장 D8 · XP +50.' : '이번 장소 기록을 정리하고 도메인을 전환합니다.'}</p>
            <button className="btn primary" type="button" onClick={() => {
              setDestination(null);
              onSwitch(destination);
            }}>{destination === 'new' ? 'D8로 새 도메인 시작' : '선택한 도메인으로 이동'}</button>
            <button className="btn ghost" type="button" onClick={() => setDestination(null)}>취소</button>
          </div>
        )}
        {timeline && onTimelineChange && <PlayTimeline domainId={domain.id} timeline={timeline} onChange={onTimelineChange} />}
        <section className="play-domain-options" aria-label="도메인 진행 설정">
          <h3>탐험 진행</h3>
          <div className="play-domain-fields">
            <label className="field"><span>도메인 방식</span>
              <select value={progress.mode} disabled={progressStarted} onChange={(event) => {
                const mode = event.target.value === 'intro' ? 'intro' : 'standard';
                onUpdate({ progress: { ...progress, mode } });
              }}>
                <option value="standard">일반 도메인</option>
                <option value="intro">도입 도메인 · 종이 지도</option>
              </select>
            </label>
            {activeDie && (
              <label className="field"><span>{activeDie === 'lairDie' ? '다음 은신처 주사위' : '다음 출구 주사위'}</span>
                <select value={progress[activeDie]} onChange={(event) => {
                  const next = DICE_CHAIN.find((option) => option === event.target.value);
                  if (next) onUpdate({ progress: { ...progress, [activeDie]: next } });
                }}>
                  {DICE_CHAIN.map((die) => <option key={die}>{die}</option>)}
                </select>
              </label>
            )}
          </div>
          {progress.mode === 'standard' && !progress.lair && <label className="play-explore-lair">
            <input type="checkbox" checked={progress.corridorLair} onChange={(event) => onUpdate({ progress: { ...progress, corridorLair: event.target.checked } })} /> 새 통로도 은신처 판정
          </label>}
          {progress.mode === 'standard' && !progress.lair && <p className="play-explore-note">통로의 은신처 판정은 룰북에서 명확히 정하지 않습니다. 16번째 방을 은신처로 삼는 선택 규칙은 탐험 화면에서 직접 표시합니다.</p>}
          {progress.mode === 'intro' && <p className="play-explore-note">종이 지도에 따라 방·통로를 고르고 은신처와 출구를 직접 표시합니다. <XRef id="first-domain-rules" /></p>}
          {progress.lair && <p className="play-domain-coordinate"><strong>발견한 은신처</strong> · {progress.lair.name}</p>}
          {progress.exit && <p className="play-domain-coordinate"><strong>발견한 출구</strong> · {progress.exit.name}</p>}
          <div className="play-explore-next">
            {activeDie && raised !== progress && <button className="btn ghost" type="button"
              onClick={() => onUpdate({ progress: raised })}>Reason 대실패 · 한 단계 상승</button>}
            {domainPlaceId && progress.entryPlaceId === null && !progressStarted && <button className="btn ghost" type="button"
              onClick={() => onUpdate({ progress: { ...progress, entryPlaceId: domainPlaceId } })}>첫 진입 기록 · XP +50</button>}
          </div>
          {progress.entryPlaceId === domainPlaceId && <p className="play-explore-note">도메인 첫 진입 · 시작 긴장 D8 · XP +50</p>}
        </section>
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
