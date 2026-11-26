import { useState } from 'react';
import { journalRow } from '../../lib/loot-journal';
import type { CheckResult } from '../../lib/dice';
import { usePlayCharacter } from '../../lib/play-character';
import { usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import type { PaperChange } from '../../lib/play-inventory';
import { GROWTH_SKILLS } from '../../lib/skill-growth';
import { XRef } from '../bits';
import { StatusIcon } from '../StatusIcon';
import { JournalRoll } from '../LootJournal';
import { PhysicalDiceRoll } from '../PhysicalDiceRoll';
import { PhysicalSkillRoll, skillCheckSucceeded } from '../PhysicalSkillRoll';

const LOSSES = [1, 2, 4] as const;
const LOSS_DICE = ['D4', 'D6'] as const;
const RECOVERIES = [1, 2] as const;

/** Running Sanity, Resolve checks against a loss, and the Madness roll at 0 (pp.91–92). */
export function PlaySanity({ onDeath }: { onDeath: (cause: string) => void }) {
  const pc = usePlayCharacter();
  const commit = usePlayRoll();
  const [log, setLog] = usePlayDraftState<PaperChange[]>('sheet-log', []);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [loss, setLoss] = useState<{ amount: number | null; dice?: string; reason: string } | null>(null);
  const [round, setRound] = useState(0);
  const [madnessRoll, setMadnessRoll] = useState<number | null>(null);
  const [skill, setSkill] = useState('');
  const [bruise, setBruise] = useState<number | null>(null);
  if (!pc) return null;
  const { character, room } = pc;
  const value = pc.sanity;
  const max = character.sanityMax;
  const effects = pc.madness;
  const record = (text: string) => commit(() => setLog((previous) => [...previous, { id: `sanity-${crypto.randomUUID()}`, text }]));
  const setCurrent = (score: number) => pc.update({ sanity: Math.max(0, Math.min(999, score)) - room.sanity });
  const field = (key: string, shown: string, save: (score: number | undefined) => void) => (
    <input inputMode="numeric" maxLength={3} value={typed[key] ?? shown} aria-label={key === 'max' ? '최대 Sanity' : '현재 Sanity'}
      onBlur={() => setTyped(({ [key]: _, ...rest }) => rest)} onChange={(event) => {
        setTyped((previous) => ({ ...previous, [key]: event.target.value }));
        const raw = event.target.value.trim();
        if (!raw) save(undefined);
        else if (/^\d{1,3}$/.test(raw)) save(Number(raw));
      }} />
  );
  const lossText = (amount: number, reason: string, failed: boolean) =>
    `Sanity −${amount}${reason || failed ? ` (${[reason, failed ? 'Resolve 실패' : ''].filter(Boolean).join(' · ')})` : ''}`;
  const resolveLoss = (result: CheckResult) => {
    if (!loss?.amount) return;
    if (skillCheckSucceeded(result)) record(`Resolve 성공 · Sanity 유지${loss.reason ? ` (${loss.reason})` : ''}`);
    else record(lossText(loss.amount, loss.reason, true));
    setLoss(null);
    setRound((count) => count + 1);
  };
  const madness = madnessRoll === null ? null : Math.max(1, madnessRoll - effects.rollPenalty);
  const row = journalRow('t-madness', madness);
  const applyMadness = () => {
    if (madness === null) return;
    const sideEffects: string[] = [];
    if (madness === 3) sideEffects.push('최대 Toughness −1 (광기)');
    if (madness === 8 && skill) sideEffects.push(`${skill} −10 (광기)`);
    if (madness === 9 && bruise !== null) sideEffects.push(`Bludgeoning 피해 ${bruise} (광기 · Armor 무시)`);
    if (madness === 10) sideEffects.push('XP +100 (광기)');
    commit(() => {
      pc.update({ madness: [...(character.madness ?? []), madness], ...(max !== undefined ? { sanity: max - room.sanity } : {}) });
      if (madness === 8 && skill) {
        const current = Number(pc.skill(skill));
        if (Number.isFinite(current) && pc.skill(skill)) pc.setSkill(skill, Math.max(0, current - 10));
      }
      setLog((previous) => [...previous, ...[`광기 D10 ${madness}${max !== undefined ? ` · Sanity ${max}으로 회복` : ''}`, ...sideEffects]
        .map((text) => ({ id: `madness-${crypto.randomUUID()}`, text }))]);
    });
    setMadnessRoll(null);
    setSkill('');
    setBruise(null);
    if (madness === 1) onDeath('광기');
  };
  const active = [
    effects.rollPenalty && `광기 굴림 −${effects.rollPenalty}`,
    effects.toughnessMax && `최대 Toughness −${effects.toughnessMax}`,
    effects.extraSanityLoss && `Sanity 손실 +${effects.extraSanityLoss}`,
    effects.scavenging && `뒤지기 −${effects.scavenging}`,
    effects.resolve && `Resolve −${effects.resolve}`,
    effects.xpLoss && `XP 획득마다 −${effects.xpLoss}`,
  ].filter(Boolean);
  const ratio = value !== undefined && max ? Math.min(100, value / max * 100) : null;

  return (
    <section className="play-exhaustion play-sanity" aria-labelledby="play-sanity-title">
      <div className="play-exhaustion-head">
        <h3 id="play-sanity-title" className="status-label"><StatusIcon kind="sanity" />Sanity</h3>
        <div className="play-sanity-values">
          <div className="play-exhaustion-value" role="group" aria-label="현재 Sanity">
            <button type="button" className="edge-btn" aria-label="Sanity 1 낮추기 (종이 값 맞추기)" disabled={!value} onClick={() => setCurrent((value ?? 0) - 1)}>−</button>
            {field('current', value === undefined ? '' : String(value), (score) => score === undefined ? pc.update({ sanity: undefined }) : setCurrent(score))}
            <button type="button" className="edge-btn" aria-label="Sanity 1 올리기 (종이 값 맞추기)" onClick={() => setCurrent((value ?? 0) + 1)}>+</button>
          </div>
          <label className="play-sanity-max"><span>최대</span>{field('max', max === undefined ? '' : String(max), (score) => pc.update({ sanityMax: score }))}</label>
        </div>
      </div>
      {ratio !== null && <div className="play-character-xp-bar play-sanity-bar" aria-hidden="true"><span style={{ inlineSize: `${ratio}%` }} /></div>}
      {room.sanity !== 0 && <p className="play-exhaustion-note">이번 장소 기록 {room.sanity > 0 ? '+' : '−'}{Math.abs(room.sanity)} 포함</p>}
      {active.length > 0 && <p className="play-sanity-madness" role="status"><strong>광기 누적</strong> · {active.join(' · ')}</p>}

      {value === 0 && <div className="play-alert is-danger" role="alert">
        <p className="play-alert-title status-label"><StatusIcon kind="madness" />Sanity 0 · 광기 판정</p>
        <JournalRoll tableId="t-madness" label="광기" value={madnessRoll} onValue={setMadnessRoll}
          resultText={madness === null ? undefined : `${effects.rollPenalty ? `${madnessRoll} − ${effects.rollPenalty} = ${madness} · ` : ''}${row?.ko ?? ''}`} />
        {madness === 8 && <div className="creator-filter-chips" role="group" aria-label="10 낮출 Skill">
          {GROWTH_SKILLS.map((name) => <button key={name} type="button" aria-pressed={skill === name} onClick={() => setSkill(name)}>{name}</button>)}
        </div>}
        {madness === 9 && <PhysicalDiceRoll label="광기 Bludgeoning" dice="2D6" onValue={(result) => setBruise(result.total)}
          resultText={(result) => `Bludgeoning 피해 ${result.total} · Armor 무시`} />}
        {madness !== null && <button type="button" className="btn primary" disabled={(madness === 8 && !skill) || (madness === 9 && bruise === null)}
          onClick={applyMadness}>{madness === 1 ? '사망 기록' : max !== undefined ? `광기 기록 · Sanity ${max}으로 회복` : '광기 기록'}</button>}
        {max === undefined && <p className="play-exhaustion-note">최대 Sanity를 적으면 광기 뒤 회복값을 채웁니다.</p>}
      </div>}

      <fieldset className="play-exhaustion-roll">
        <legend>Sanity 손실·회복</legend>
        <div className="play-exhaustion-amounts" role="group" aria-label="잃을 Sanity">
          {LOSSES.map((amount) => <button key={amount} type="button" className="btn ghost" aria-pressed={loss?.amount === amount && !loss.dice}
            onClick={() => setLoss({ amount, reason: loss?.reason ?? '' })}>−{amount}</button>)}
          {LOSS_DICE.map((dice) => <button key={dice} type="button" className="btn ghost" aria-pressed={loss?.dice === dice}
            onClick={() => setLoss({ amount: null, dice, reason: loss?.reason ?? '' })}>−{dice}</button>)}
          {RECOVERIES.map((amount) => <button key={`+${amount}`} type="button" className="btn ghost"
            onClick={() => record(`Sanity +${amount}`)}>+{amount}</button>)}
        </div>
        {loss && <div className="play-alert" role="group" aria-label="Sanity 손실 처리">
          <label className="field play-exhaustion-reason"><span>이유 (선택)</span>
            <input value={loss.reason} maxLength={40} placeholder="예 Horrifying" onChange={(event) => setLoss({ ...loss, reason: event.target.value })} /></label>
          {loss.dice && loss.amount === null && <PhysicalDiceRoll key={loss.dice} label="잃을 Sanity" dice={loss.dice}
            onValue={(result) => setLoss({ ...loss, amount: result.total })} resultText={(result) => `Sanity −${result.total}`} />}
          {loss.amount !== null && <>
            <PhysicalSkillRoll key={round} label="Resolve 저항 판정" skill="Resolve" slot={`sanity-resolve-${round}`} onResult={resolveLoss} />
            <button type="button" className="linkbtn" onClick={() => { record(lossText(loss.amount!, loss.reason, false)); setLoss(null); }}>
              판정 없이 −{loss.amount}{effects.extraSanityLoss ? ` (광기로 +${effects.extraSanityLoss})` : ''}</button>
          </>}
        </div>}
      </fieldset>
      {log.filter(({ text }) => /Sanity|광기|Resolve/.test(text)).length > 0 && <ul className="play-exhaustion-log" aria-label="이번 장소 Sanity 기록">
        {log.filter(({ text }) => /Sanity|광기|Resolve/.test(text)).map((item) => <li key={item.id}>{item.text}
          <button type="button" className="linkbtn" onClick={() => commit(() => setLog((previous) => previous.filter(({ id }) => id !== item.id)))}>지우기</button></li>)}
      </ul>}
      <span className="play-character-links"><XRef id="sanity">Sanity 규칙</XRef><XRef id="t-madness">광기 표</XRef></span>
    </section>
  );
}

