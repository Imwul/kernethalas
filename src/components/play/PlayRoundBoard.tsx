import { useState, type FormEvent } from 'react';
import { titleOf } from '../../content';
import { usePlayDraftState } from '../../lib/play-draft';
import { XRef } from '../bits';
import { TogglePanel } from '../TogglePanel';
import { COMBAT_ROUND_EVENT } from './PlayLingering';
import '../../styles/play-combat-tools.css';

const TIMING_LABELS = {
  start: '자기 턴 시작',
  end: '자기 턴 종료',
  round: '라운드마다',
} as const;
type Timing = keyof typeof TIMING_LABELS;

const EFFECTS = {
  bleeding: { timing: 'round', cue: '매 라운드 표시된 수치만큼 피해.' },
  burning: { timing: 'start', cue: '화상 유지와 표준 행동으로 해제할지 확인.' },
  poisoned: { timing: 'round', cue: '라운드 피해 확인. 중독된 다음 라운드부터 자기 턴에 자유 행동으로 Endurance 저항.' },
  frightened: { timing: 'end', cue: '자기 턴 종료마다 공포 수치 −10.' },
  dazed: { timing: 'round', cue: '공격을 시작할 수 없는 남은 라운드 확인.' },
  stunned: { timing: 'round', cue: '행동할 수 없는 남은 라운드 확인.' },
  freezing: { timing: 'round', cue: '첫 라운드 후부터 매 라운드 Endurance 판정.' },
  custom: { timing: 'start', cue: '' },
} as const satisfies Record<string, { timing: Timing; cue: string }>;
type Effect = keyof typeof EFFECTS;

type Combatant = { id: string; label: string };
type Position = { round: number; timing: Timing; actor: string | null };
type ReminderDraft = { actor: string; effect: Effect; timing: Timing; note: string };
type Reminder = ReminderDraft & { id: string; checkedAt?: string };

const PLAYER = { id: 'pc', label: 'PC' };
const FIRST_ROUND: Position = { round: 1, timing: 'round', actor: null };
const DEFAULT_REMINDER: ReminderDraft = { actor: 'pc', effect: 'bleeding', timing: 'round', note: '' };

/** The current round, for the combat tool strip. Read inside the encounter's tool scope. */
export function PlayRoundNumber() {
  const [position] = usePlayDraftState<Position>('round-position', FIRST_ROUND);
  return <>{position.round}</>;
}

export function PlayRoundBoard({ targets }: { targets: readonly Combatant[] }) {
  const [position, setPosition] = usePlayDraftState<Position>('round-position', FIRST_ROUND);
  const [actor, setActor] = usePlayDraftState('round-actor', PLAYER.id);
  const [reminders, setReminders] = usePlayDraftState<Reminder[]>('round-reminders', []);
  const [draft, setDraft] = useState<ReminderDraft>(DEFAULT_REMINDER);
  const combatants = [PLAYER, ...targets];
  const nameFor = (id: string | null) => combatants.find((person) => person.id === id)?.label;
  const currentActor = nameFor(actor) ? actor : PLAYER.id;
  const phaseName = nameFor(position.actor);
  const timeKey = `${position.round}/${position.timing}/${position.actor ?? ''}`;
  const due = (reminder: Reminder) => reminder.timing === position.timing
    && (reminder.timing === 'round' || reminder.actor === position.actor);
  const activeReminders = reminders.filter(({ actor: target }) => nameFor(target));
  const visibleReminders = [...activeReminders.filter(due), ...activeReminders.filter((reminder) => !due(reminder))];
  const draftActor = nameFor(draft.actor) ? draft.actor : PLAYER.id;

  function add(event: FormEvent) {
    event.preventDefault();
    const note = draft.note.trim();
    if (draft.effect === 'custom' && !note) return;
    setReminders((previous) => [...previous, { ...draft, actor: draftActor, note, id: crypto.randomUUID() }]);
    setDraft((previous) => ({ ...previous, note: '' }));
  }

  return (
      <section className="play-combat-tools play-combat-tool-body" aria-label="전투 턴·라운드 체크판">
        <div className="play-round-status" role="status">
          <strong>{position.round}라운드</strong>
          <span>{position.timing === 'round' ? '라운드 시작'
            : phaseName ? `${phaseName} 턴 ${position.timing === 'start' ? '시작' : '종료'}` : '턴 대상 선택'}</span>
        </div>
        <div className="play-combat-tool-controls">
          <label className="field"><span>턴을 확인할 대상</span>
            <select value={currentActor} onChange={(event) => setActor(event.target.value)}>
              {combatants.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <div className="play-round-buttons" role="group" aria-label="전투 시점">
            <button type="button" className="btn ghost" onClick={() => setPosition({ ...position, timing: 'start', actor: currentActor })}>턴 시작</button>
            <button type="button" className="btn ghost" onClick={() => setPosition({ ...position, timing: 'end', actor: currentActor })}>턴 종료</button>
            <button type="button" className="btn ghost" onClick={() => {
              setPosition((previous) => ({ round: previous.round + 1, timing: 'round', actor: null }));
              document.dispatchEvent(new CustomEvent(COMBAT_ROUND_EVENT, { detail: position.round + 1 }));
            }}>다음 라운드</button>
          </div>
        </div>
        <div className="play-round-rules">
          {position.timing === 'round' && <p><XRef id="defense-reaction-penalty">연속 방어 페널티</XRef> 초기화를 확인하세요.</p>}
          {position.timing !== 'round' && <XRef id="defense-reaction-penalty">연속 방어 페널티</XRef>}
          <XRef id="conditions">지속 피해와 상태</XRef>
        </div>

        {visibleReminders.length > 0 && (
          <ul className="play-round-reminders" aria-label="등록한 효과">
            {visibleReminders.map((reminder) => {
              const { id, effect, timing, note, checkedAt } = reminder;
              const isDue = due(reminder);
              const title = effect === 'custom' ? note : titleOf(effect).ko;
              return <li key={id} data-due={isDue || undefined}>
                <div className="play-round-reminder-text">
                  <strong>{effect === 'custom' ? title : <XRef id={effect}>{title}</XRef>}{effect !== 'custom' && note && ` ${note}`}</strong>
                  <span>{nameFor(reminder.actor)} · {TIMING_LABELS[timing]}</span>
                  {isDue && EFFECTS[effect].cue && <p>{EFFECTS[effect].cue}</p>}
                </div>
                <div className="play-round-reminder-actions">
                  {isDue && <label className="play-combat-tool-check">
                    <input type="checkbox" aria-label={`확인 · ${title}`} checked={checkedAt === timeKey}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setReminders((previous) => previous.map((item) => item.id === id
                          ? { ...item, checkedAt: checked ? timeKey : undefined } : item));
                      }} />
                    확인
                  </label>}
                  <button type="button" className="btn ghost" aria-label={`${title} 확인 항목 제거`}
                    onClick={() => setReminders((previous) => previous.filter((item) => item.id !== id))}>제거</button>
                </div>
              </li>;
            })}
          </ul>
        )}

        <TogglePanel className="play-round-add" label="확인 항목 추가">
          <form className="play-round-form" onSubmit={add}>
            <label className="field"><span>효과 대상</span>
              <select value={draftActor} onChange={(event) => setDraft({ ...draft, actor: event.target.value })}>
                {combatants.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="field"><span>확인할 효과</span>
              <select value={draft.effect} onChange={(event) => {
                const effect = event.target.value as Effect;
                setDraft({ ...draft, effect, timing: EFFECTS[effect].timing });
              }}>
                {(Object.keys(EFFECTS) as Effect[]).map((effect) =>
                  <option key={effect} value={effect}>{effect === 'custom' ? '직접 입력' : titleOf(effect).ko}</option>)}
              </select>
            </label>
            <label className="field"><span>확인 시점</span>
              <select value={draft.timing} onChange={(event) => setDraft({ ...draft, timing: event.target.value as Timing })}>
                {Object.entries(TIMING_LABELS).map(([timing, label]) => <option key={timing} value={timing}>{label}</option>)}
              </select>
            </label>
            <label className="field"><span>{draft.effect === 'custom' ? '효과 이름' : '수치·메모 (선택)'}</span>
              <input value={draft.note} maxLength={120} required={draft.effect === 'custom'}
                onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
            </label>
            <button type="submit" className="btn ghost" disabled={draft.effect === 'custom' && !draft.note.trim()}>효과 추가</button>
          </form>
        </TogglePanel>
      </section>
  );
}
