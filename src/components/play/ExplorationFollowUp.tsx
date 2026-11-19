import { useCallback, useEffect, useMemo, useState } from 'react';
import { tableById } from '../../content';
import type { RollResult } from '../../lib/dice';
import { followUpSteps, type FollowAnswers, type FollowStep } from '../../lib/exploration-follow-up';
import { journalRow } from '../../lib/loot-journal';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraftState } from '../../lib/play-draft';
import type { GearEffect } from '../../lib/play-inventory';
import { XRef } from '../bits';
import { PhysicalSkillRoll, skillCheckSucceeded } from '../PhysicalSkillRoll';
import { PhysicalDiceRoll } from '../PhysicalDiceRoll';
import type { ActionSheetItem } from './PlayExplorationActions';
import { PlayRoll } from './PlayRoll';
import { SpoilsRoll } from './PlayWrapUp';
import '../../styles/exploration-follow-up.css';

export interface FollowUpReport {
  items: ActionSheetItem[];
  darkness: number | null;
}

export const EMPTY_FOLLOW_UP: FollowUpReport = { items: [], darkness: null };
const EMPTY_STEPS: FollowStep[] = [];
type LootResult = { text: string; gear?: GearEffect };

function defaults(steps: FollowStep[]) {
  return Object.fromEntries(steps.flatMap((step) => step.kind === 'count' && step.initial != null ? [[step.id, step.initial]] : []));
}

function diceFor(step: Extract<FollowStep, { kind: 'roll' }>, answers: FollowAnswers) {
  return typeof step.dice === 'function' ? step.dice(answers) : step.dice;
}

export function ExplorationFollowUp({ kind, row, darknessEffectCount, onReport, onCombat, onTrader }: {
  kind: 'event' | 'darkness';
  row: number | undefined;
  darknessEffectCount?: number;
  onReport: (report: FollowUpReport) => void;
  onCombat?: () => void;
  onTrader?: () => void;
}) {
  const clear = useClearPlayDraftScope();
  const [answers, setAnswers] = usePlayDraftState<FollowAnswers>('answers', {});
  const [rolls, setRolls] = usePlayDraftState<Record<string, RollResult>>('rolls', {});
  const [loot, setLoot] = useState<Record<string, LootResult>>({});
  const [nested, setNested] = useState(EMPTY_FOLLOW_UP);
  const steps = useMemo(() => row === undefined ? EMPTY_STEPS : followUpSteps(kind, row, darknessEffectCount) ?? EMPTY_STEPS, [kind, row, darknessEffectCount]);
  const values = useMemo(() => ({ ...defaults(steps), ...answers }), [steps, answers]);
  const visible = useMemo(() => steps.filter((step) => !step.when || step.when(values)), [steps, values]);
  const nestedDarkness = visible.some(({ id }) => id === 't-growing-darkness') && typeof values['t-growing-darkness'] === 'number'
    ? values['t-growing-darkness'] : null;
  const report = useMemo(() => {
    const items = visible.flatMap<ActionSheetItem>((step) => {
      let text = '';
      let gear: GearEffect | undefined;
      if (step.kind === 'paper') {
        text = typeof step.text === 'function' ? step.text(values) : step.text;
        gear = step.gear;
      }
      if (step.kind === 'roll' && rolls[step.id]?.expr === diceFor(step, values)) {
        text = step.text(rolls[step.id]);
        gear = step.gear?.(rolls[step.id]);
      }
      if (step.kind === 'spoils') ({ text = '', gear } = loot[step.id] ?? {});
      if (step.kind === 'table' && typeof values[step.id] === 'number') {
        const result = journalRow(step.table, values[step.id] as number);
        const table = tableById.get(step.table);
        if (result && table) text = `${table.ko} ${table.dice} ${values[step.id]} · ${result.ko}`;
      }
      return text ? [{ id: `${kind}-${row}-${step.id}`, text, gear }] : [];
    });
    if (nestedDarkness !== null) items.push(...nested.items.map((item) => ({ ...item, id: `${kind}-${row}-${item.id}` })));
    return { items, darkness: nestedDarkness };
  }, [kind, row, loot, nested, nestedDarkness, rolls, values, visible]);
  useEffect(() => { onReport(report); }, [onReport, report]);

  const applyAnswer = (id: string, value: string | number) => {
    if (values[id] === value) return;
    const next = { ...values, [id]: value };
    const hidden = steps.filter((step) => step.when && !step.when(next));
    for (const { id: hiddenId } of hidden) delete next[hiddenId];
    // Re-check in reading order in case a hidden check had an answer of its own.
    const invalidated = steps.filter((step) => step.when && !step.when(next));
    if (invalidated.length > 0) {
      invalidated.forEach((step) => clear(step.id));
      const ids = new Set(invalidated.map((step) => step.id));
      setRolls((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !ids.has(key))));
      setLoot((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !ids.has(key))));
    }
    if (id === 't-growing-darkness' || invalidated.some((step) => step.id === 't-growing-darkness')) {
      clear('nested-darkness');
      setNested(EMPTY_FOLLOW_UP);
    }
    setAnswers(next);
  };
  const reportLoot = useCallback((id: string, result: LootResult) => {
    setLoot((current) => JSON.stringify(current[id]) === JSON.stringify(result) ? current : { ...current, [id]: result });
  }, []);

  if (!steps.length) return null;
  const label = kind === 'event' ? '이벤트 후속 판정' : '짙어지는 어둠 후속 판정';
  return (
    <section className="exploration-follow-up" aria-label={label}>
      <h3>{label}</h3>
      {visible.map((step) => {
        if (step.kind === 'check') return <PlayDraftScope name={step.id} key={step.id}>
          <PhysicalSkillRoll label={`${step.skill} 판정`} skill={step.skill} onResult={(result) => applyAnswer(step.id, skillCheckSucceeded(result) ? 'success' : 'failure')}
            onClear={() => applyAnswer(step.id, '')} />
        </PlayDraftScope>;
        if (step.kind === 'choice') return <label className="field exploration-follow-choice" key={step.id}>
          <span>{step.label}</span><select value={values[step.id] ?? ''} onChange={(event) => applyAnswer(step.id, event.target.value)}>
            <option value="">선택</option>{step.options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>;
        if (step.kind === 'count') return <label className="field exploration-follow-choice" key={step.id}>
          <span>{step.label}</span><input inputMode="numeric" value={values[step.id] ?? ''} placeholder="0 이상"
            onChange={(event) => {
              const raw = event.target.value.trim();
              const parsed = /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
              if (raw === '' || parsed >= 0 && parsed <= 100) applyAnswer(step.id, raw ? parsed : '');
            }} />
        </label>;
        if (step.kind === 'roll') {
          const expr = diceFor(step, values);
          return <PhysicalDiceRoll key={`${step.id}-${expr}`} label={step.label} dice={expr} value={rolls[step.id]}
            resultText={step.text} onValue={(next) => {
              setRolls((current) => ({ ...current, [step.id]: next }));
              applyAnswer(step.id, next.total);
            }} />;
        }
        if (step.kind === 'table') {
          const table = tableById.get(step.table);
          const value = typeof values[step.id] === 'number' ? values[step.id] as number : null;
          const ambush = journalRow(step.table, value)?.next?.some(({ id }) => id === 't-encounter-general');
          return table && <PlayDraftScope name={step.id} key={step.id}>
            <PlayRoll label={table.ko} table={table} value={value} onValue={(roll) => applyAnswer(step.id, roll ?? '')} />
            {ambush && onCombat && <button className="btn ghost exploration-follow-button" type="button" onClick={onCombat}>어둠 속 매복 조우로</button>}
          </PlayDraftScope>;
        }
        if (step.kind === 'spoils') return <FollowSpoils key={step.id} id={step.id} onLoot={reportLoot} />;
        if (step.kind === 'link') return <XRef key={step.id} id={step.dest} />;
        if (step.kind === 'combat' && onCombat) return <button key={step.id} type="button" className="btn ghost exploration-follow-button" onClick={onCombat}>{step.label}</button>;
        if (step.kind === 'trader') return onTrader
          ? <button key={step.id} type="button" className="btn ghost exploration-follow-button" onClick={onTrader}>{step.label}</button>
          : <XRef key={step.id} id="traders" />;
        return null;
      })}
      {nestedDarkness !== null && <PlayDraftScope name="nested-darkness">
        <ExplorationFollowUp key={nestedDarkness} kind="darkness" row={journalRow('t-growing-darkness', nestedDarkness)?.min}
          darknessEffectCount={darknessEffectCount} onReport={setNested} onCombat={onCombat} />
      </PlayDraftScope>}
      {report.items.length > 0 && <ul className="exploration-follow-results" aria-label="종이 시트에 반영할 결과">
        {report.items.map(({ id, text }) => <li key={id}>{text}</li>)}
      </ul>}
      <XRef id={kind === 'event' ? 't-events' : 't-growing-darkness'} />
    </section>
  );
}

function FollowSpoils({ id, onLoot }: { id: string; onLoot: (id: string, result: LootResult) => void }) {
  const [result, setResult] = useState({ main: '', sheet: '' });
  const [gear, setGear] = useState<GearEffect>();
  const reportMain = useCallback((main: string) => setResult((current) => current.main === main ? current : { ...current, main }), []);
  const reportSheet = useCallback((sheet: string) => setResult((current) => current.sheet === sheet ? current : { ...current, sheet }), []);
  useEffect(() => { onLoot(id, { text: result.sheet || result.main, gear }); }, [id, onLoot, result, gear]);
  return <PlayDraftScope name={id}><SpoilsRoll tableId="t-spoils" onReport={reportMain} onSheetChange={reportSheet} onGearChange={setGear} /></PlayDraftScope>;
}
