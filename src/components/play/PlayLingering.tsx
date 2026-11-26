import { useState } from 'react';
import { activeConditionOrigin, useCombatPosition } from '../../lib/play-combat-timing';
import type { CheckResult } from '../../lib/dice';
import { PlayDraftScope, usePlayDraft, usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { conditionsInText, LINGERING_CONDITIONS, LINGERING_ENTRY_SLOT, LINGERING_RECORDED_SLOT, usePlayOngoingEffects, type LingeringCondition } from '../../lib/play-effects';
import type { PaperChange } from '../../lib/play-inventory';
import { playAction } from '../../lib/play-roll-history';
import { XRef } from '../bits';
import { StatusIcon } from '../StatusIcon';
import { PhysicalSkillRoll, skillCheckSucceeded } from '../PhysicalSkillRoll';
import { CHARACTER_LOG_SLOT } from './PlayExhaustion';
import { PlaySurvival } from './PlaySurvival';
import '../../styles/play-character.css';

const LABEL: Record<LingeringCondition, string> = Object.fromEntries(LINGERING_CONDITIONS.map(({ id, label }) => [id, label])) as Record<LingeringCondition, string>;
const PLACE_DAMAGE: Record<LingeringCondition, string> = { bleeding: 'Armor 무시', poisoned: 'Poison', burning: 'Fire' };

export function recordedRoomDamage(recorded: unknown, legacyLog: unknown): PaperChange[] {
  if (!Array.isArray(recorded)) return [];
  const previous = Array.isArray(legacyLog) ? legacyLog as PaperChange[] : [];
  return LINGERING_CONDITIONS.flatMap(({ id, label }) => {
    if (!recorded.includes(id)) return [];
    const damage = `${label} · Health −1 (지속 피해 · ${PLACE_DAMAGE[id]})`;
    // Existing saves already wrote these entries to the character log.
    return previous.some(({ text }) => text === damage) ? [] : [{ id: `room-lingering-${id}`, text: damage }];
  });
}

function useCharacterLog() {
  const play = usePlayDraft();
  return (items: string[]) => {
    if (!play || !items.length) return;
    play.write(play.generation, CHARACTER_LOG_SLOT, (previous: PaperChange[]) => [
      ...previous, ...items.map((text) => ({ id: `lingering-${crypto.randomUUID()}`, text })),
    ], []);
  };
}

/** The bandage treatment from the rest stage, sharing its records, so a Medicine check can happen between places. */
export function FieldCare() {
  return (
    <PlayDraftScope root name="wrap"><PlayDraftScope name="survival">
      <PlaySurvival pane="treatment" only onPane={() => undefined} onReport={() => undefined} />
    </PlayDraftScope></PlayDraftScope>
  );
}

/** Room entry, after any between-room treatment and before the exploration checks. */
export function LingeringEntryAlert() {
  const play = usePlayDraft();
  const { current, setCondition } = usePlayOngoingEffects();
  const commit = usePlayRoll();
  const log = useCharacterLog();
  const [caring, setCaring] = useState(false);
  if (!play) return null;
  const recorded = Array.isArray(play.slots[LINGERING_RECORDED_SLOT]) ? play.slots[LINGERING_RECORDED_SLOT] as LingeringCondition[] : null;
  const entry = Array.isArray(play.slots[LINGERING_ENTRY_SLOT]) ? play.slots[LINGERING_ENTRY_SLOT] as LingeringCondition[] : [];
  const due = current.conditions.filter((id) => entry.includes(id));
  const later = current.conditions.filter((id) => !entry.includes(id));
  if (!due.length && !later.length && !recorded) return null;
  const record = () => commit(() => {
    play.write(play.generation, LINGERING_RECORDED_SLOT, due, null);
  }, playAction('방 진입 지속 피해'));
  return (
    <section className={`play-alert${recorded ? '' : due.length ? ' is-danger' : ''}`} aria-label="지속 피해">
      {recorded ? <p className="play-alert-title">지속 피해 기록함 · Health −{recorded.length}
        {' '}<span className="play-exhaustion-note">({recorded.map((id) => LABEL[id]).join(' · ')})</span></p>
        : due.length > 0 && <>
          <p className="play-alert-title" role="alert">이 방에 들어오며 지속 피해 · Health −{due.length}</p>
          <ul className="play-lingering-list">{due.map((id) => <li key={id}><StatusIcon kind={id} />{LABEL[id]} · Health −1 · {PLACE_DAMAGE[id]}</li>)}</ul>
          <div className="play-character-node-actions">
            <button type="button" className="btn primary" onClick={record}>피해 기록 · Health −{due.length}</button>
            {(due.includes('bleeding') || due.includes('poisoned')) &&
              <button type="button" className="btn ghost" aria-expanded={caring} onClick={() => setCaring((open) => !open)}>붕대 치료 (Medicine)</button>}
            {due.includes('burning') && <button type="button" className="btn ghost" onClick={() => commit(() => {
              setCondition('burning', false);
              log(['화상 해제', 'Exhaustion +2 (화상 끄기)']);
            }, playAction('방 밖 화상 끄기'))}>화상 끄기 · Exhaustion +2</button>}
          </div>
          <p className="play-exhaustion-note">방에 들어오기 전에 치료한 상태는 피해에서 빠집니다. Coagulate·Antidote 물약도 해제합니다.</p>
        </>}
      {later.length > 0 && <p className="play-exhaustion-note">다음 방부터 방마다 Health −1 · {later.map((id) => LABEL[id]).join(' · ')}</p>}
      {caring && !recorded && <FieldCare />}
      <XRef id="lingering-damage">지속 피해 규칙</XRef>
    </section>
  );
}

/** In a fight: each round's Bleeding/Poisoned damage and the PC's answers (Endurance against poison, putting out fire). */
export function CombatLingeringAlert({ onOpenRound }: { onOpenRound: () => void }) {
  const play = usePlayDraft();
  const { current, setCondition, setLevel, addCondition } = usePlayOngoingEffects();
  const commit = usePlayRoll();
  const log = useCharacterLog();
  const [position] = useCombatPosition();
  const battleId = typeof play?.slots.combat === 'string' ? play.slots.combat : 'place';
  const legacyRounds = play?.slots[`combat/${encodeURIComponent(battleId)}/lingering-rounds`];
  const [rounds, setRounds] = usePlayDraftState<number[]>('lingering-rounds', Array.isArray(legacyRounds) ? legacyRounds : []);
  const [withFire, setWithFire] = usePlayDraftState('lingering-round-fire', false);
  const [resisted, setResisted] = usePlayDraftState<number[]>('poison-resisted-rounds', []);
  if (!play) return null;
  const level = (id: LingeringCondition) => current.levels?.[id] ?? 1;
  const active = current.conditions;
  const { round } = position;
  const pcTurn = position.actor === 'pc' && position.timing === 'start';
  const origin = current.poisonOrigin;
  const delayed = !!origin && origin.encounter === activeConditionOrigin(play.slots)?.encounter && round <= origin.round;
  const resistanceUsed = resisted.includes(round);
  const damage = (active.includes('bleeding') ? level('bleeding') : 0) + (active.includes('poisoned') ? level('poisoned') : 0)
    + (withFire && active.includes('burning') ? 1 : 0);
  const parts = [
    active.includes('bleeding') && `출혈 ${level('bleeding')}`, active.includes('poisoned') && `중독 ${level('poisoned')}`,
    withFire && active.includes('burning') && '화상 1',
  ].filter(Boolean);
  const done = rounds.includes(round);
  const resist = (result: CheckResult) => {
    setResisted((previous) => [...previous, round]);
    if (!skillCheckSucceeded(result)) return;
    setCondition('poisoned', false);
    log(['중독 해제 (Endurance 저항 성공)']);
  };
  if (!active.length) {
    return (
      <div className="play-lingering-add" role="group" aria-label="PC 지속 피해 상태 추가">
        <span className="play-exhaustion-note">PC 상태</span>
        {LINGERING_CONDITIONS.map(({ id, label }) => <button key={id} type="button" className="btn ghost play-lingering-chip" onClick={() =>
          commit(() => addCondition(id), playAction(`${label} 적용`))}>
          <StatusIcon kind={id} />+ {label}</button>)}
      </div>
    );
  }
  return (
    <section className={`play-alert${damage && !done ? ' is-danger' : ''}`} aria-label="전투 중 지속 피해">
      <p className="play-alert-title" role={!done && damage > 0 ? 'alert' : undefined}>
        {round}라운드 지속 피해{damage ? ` · ${damage} (Armor 무시)` : ''}{done ? ' · 기록함' : ''}</p>
      <div className="play-lingering-levels">
        {active.map((id) => <div key={id} className="play-lingering-level">
          <span className="status-label"><StatusIcon kind={id} />{LABEL[id]}</span>
          {id !== 'burning' ? <div className="edge-toggle" role="group" aria-label={`${LABEL[id]} 수치`}>
            <button type="button" className="edge-btn" aria-label={`${LABEL[id]} 1 낮추기`} onClick={() => commit(() => {
              if (level(id) <= 1) setCondition(id, false);
              else setLevel(id, level(id) - 1);
            }, playAction(`${LABEL[id]} 수치 낮추기`))}>−</button>
            <span className="edge-state">{level(id)}</span>
            <button type="button" className="edge-btn" aria-label={`${LABEL[id]} 1 올리기`} disabled={level(id) >= 99} onClick={() =>
              commit(() => setLevel(id, level(id) + 1), playAction(`${LABEL[id]} 수치 올리기`))}>+</button>
          </div> : <label className="creator-check"><input type="checkbox" checked={withFire} onChange={(event) => setWithFire(event.target.checked)} />라운드 피해 1 포함</label>}
        </div>)}
      </div>
      {active.includes('burning') && <p className="play-exhaustion-note">화상의 피해 주기는 책에 적혀 있지 않습니다. 라운드마다 넣을지 직접 정하세요.</p>}
      <div className="play-character-node-actions">
        <button type="button" className={done ? 'btn ghost' : 'btn primary'} disabled={!damage || done} onClick={() => commit(() => {
          log([`${round}라운드 지속 피해 ${damage} (${parts.join(' · ')} · Armor 무시)`]);
          setRounds((previous) => [...previous, round]);
        }, playAction(`${round}라운드 지속 피해`))}>{done ? `${round}라운드 기록함` : `${round}라운드 피해 기록 · ${damage}`}</button>
        <button type="button" className="linkbtn" onClick={onOpenRound}>라운드·턴 열기</button>
        {active.includes('burning') && pcTurn && <button type="button" className="btn ghost" onClick={() => commit(() => {
          setCondition('burning', false);
          log(['화상 해제 (표준 행동 1)']);
        }, playAction('전투 중 화상 끄기'))}>표준 행동으로 화상 끄기</button>}
      </div>
      {active.includes('poisoned') && (pcTurn && !delayed && !resistanceUsed
        ? <PhysicalSkillRoll key={round} label="중독 저항 Endurance (자유 행동)" skill="Endurance"
          slot={`poison-resist-round-${round}`} onResult={resist} />
        : <p className="play-exhaustion-note">{resistanceUsed ? '이번 라운드의 중독 저항을 사용했습니다.'
          : '중독된 다음 라운드부터 PC 턴에 자유 행동으로 저항할 수 있습니다.'}</p>)}
      <XRef id="conditions">상태 규칙</XRef>
    </section>
  );
}

/** "PC에 적용" for the conditions a creature action names, after the PC failed against it. */
export function ApplyConditions({ text }: { text: string }) {
  const play = usePlayDraft();
  const { addCondition } = usePlayOngoingEffects();
  const commit = usePlayRoll();
  const [applied, setApplied] = usePlayDraftState<string[]>('applied-conditions', []);
  const found = conditionsInText(text);
  if (!play || !found.length) return null;
  return (
    <div className="play-lingering-add" role="group" aria-label="PC 상태 적용">
      {found.map(({ id, level }) => {
        const key = `${id}:${level}`;
        return <button key={key} type="button" className="btn ghost play-lingering-chip" disabled={applied.includes(key)} onClick={() => commit(() => {
          addCondition(id, level);
          setApplied((previous) => [...previous, key]);
        }, playAction(`${LABEL[id]} 적용`))}><StatusIcon kind={id} />{applied.includes(key) ? `${LABEL[id]} 적용함` : `PC에 적용 · ${LABEL[id]}${id === 'burning' ? '' : ` (${level})`}`}</button>;
      })}
    </div>
  );
}
