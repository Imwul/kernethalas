import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { PLAY_PENDING_TARGET_LIMIT, type PendingPlayRoll } from '../../lib/play-pending-rolls';
import '../../styles/play-pending-rolls.css';

type Stage = PendingPlayRoll['stage'];
type Candidate = Pick<PendingPlayRoll, 'field' | 'label' | 'dice' | 'wrapBattleId'>;

const STAGE_LABELS: Record<Stage, string> = { explore: '탐험', combat: '조우·전투', wrapup: '휴식·정리', journal: '저널' };

function fieldContext(input: HTMLInputElement, section: HTMLElement) {
  const names: string[] = [];
  for (let node = input.parentElement; node && node !== section; node = node.parentElement) {
    if (!node.matches('section, [role="region"]')) continue;
    const id = node.getAttribute('aria-labelledby');
    const name = node.getAttribute('aria-label') || (id ? document.getElementById(id)?.textContent?.trim() : '');
    if (name) names.push(name);
  }
  return names;
}

function visiblePendingRolls(section: HTMLElement, wrapBattleId?: string) {
  const fields = section.querySelectorAll<HTMLInputElement>('input[data-play-roll-pending][data-play-roll-field]');
  const candidates = new Map<string, Candidate & { contexts: string[] }>();
  for (const input of fields) {
    const { playRollField: field, playRollLabel: label, playRollDie: dice } = input.dataset;
    if (!field || field.length > 600 || !label || input.disabled || input.closest('[hidden], details:not([open])')
      || input.getClientRects().length === 0 || candidates.has(field)) continue;
    const battleSpecific = wrapBattleId && (field.startsWith(`wrap/${encodeURIComponent(`${wrapBattleId}:`)}`)
      || /^wrap\/journal:(?:전투 후 Toughness 회복|.+ 처치 후 Sanity 회복)$/.test(field));
    candidates.set(field, { field, label, dice: dice?.slice(0, 48) ?? '', ...(battleSpecific ? { wrapBattleId } : {}),
      contexts: fieldContext(input, section) });
  }
  const entries = [...candidates.values()];
  return entries.map(({ label, contexts, ...candidate }): Candidate => {
    const shared = entries.filter((entry) => entry.label === label && entry.dice === candidate.dice);
    if (shared.length === 1) return { ...candidate, label: label.slice(0, 240) };
    const other = shared.filter((entry) => entry.field !== candidate.field);
    const suffix = contexts.find((name) => other.every(({ contexts }) => !contexts.includes(name)))
      ?? `${shared.findIndex((entry) => entry.field === candidate.field) + 1}번째`;
    return { ...candidate, label: `${label} · ${suffix}`.slice(0, 240) };
  });
}

export function PlayPendingRolls({ open, stage, roomId, place, wrapBattleId, rolls, onChange, onJump }: {
  open: boolean;
  stage: Stage;
  roomId: string;
  place: string;
  wrapBattleId?: string;
  rolls: PendingPlayRoll[];
  onChange: Dispatch<SetStateAction<PendingPlayRoll[]>>;
  onJump: (roll: PendingPlayRoll, onResult: (focused: boolean) => void) => void;
}) {
  const [scan, setScan] = useState<{ stage: Stage; roomId: string; wrapBattleId?: string; candidates: Candidate[] }>();
  const [selection, setSelection] = useState('');
  const [target, setTarget] = useState('');
  const [feedback, setFeedback] = useState('');
  const candidates = scan?.stage === stage && scan.roomId === roomId && scan.wrapBattleId === wrapBattleId ? scan.candidates : [];
  const hasRoll = (candidate: Candidate, entries: PendingPlayRoll[]) => entries.some((roll) => roll.roomId === roomId
    && roll.stage === stage && roll.field === candidate.field && roll.wrapBattleId === candidate.wrapBattleId);
  const available = candidates.filter((candidate) => !hasRoll(candidate, rolls));
  const selected = available.find(({ field }) => field === selection);

  useEffect(() => {
    if (!open) return;
    const section = document.getElementById(`play-stage-${stage}`);
    if (!section) return;
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScan({ stage, roomId, wrapBattleId, candidates: visiblePendingRolls(section, wrapBattleId) }));
    };
    const observer = new MutationObserver(refresh);
    observer.observe(section, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['open', 'hidden', 'disabled', 'data-play-roll-pending', 'data-play-roll-field', 'data-play-roll-label', 'data-play-roll-die'] });
    refresh();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [stage, open, roomId, wrapBattleId]);

  return (
    <>
      {open && (
        <section className="play-pending-rolls play-pending-body" aria-label="보류한 굴림 목록">
          <form className="play-pending-form" onSubmit={(event) => {
            event.preventDefault();
            if (!roomId || !selected) return;
            const item: PendingPlayRoll = { ...selected, id: crypto.randomUUID(), roomId, place: place.trim().slice(0, 160) || '이번 장소',
              stage, target: target.trim() };
            onChange((previous) => hasRoll(selected, previous) ? previous : [...previous, item]);
            setSelection('');
            setTarget('');
            setFeedback(`${selected.label}을 보류 목록에 넣었습니다.`);
          }}>
            <label className="field"><span>보류할 굴림</span>
              <select value={selected?.field ?? ''} onChange={(event) => setSelection(event.currentTarget.value)}>
                <option value="">현재 화면의 굴림 선택</option>
                {available.map(({ field, label, dice }) => <option key={field} value={field}>{[label, dice].filter(Boolean).join(' · ')}</option>)}
              </select>
            </label>
            <label className="field"><span>대상 메모 (선택)</span>
              <input value={target} maxLength={PLAY_PENDING_TARGET_LIMIT} onChange={(event) => setTarget(event.currentTarget.value)}
                placeholder="예 북쪽 문 · Necropede" />
            </label>
            <button className="btn ghost" type="submit" disabled={!roomId || !selected}>보류 표시</button>
          </form>
          {!available.length && <p className="play-explore-note">보류할 도구를 열면 여기서 굴림을 선택할 수 있습니다.</p>}
          {rolls.length > 0 && <ul className="play-pending-list">
            {rolls.map((roll) => (
              <li key={roll.id}>
                <div className="play-pending-entry">
                  <strong>{roll.label}{roll.dice && ` · ${roll.dice}`}</strong>
                  <span>{roll.place} · {STAGE_LABELS[roll.stage]}{roll.roomId !== roomId && ' · 이전 장소'}</span>
                  {roll.target && <span>{roll.target}</span>}
                </div>
                <div className="play-pending-buttons">
                  {roll.roomId === roomId && <button className="btn ghost" type="button" onClick={() => onJump(roll, (focused) => {
                    setFeedback(focused ? '' : `${roll.label} 입력칸이 현재 결과에 표시되지 않습니다.`);
                  })}>입력칸으로</button>}
                  <button className="btn ghost" type="button" aria-label={`${roll.label} 보류 해제`} onClick={() => {
                    onChange((previous) => previous.filter(({ id }) => id !== roll.id));
                    setFeedback(`${roll.label} 보류를 해제했습니다.`);
                  }}>보류 해제</button>
                </div>
              </li>
            ))}
          </ul>}
          {feedback && <p className="play-explore-note" role="status">{feedback}</p>}
        </section>
      )}
    </>
  );
}
