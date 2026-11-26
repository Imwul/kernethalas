import { useId, useState, type ReactNode } from 'react';
import type { ActionDamage } from '../content/creature-action-rules';
import type { RollResult } from '../lib/dice';
import { splitActionDamage } from '../lib/damage-pool';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraftState } from '../lib/play-draft';
import { usePlayCharacter } from '../lib/play-character';
import { PhysicalDiceRoll } from './PhysicalDiceRoll';

export type SharedActionDamage = Partial<Record<number, RollResult>>;
export const CREATURE_AREA_ROLES = ['pc', 'companion', 'minion'] as const;
export type CreatureAreaRole = typeof CREATURE_AREA_ROLES[number];
type RoleChoice = { role: CreatureAreaRole; revision: number };

function parseTargets(value: string) {
  const items = value.split('\n').map((name) => name.trim()).filter(Boolean);
  return items.length > 0 && items.length <= 12 && items.every((name) => name.length <= 48)
    && new Set(items).size === items.length ? items : null;
}

export function CreatureAreaTargets({ damage, renderTarget }: {
  damage: readonly ActionDamage[];
  renderTarget: (name?: string, shared?: SharedActionDamage, role?: CreatureAreaRole) => ReactNode;
}) {
  const panel = useId();
  const nameField = useId();
  const [open, setOpen] = usePlayDraftState('area-open', false);
  const [names, setNames] = usePlayDraftState<string[]>('area-targets', []);
  const [roles, setRoles] = usePlayDraftState<Record<number, RoleChoice>>('area-roles', {});
  const [revision, setRevision] = usePlayDraftState('area-target-revision', 0);
  const [mode, setMode] = usePlayDraftState<'individual' | 'shared'>('area-damage-mode', 'individual');
  const [shared, setShared] = usePlayDraftState<SharedActionDamage>('area-shared-damage', {});
  const [draft, setDraft] = useState<string | null>(null);
  const clear = useClearPlayDraftScope();
  const pcName = usePlayCharacter()?.character.name?.trim().toLowerCase();
  const areaScope = `area-targets-${revision}`;
  const value = draft ?? names.join('\n');
  const parsed = parseTargets(value);
  const altered = parsed && parsed.join('\n') !== names.join('\n');
  const { pool } = splitActionDamage(damage);
  const sharedMode = mode === 'shared' && !!pool;
  const pcAlias = names.findIndex((name) => name.toLowerCase() === 'pc');
  const defaultPc = pcAlias >= 0 ? pcAlias : names.findIndex((name) => name.toLowerCase() === pcName);
  const roleFor = (index: number): CreatureAreaRole => roles[index]?.role ?? (index === defaultPc ? 'pc' : 'companion');
  const activePc = names.findIndex((_, index) => roleFor(index) === 'pc');

  return (
    <>
      <button className="btn ghost creature-area-toggle" type="button" aria-expanded={open} aria-controls={panel}
        onClick={() => setOpen(!open)}>{open ? '한 대상 판정' : '여러 대상 판정'}</button>
      <div hidden={open}>{renderTarget()}</div>
      <div className="creature-area" id={panel} hidden={!open}>
        <form className="creature-area-form" onSubmit={(event) => {
          event.preventDefault();
          if (!parsed || !altered) return;
          clear(areaScope);
          setRevision((number) => number + 1);
          setNames(parsed);
          setRoles({});
          setDraft(null);
        }}>
          <label className="field" htmlFor={nameField}><span>대상 이름 (한 줄에 하나씩)</span>
            <textarea id={nameField} rows={3} value={value} placeholder={'PC\n동료'} maxLength={588}
              onChange={(event) => setDraft(event.target.value)} aria-invalid={value.trim() !== '' && !parsed || undefined}
              aria-describedby={`${nameField}-hint`} />
          </label>
          <div>
            <p className="damage-note" id={`${nameField}-hint`}>서로 다른 이름을 최대 12명까지 입력하세요. 역할을 바꾸면 해당 대상의 판정을 다시 시작합니다.</p>
            <button className="btn ghost" type="submit" disabled={!altered}>대상 목록 적용</button>
          </div>
        </form>
        {!!names.length && <>
          {pool && <label className="field creature-area-damage-mode"><span>피해 주사위</span>
            <select value={mode} onChange={(event) => setMode(event.target.value === 'shared' ? 'shared' : 'individual')}>
              <option value="individual">대상마다 굴림</option>
              <option value="shared">같은 굴림 결과 사용</option>
            </select>
          </label>}
          <div className="creature-area-targets">
            <PlayDraftScope name={areaScope}>
              {names.map((name, index) => {
                const role = roleFor(index);
                const target = renderTarget(name, sharedMode ? shared : undefined, role);
                return <PlayDraftScope name={String(index)} key={name}>
                  <section className="creature-area-target" aria-label={`${name} 판정과 효과`}>
                    <h4>{name}</h4>
                    <label className="field"><span>{name} 역할</span>
                      <select value={role} onChange={(event) => {
                        const next = event.target.value as CreatureAreaRole;
                        setRoles((previous) => ({ ...previous, [index]: { role: next, revision: (previous[index]?.revision ?? 0) + 1 } }));
                      }}>
                        <option value="pc" disabled={activePc >= 0 && activePc !== index}>내 PC</option>
                        <option value="companion">동료 · 직접 입력</option>
                        <option value="minion">소환수 · 직접 입력</option>
                      </select>
                    </label>
                    {roles[index]?.revision ? <PlayDraftScope name={`role-${roles[index].revision}`} key={roles[index].revision}>{target}</PlayDraftScope> : target}
                  </section>
                </PlayDraftScope>;
              })}
            </PlayDraftScope>
          </div>
          {sharedMode && <section className="creature-area-shared" aria-label="공유 피해 굴림">
            <h4>공유 피해 굴림</h4>
            {pool && <PhysicalDiceRoll label={`공유 ${[...new Set(pool.types)].join(' + ')} 피해`} dice={pool.dice} value={shared[0]}
              onValue={(roll) => setShared((old) => ({ ...old, 0: roll }))} pool={{ choose: pool.mixed, labels: pool.types }} />}
          </section>}
        </>}
      </div>
    </>
  );
}
