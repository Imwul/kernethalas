import { useId, useState } from 'react';
import { applyDomainCheck, domainCheckKind, type DomainProgress } from '../../lib/domain-progress';
import { usePlayDraftState } from '../../lib/play-draft';
import { UsageDieTool } from '../UsageDieTool';
import { XRef } from '../bits';
import { PlayStrip, PlayStripPane } from './PlayPanels';
import '../../styles/play-domain-progress.css';

export type DomainDestination = { id: number; name: string };

export function PlayDomainProgress({ progress, place, placeId, placeName, revisit, onChange, onLairMark, atLair, atExit,
  recordedArrival, onArrival, onExitMark }: {
  progress: DomainProgress;
  place: 'room' | 'corridor';
  placeId: string;
  placeName: string;
  revisit: boolean;
  onChange: (progress: DomainProgress) => void;
  onLairMark: (marked: boolean) => void;
  atLair: boolean;
  atExit: boolean;
  recordedArrival: 'lair' | 'exit' | null;
  onArrival: (arrival: 'lair' | 'exit' | null) => void;
  onExitMark: (marked: boolean) => void;
}) {
  const [open, setOpen] = usePlayDraftState('domain-progress-open', false);
  const stripId = useId();
  const kind = domainCheckKind(progress, place, revisit || atLair, placeId);
  const recorded = progress.lastCheck?.placeId === placeId ? progress.lastCheck : undefined;
  const intro = progress.mode === 'intro';
  const manualLair = !revisit && (progress.lair
    ? progress.lair.id === placeId && progress.lair.source === 'map' && !progress.exit
    : place === 'room' || progress.corridorLair || intro);
  const manualExit = !revisit && !atLair && (intro || !!progress.lair) && (!progress.exit || (progress.exit.id === placeId && progress.exit.source === 'map'));
  const stateLabel = kind === 'lair' && !progress.lair ? `은신처 ${progress.lairDie}`
    : kind === 'exit' && !progress.exit ? `출구 ${progress.exitDie}`
      : atExit ? '출구 위치' : atLair ? 'Overseer 은신처' : intro ? '도입 지도' : '도메인 진행';
  const dieTool = kind && (
    <div className="play-explore-step">
      <h3 aria-hidden="true">{kind === 'lair' ? '은신처 주사위' : '출구 주사위'}</h3>
      <UsageDieTool rule={kind === 'lair' ? 'lair-check' : 'domain-exit-check'} hideTitle progress={{
        die: kind === 'lair' ? progress.lairDie : progress.exitDie,
        recorded,
        onRoll: (value) => onChange(applyDomainCheck(progress, kind, { id: placeId, name: placeName }, value)),
      }} />
    </div>
  );
  const arrivalField = revisit && (progress.lair || progress.exit) && (
    <label className="field play-domain-arrival"><span>돌아온 위치</span>
      <select value={recordedArrival ?? ''} onChange={(event) => {
        const value = event.target.value;
        onArrival(value === 'lair' || value === 'exit' ? value : null);
      }}>
        <option value="">일반 장소 재방문</option>
        {progress.lair && <option value="lair">은신처 · {progress.lair.name}</option>}
        {progress.exit && <option value="exit">출구 · {progress.exit.name}</option>}
      </select>
    </label>
  );
  const details = (
    <div className="play-domain-progress-body">
      {intro && <p className="play-explore-note">종이 지도에 표시된 은신처와 출구를 직접 지정합니다. <XRef id="first-domain-rules" /></p>}
      {!revisit && !intro && !progress.lair && place === 'corridor' && !progress.corridorLair && (
        <p className="play-explore-note">통로의 은신처 굴림은 도메인 설정에서 선택합니다.</p>
      )}
      {manualLair && <label className="play-explore-lair">
        <input type="checkbox" checked={atLair} onChange={(event) => onLairMark(event.target.checked)} /> 이 {place === 'room' ? '방' : '통로'}이 Overseer 은신처
      </label>}
      {manualExit && <label className="play-explore-lair">
        <input type="checkbox" checked={atExit} onChange={(event) => onExitMark(event.target.checked)} /> 지도에 표시된 출구 위치
      </label>}
      {progress.lair && !atLair && <p className="play-explore-note">찾은 은신처 · {progress.lair.name}</p>}
      {progress.exit && !atExit && <p className="play-explore-note">찾은 출구 · {progress.exit.name}</p>}
      <div className="play-explore-links"><XRef id="lair-check" /><XRef id="domain-exit-check" /></div>
    </div>
  );
  return (
    <section className="play-domain-progress" aria-label="은신처·출구 진행">
      {/* A pending lair/exit roll is part of every room entry, so it stays open beside the tension die. */}
      {dieTool}
      {arrivalField}
      {atLair && <p className="play-explore-note">이번 위치는 Overseer 은신처입니다. 전투 여부를 선택합니다.</p>}
      <PlayStrip label="은신처·출구 표시" prefix={stripId} value={open ? 'marks' : null} onChange={(next) => setOpen(next !== null)}
        items={[{ id: 'marks', label: kind ? '은신처·출구 직접 표시' : stateLabel }]} />
      <PlayStripPane prefix={stripId} id="marks" open={open}>{details}</PlayStripPane>
    </section>
  );
}

export function PlayDomainExit({ mode, onLeave, destinations = [] }: {
  mode: DomainProgress['mode'];
  onLeave: (id: number | 'new') => void;
  destinations?: DomainDestination[];
}) {
  const [choosing, setChoosing] = useState(false);
  const [destination, setDestination] = useState<number | 'new'>('new');
  const selected = destination === 'new' || destinations.some(({ id }) => id === destination) ? destination : 'new';
  return (
    <div className="play-domain-exit" aria-label="출구에서 선택">
      <p><strong>도메인 출구</strong> · 이 장소의 일반 판정을 마친 뒤 이동할 수 있습니다.</p>
      {choosing ? (
        <div className="play-domain-exit-form">
          <label className="field"><span>도착할 도메인</span>
            <select value={selected} onChange={(event) => setDestination(event.target.value === 'new' ? 'new' : Number(event.target.value))}>
              <option value="new">새 도메인 · 긴장 D8, XP +50</option>
              {destinations.map(({ id, name }) => <option key={id} value={id}>{name.trim() || `도메인 ${id}`}</option>)}
            </select>
          </label>
          <div className="play-explore-next">
            <button className="btn primary" type="button" onClick={() => onLeave(selected)}>출구로 이동 확정</button>
            <button className="btn ghost" type="button" onClick={() => setChoosing(false)}>이 도메인에 남기</button>
          </div>
          {mode === 'intro' && <p className="play-explore-note">도입 도메인의 출구는 한 번만 지날 수 있습니다.</p>}
        </div>
      ) : <button className="btn ghost" type="button" onClick={() => setChoosing(true)}>출구로 이동 선택</button>}
    </div>
  );
}
