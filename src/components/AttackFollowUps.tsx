import { createContext, useContext, type ReactNode } from 'react';
import { tableById } from '../content';
import {
  ATTACK_FOLLOW_UP_TABLES, attackFollowUpModifier, isAttackFollowUp,
  type AttackFollowUp, type AttackFollowUpKind, type AttackFollowUpStatus,
} from '../lib/attack-follow-ups';
import { usePlayDraft, usePlayDraftScope, usePlayRoll } from '../lib/play-draft';
import { playAction } from '../lib/play-roll-history';
import { XRef } from './bits';
import { JournalRoll } from './LootJournal';
import '../styles/attack-follow-ups.css';

type EffectRecord = AttackFollowUp & { slot: string };
type AttackFollowUpContext = {
  targetId: string;
  readOnly: boolean;
  effects: EffectRecord[];
  read: (exchangeId: string, kind: AttackFollowUpKind) => AttackFollowUp | undefined;
  record: (exchangeId: string, effect: AttackFollowUp) => void;
  settle: (effect: EffectRecord, status: AttackFollowUpStatus) => void;
};
const FollowUpContext = createContext<AttackFollowUpContext | null>(null);

export function AttackFollowUpProvider({ encounterId, targetId, readOnly = false, children }: {
  encounterId: string | null;
  targetId: string;
  readOnly?: boolean;
  children: ReactNode;
}) {
  const draft = usePlayDraft();
  const scope = usePlayDraftScope();
  if (!draft || !encounterId) return children;
  const prefix = `${scope}attack-effect:${encodeURIComponent(encounterId)}:`;
  const slots = Object.entries(draft.slots).filter(([slot]) => slot.startsWith(prefix));
  const effects = slots.flatMap(([slot, item]) => isAttackFollowUp(item) ? [{ ...item, slot }] : []);
  const key = (exchangeId: string, kind: AttackFollowUpKind) => `${prefix}${exchangeId}:${kind}`;
  return (
    <FollowUpContext.Provider value={{
      targetId, readOnly, effects,
      read(exchangeId, kind) {
        const item = draft.slots[key(exchangeId, kind)];
        return isAttackFollowUp(item) ? item : undefined;
      },
      record(exchangeId, effect) {
        if (readOnly) return;
        draft.write<AttackFollowUp | null>(draft.generation, key(exchangeId, effect.kind), (previous) => previous ?? effect, null);
      },
      settle({ slot }, status) {
        if (readOnly) return;
        draft.write<AttackFollowUp | null>(draft.generation, slot, (previous) => previous && !previous.status ? { ...previous, status } : previous, null);
      },
    }}>{children}</FollowUpContext.Provider>
  );
}

export function useAttackFollowUps() {
  return useContext(FollowUpContext);
}

const LABELS: Record<AttackFollowUpKind, string> = {
  'pc-defense': 'PC 방어 동작',
  'enemy-defense': '적 방어 동작',
  'pc-fumble': 'PC 공격자 펌블',
  'enemy-fumble': '적 공격자 펌블',
};

export function AttackFollowUpRoll({ kind, exchangeId, side, targetName }: {
  kind: AttackFollowUpKind;
  exchangeId: string;
  side: 'pc' | 'enemy';
  targetName: string;
}) {
  const ledger = useAttackFollowUps();
  if (!ledger) return null;
  const tableId = ATTACK_FOLLOW_UP_TABLES[kind];
  const record = ledger.read(exchangeId, kind);
  const row = record && tableById.get(tableId)?.rows.find(({ min }) => min === record.value);
  const label = LABELS[kind];
  return (
    <div className="attack-follow-up-roll">
      {record ? <fieldset className="loot-roll">
        <legend>{label} D10</legend>
        <div className="loot-roll-result" role="status"><span className="readout">{record.value}</span><span>{row?.ko}</span></div>
        {row?.next?.length ? <div className="checkcalc-follow-ups">{row.next.map(({ id }) => <XRef key={id} id={id} />)}</div> : null}
      </fieldset> : !ledger.readOnly && <JournalRoll tableId={tableId} label={label} value={null} once
        fieldKey={`attack-follow-up:${side}:${exchangeId}:${kind}`}
        onValue={(value) => ledger.record(exchangeId, { kind, value, targetId: ledger.targetId, targetName })} />}
      <XRef id={tableId}>전체 표 보기</XRef>
    </div>
  );
}

export type PendingAttackEffect = {
  effect: EffectRecord;
  side?: 'attacker' | 'defender';
  selected: boolean;
  blocked?: boolean;
};

export function AttackPendingEffects({ entries, onToggle }: {
  entries: PendingAttackEffect[];
  onToggle: (slot: string) => void;
}) {
  const ledger = useAttackFollowUps();
  const commit = usePlayRoll();
  if (!ledger || !entries.length) return null;
  return (
    <section className="attack-pending" aria-label="처리 대기 중인 전투 효과">
      <h4>아직 처리할 효과</h4>
      <ul>
        {entries.map(({ effect, side, selected, blocked }) => {
          const { kind, value, slot, targetName } = effect;
          const term = attackFollowUpModifier(effect);
          const row = tableById.get(ATTACK_FOLLOW_UP_TABLES[kind])?.rows.find(({ min }) => min === value);
          return <li key={slot}>
            <strong>{LABELS[kind]} {value} · {targetName}</strong>
            <p>{row?.ko}</p>
            {blocked && <p>유리와 불리가 함께 적용됩니다. 시트에서 확인 후 선택하세요.</p>}
            <div className="checkcalc-follow-ups">
              {side && term && <button className="btn ghost" type="button" aria-pressed={selected} disabled={blocked}
                onClick={() => onToggle(slot)}>{side === 'attacker' ? '공격' : '방어'}에 적용</button>}
              <button className="btn ghost" type="button"
                onClick={() => commit(() => ledger.settle(effect, 'noted'), playAction(`${LABELS[kind]} · 직접 처리`))}>직접 처리함</button>
              <button className="btn ghost" type="button"
                onClick={() => commit(() => ledger.settle(effect, 'skip'), playAction(`${LABELS[kind]} · 건너뛰기`))}>건너뛰기</button>
            </div>
          </li>;
        })}
      </ul>
    </section>
  );
}
