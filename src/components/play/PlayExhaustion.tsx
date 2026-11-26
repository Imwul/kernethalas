import { useState } from 'react';
import { EXHAUSTION_BANDS, exhaustionBand } from '../../lib/character-progress';
import type { CheckResult } from '../../lib/dice';
import { usePlayCharacter } from '../../lib/play-character';
import { usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { gearCount, type PaperChange } from '../../lib/play-inventory';
import { XRef } from '../bits';
import { StatusIcon } from '../StatusIcon';
import { PhysicalDiceRoll } from '../PhysicalDiceRoll';
import { PhysicalSkillRoll, skillCheckSucceeded } from '../PhysicalSkillRoll';
import '../../styles/play-exhaustion.css';

/** Room slot (under the character scope) that holds the paper changes recorded from the character tab. */
export const CHARACTER_LOG_SLOT = 'character/sheet-log';
const METER_MAX = 22;
const AMOUNTS = [1, 2, 5] as const;
const DICE = ['D4', 'D6'] as const;

export function ExhaustionMeter({ value }: { value: number }) {
  const band = exhaustionBand(value);
  return (
    <div className="exhaustion-meter" role="img" aria-label={`Exhaustion ${value} · ${band.short}`}>
      <div className="exhaustion-meter-bar">
        {EXHAUSTION_BANDS.map((item) => (
          <span key={item.min} className="exhaustion-meter-band" data-band={item.min} data-current={item === band || undefined}
            style={{ flexGrow: Math.min(item.max, METER_MAX - 1) - item.min + 1 }}>
            <span className="exhaustion-meter-range">{item.max >= 99 ? `${item.min}+` : `${item.min}–${item.max}`}</span>
          </span>
        ))}
        <span className="exhaustion-meter-mark" style={{ insetInlineStart: `${(Math.min(value, METER_MAX - 0.5) + 0.5) / METER_MAX * 100}%` }} aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * Exhaustion (p.90) as a running score: the value from the paper sheet plus everything this place has recorded.
 * Eating, raw ingredients and any rolled gain or loss are recorded here and join the place's paper changes.
 */
export function PlayExhaustion() {
  const pc = usePlayCharacter();
  const commit = usePlayRoll();
  const [allLog, setLog] = usePlayDraftState<PaperChange[]>('sheet-log', []);
  const log = allLog.filter(({ text }) => /Exhaustion/.test(text));
  const [typed, setTyped] = useState<string | null>(null);
  const [direction, setDirection] = useState<'+' | '−'>('+');
  const [reason, setReason] = useState('');
  const [die, setDie] = useState<(typeof DICE)[number] | null>(null);
  const [eating, setEating] = useState(false);
  const [rawRound, setRawRound] = useState(0);
  if (!pc) return null;
  const { character, room } = pc;
  const value = pc.exhaustion;
  const band = value === undefined ? undefined : exhaustionBand(value);
  const next = band && EXHAUSTION_BANDS[EXHAUSTION_BANDS.indexOf(band) + 1];
  const setCurrent = (score: number) => pc.update({ exhaustion: Math.max(0, Math.min(99, score)) - room.exhaustion });
  const record = (change: Omit<PaperChange, 'id'>) =>
    commit(() => setLog((previous) => [...previous, { id: `exhaustion-${crypto.randomUUID()}`, ...change }]));
  const amountText = (amount: number) => `Exhaustion ${direction}${amount}${reason.trim() ? ` (${reason.trim()})` : ''}`;
  const rawResult = (result: CheckResult) => {
    const passed = skillCheckSucceeded(result);
    record({ text: `Exhaustion −1 (날 Cooking Ingredients · Endurance ${passed ? '성공' : '실패 · Health −1'})`, gear: gearCount('Cooking Ingredients', -1) });
    setEating(false);
    setRawRound((round) => round + 1);
  };
  const others = room.exhaustionItems.filter((text) => !log.some((item) => item.text === text));

  return (
    <section className="play-exhaustion" aria-labelledby="play-exhaustion-title">
      <div className="play-exhaustion-head">
        <h3 id="play-exhaustion-title" className="status-label"><StatusIcon kind="exhaustion" />Exhaustion</h3>
        <div className="play-exhaustion-value" role="group" aria-label="현재 Exhaustion">
          <button type="button" className="edge-btn" aria-label="Exhaustion 1 낮추기 (종이 값 맞추기)" disabled={!value}
            onClick={() => setCurrent((value ?? 0) - 1)}>−</button>
          <input inputMode="numeric" maxLength={2} aria-label="현재 Exhaustion" value={typed ?? (value === undefined ? '' : String(value))}
            placeholder="0" onBlur={() => setTyped(null)} onChange={(event) => {
              setTyped(event.target.value);
              const raw = event.target.value.trim();
              if (!raw) pc.update({ exhaustion: undefined });
              else if (/^\d{1,2}$/.test(raw)) setCurrent(Number(raw));
            }} />
          <button type="button" className="edge-btn" aria-label="Exhaustion 1 올리기 (종이 값 맞추기)" onClick={() => setCurrent((value ?? 0) + 1)}>+</button>
        </div>
      </div>
      {value === undefined ? <p className="play-exhaustion-note">종이 시트의 Exhaustion을 적으면 구간 효과를 보여 주고 판정 칸에 알려 줍니다.</p> : <>
        <ExhaustionMeter value={value} />
        <p className={`play-exhaustion-effect${value >= 16 ? ' is-danger' : value >= 11 ? ' is-warn' : ''}`} role="status">
          <strong>{band!.short}</strong> · {band!.text}{next && ` 다음 구간(${next.min})까지 ${next.min - value}.`}
        </p>
        {room.exhaustion !== 0 && <p className="play-exhaustion-note">이번 장소 기록 {room.exhaustion > 0 ? '+' : '−'}{Math.abs(room.exhaustion)} 포함 ·
          {' '}장소 시작 {Math.max(0, (character.exhaustion ?? 0))}</p>}
      </>}
      <div className="play-exhaustion-actions">
        <button type="button" className="btn ghost" onClick={() => record({ text: 'Exhaustion −1 (Ration)', gear: gearCount('Ration', -1) })}>Ration 먹기 · −1</button>
        <button type="button" className="btn ghost" aria-expanded={eating} onClick={() => setEating((open) => !open)}>날 재료 먹기 · −1</button>
      </div>
      <p className="play-exhaustion-note">전투 중에는 먹을 수 없음</p>
      {eating && <div className="play-exhaustion-raw">
        <p className="play-exhaustion-note">Cooking Ingredients 1개를 날로 먹어 Exhaustion −1. Endurance 판정에 실패하면 Health 피해 1.</p>
        <PhysicalSkillRoll key={rawRound} label="날 재료 Endurance 판정" skill="Endurance" slot={`raw-food-${rawRound}`}
          initialSkill={pc.skill('Endurance')} onResult={rawResult} />
      </div>}
      <fieldset className="play-exhaustion-roll">
        <legend>얻거나 줄인 Exhaustion 기록</legend>
        <div className="play-exhaustion-roll-row">
          <div className="edge-toggle play-exhaustion-direction" role="group" aria-label="방향">
            <button type="button" className="edge-btn edge-plus" aria-pressed={direction === '+'} onClick={() => setDirection('+')}>+<span className="sr-only"> 얻음</span></button>
            <span className="edge-state">{direction === '+' ? '얻음' : '줄임'}</span>
            <button type="button" className="edge-btn edge-minus" aria-pressed={direction === '−'} onClick={() => setDirection('−')}>−<span className="sr-only"> 줄임</span></button>
          </div>
          <label className="field play-exhaustion-reason"><span>이유 (선택)</span>
            <input value={reason} maxLength={40} onChange={(event) => setReason(event.target.value)} placeholder="예: 화산열" /></label>
        </div>
        <div className="play-exhaustion-amounts" role="group" aria-label="양">
          {AMOUNTS.map((amount) => <button key={amount} type="button" className="btn ghost"
            onClick={() => { record({ text: amountText(amount) }); setDie(null); }}>{direction}{amount}</button>)}
          {DICE.map((dice) => <button key={dice} type="button" className="btn ghost" aria-pressed={die === dice}
            onClick={() => setDie(die === dice ? null : dice)}>{direction}{dice}</button>)}
        </div>
        {die && <PhysicalDiceRoll key={`${die}${direction}`} label={`Exhaustion ${direction === '+' ? '증가' : '감소'}`} dice={die}
          onValue={(result) => { record({ text: amountText(result.total) }); setDie(null); }} />}
      </fieldset>
      {(log.length > 0 || others.length > 0) && <ul className="play-exhaustion-log" aria-label="이번 장소 Exhaustion 기록">
        {log.map((item) => <li key={item.id}>{item.text}
          <button type="button" className="linkbtn" onClick={() => commit(() => setLog((previous) => previous.filter(({ id }) => id !== item.id)))}>지우기</button></li>)}
        {others.map((text, index) => <li key={`${index}:${text}`} className="is-elsewhere">{text}</li>)}
      </ul>}
      <XRef id="exhaustion">Exhaustion 규칙</XRef>
    </section>
  );
}
