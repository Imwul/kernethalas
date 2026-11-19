import { useEffect, useMemo } from 'react';
import { creatureDefenses } from '../../content/creature-defenses';
import type { CreatureRecord } from '../../content/entries/creatures';
import { masteryCatalog } from '../../content/entries/masteries';
import { calculateCreatureAdaptation, readCreatureLevel } from '../../lib/creature-adaptation';
import { calculateDirectDamage, ignoresArmor, listedDamageReactions, type DamageReactions } from '../../lib/damage';
import { resolveAttack, type CheckResult, type RollResult } from '../../lib/dice';
import { encounterInteger } from '../../lib/encounter-start';
import { abilityRoll, describeMasteryAbility, readMasteryInteger, type MasteryAbility } from '../../lib/mastery-play';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { gearCount, type PaperChange } from '../../lib/play-inventory';
import { DamageTypeGuide } from '../DamageTypeGuide';
import { PhysicalDiceRoll } from '../PhysicalDiceRoll';
import { PhysicalSkillRoll, skillCheckSucceeded } from '../PhysicalSkillRoll';
import { XRef } from '../bits';
import '../../styles/play-mastery.css';

type SheetEffect = Omit<PaperChange, 'id'>;
export type MasteryTarget = { id: string; label: string; creature?: CreatureRecord };
type Hit = { applies: boolean; text: string; critical?: boolean };
type TargetDraft = {
  attack?: CheckResult;
  defense?: CheckResult;
  roll?: RollResult;
  armor?: string;
  reduction?: string;
  modifier?: string;
  reactions?: Partial<DamageReactions>;
  confirmed?: boolean;
};
type CastDraft = {
  level: string;
  targets: string[] | null;
  manual: string;
  spent: string;
  aether: string;
  blocked: boolean;
  resuming: boolean;
  rolls: Record<string, TargetDraft>;
};
type CastRecord = { ability: string; summary: string; changes: SheetEffect[]; affected: string[]; sustained: boolean };

const EMPTY_CAST: CastDraft = { level: '', targets: null, manual: '', spent: '', aether: '', blocked: false, resuming: false, rolls: {} };
const NO_TARGETS: MasteryTarget[] = [];
const REACTION_LABELS = { vulnerable: '취약', resistant: '저항', immune: '면역', restored: '회복' } as const;
const ACTIVE_PAPER_PASSIVES: Record<string, string> = {
  Absolution: 'Health +2 · Sanity +2',
  'Astral Projection': '앞쪽 방을 최대 5개 생성하고 파악',
};

function targetReactions(target: MasteryTarget, ability: MasteryAbility, effect: NonNullable<MasteryAbility['roll']>, draft: TargetDraft) {
  return effect.type ? {
    ...listedDamageReactions(effect.type, ability.magical, target.creature ? creatureDefenses(target.creature) : undefined),
    ...draft.reactions,
  } : undefined;
}

function targetGate(ability: MasteryAbility, target: MasteryTarget, draft: TargetDraft): Hit | null {
  if (ability.exception === 'overseer' && target.creature?.group === 'overseer') return { applies: false, text: 'Overseer에게 무효' };
  if (ability.exception === 'necrotic' && target.creature && creatureDefenses(target.creature).restored.includes('Necrotic')) {
    return { applies: false, text: 'Necrotic으로 회복하는 대상에게 무효' };
  }
  if (ability.check === 'defense') return draft.confirmed ? { applies: true, text: '' } : null;
  if (ability.check === 'attack') {
    if (!draft.attack || !draft.defense) return null;
    const result = resolveAttack(draft.attack, draft.defense);
    if (result.outcome === 'reroll') return null;
    if (result.outcome === 'both-failed') return { applies: false, text: '양쪽 실패 · 감소할 수 없는 피해 1' };
    if (result.outcome === 'defended') return { applies: false, text: `방어 성공${result.attackerFumble ? ' · 공격자 대실패' : ''}` };
    return { applies: true, text: result.outcome === 'critical-hit' ? 'Critical Strike' : '명중', critical: result.outcome === 'critical-hit' };
  }
  if (ability.check === 'unopposed') {
    if (!draft.attack) return null;
    return skillCheckSucceeded(draft.attack) ? { applies: true, text: '명중' } : { applies: false, text: '공격 실패' };
  }
  if (ability.check) {
    if (!draft.defense) return null;
    return skillCheckSucceeded(draft.defense)
      ? { applies: false, text: ability.resisted ? `저항 성공 · ${ability.resisted}` : '저항 성공 · 효과 방어' }
      : { applies: true, text: '저항 실패' };
  }
  return { applies: true, text: '' };
}

function targetEffect(ability: MasteryAbility, target: MasteryTarget, draft: TargetDraft, spent: number | null) {
  const hit = targetGate(ability, target, draft);
  if (!hit) return null;
  if (!hit.applies) return { text: hit.text, damage: 0, applies: !!ability.resisted && hit.text.includes(ability.resisted) };

  const effect = abilityRoll(ability, spent);
  const rollRequired = !!effect && (ability.name !== 'Reaper' || !!draft.confirmed);
  if (rollRequired && draft.roll?.expr !== effect.dice) return null;
  const amount = rollRequired ? draft.roll?.total : undefined;
  const conditionImmune = ability.condition && target.creature
    && creatureDefenses(target.creature).immuneConditions.includes(ability.condition);
  let annotation = conditionImmune ? `${ability.condition} 상태 면역`
    : ability.effect ?? ACTIVE_PAPER_PASSIVES[ability.name] ?? (!effect ? ability.text : '');
  let damage = 0;
  let rolled = '';
  if (amount !== undefined && effect) {
    if (effect.mode === 'damage' && effect.type) {
      const reactions = targetReactions(target, ability, effect, draft)!;
      const armor = ignoresArmor(effect.type) ? 0 : readMasteryInteger(draft.armor ?? '');
      const reduction = readMasteryInteger(draft.reduction || '0');
      const modifier = encounterInteger(draft.modifier || '0');
      if (armor === null || reduction === null || modifier === null) return null;
      const result = calculateDirectDamage({
        roll: amount, modifier, type: effect.type, critical: hit.critical ? 2 : 1, weak: false,
        armor, extraArmorIgnore: 0, reduction, reactions,
      });
      if (!Number.isSafeInteger(result.beforeArmor) || !Number.isSafeInteger(result.reacted)) return null;
      damage = result.restored ? 0 : result.amount;
      rolled = `${effect.type} ${result.restored ? '회복' : '피해'} ${result.amount}`;
      if (ability.id.startsWith('m-frostweaver:') && damage > 0) annotation = 'Freezing (Relentless Winter)';
    } else if (effect.mode === 'pool') {
      rolled = `피해 풀 ${effect.type} ${draft.roll!.dice.join(' / ')}`;
    } else if (effect.mode === 'recovery') rolled = `${effect.label} +${amount}`;
    else if (effect.mode === 'duration') rolled = `${amount}라운드 지속`;
    else rolled = `받는 피해 −${amount}`;
  }
  if (ability.special === 'shell' && spent !== null) rolled = `피해 ${Math.floor(spent / 2)} 흡수`;
  if (ability.special === 'cleanse' && spent !== null) rolled = `Sanity +${Math.floor(spent / 3)}`;
  if (ability.name === 'Drain Lifeforce' && damage > 0) rolled += ` · 내 Wounds +${damage}`;
  if (ability.name === "God's Will" && damage > 0) rolled += ` · 내 Sanity +${damage}`;
  return { text: [hit.text, rolled, annotation].filter(Boolean).join(' · '), damage, applies: !conditionImmune };
}

function spending(ability: MasteryAbility, spent: number | null, targets: number) {
  const aether = ability.special === 'shell' ? spent ?? 0 : ability.aether;
  const ritual = ability.special === 'torrent' ? 4 * Math.max(0, targets - 1)
    : ability.name === 'Sigil of Power' ? 5
      : ability.special === 'punishment' || ability.special === 'blessing' || ability.special === 'cleanse' ? spent ?? 0 : 0;
  const ritualItem = ability.special === 'torrent' ? 'Ritual Ingredient' : 'Ritual Component';
  const changes: SheetEffect[] = [
    ...(aether ? [{ text: `${ability.sustained ? '최대 Aether' : 'Aether'} −${aether}${ability.sustained ? ' (Sustained)' : ''}` }] : []),
    ...(ability.health ? [{ text: `Health −${ability.health}` }] : []),
    ...(ability.exhaustion ? [{ text: `Exhaustion +${ability.exhaustion}` }] : []),
    ...(ability.special === 'madness' && spent ? [{ text: `Sanity −${spent}` }] : []),
    ...(ritual ? [{ text: `${ritualItem} −${ritual} (${ability.name})`, gear: gearCount(ritualItem, -ritual) }] : []),
  ];
  return { aether, changes };
}

function useLimit(ability: MasteryAbility) {
  if (/전투당 1회|방당 1회/.test(ability.text)) return 'once';
  return /대상당 1회|상대당 1회|같은 상대에게 1회/.test(ability.text) ? 'target' : null;
}

function TargetControls({ ability, target, draft, level, spent, onChange }: {
  ability: MasteryAbility;
  target: MasteryTarget;
  draft: TargetDraft;
  level: number | null;
  spent: number | null;
  onChange: (change: Partial<TargetDraft>) => void;
}) {
  const outcome = targetGate(ability, target, draft);
  const effect = abilityRoll(ability, spent);
  const resolved = targetEffect(ability, target, draft, spent);
  const attackResult = draft.attack && draft.defense && ability.check === 'attack' ? resolveAttack(draft.attack, draft.defense) : null;
  const stats = target.creature ? calculateCreatureAdaptation(target.creature, level).stats : undefined;
  const defense = ability.check === 'attack' ? { stat: 'Combat Skill', value: stats?.combatSkill.value }
    : ability.check === 'magic' ? { stat: 'Magic Resistance', value: stats?.magicResistance.value }
      : ability.check === 'body' ? { stat: 'Body', value: target.creature?.body }
        : ability.check === 'mind' ? { stat: 'Mind', value: target.creature?.mind } : null;
  const initialSkill = defense?.value == null || (typeof defense.value === 'string' && !/^\d+$/.test(defense.value)) ? '' : String(defense.value);
  const exceptional = ability.exception && outcome?.text.includes('무효');
  const reactions = effect ? targetReactions(target, ability, effect, draft) : undefined;
  const reactionText = effect?.mode === 'damage' && reactions;

  return (
    <section className="mastery-target" aria-label={target.label || '나 또는 아군'}>
      {!!target.label && <h5>{target.label}</h5>}
      {!exceptional && <>
        {(ability.check === 'attack' || ability.check === 'unopposed') && <PhysicalSkillRoll
          label={ability.check === 'attack' ? 'PC 공격 판정' : '방어 불가 공격 판정'} skill={ability.weaponSkill}
          modifier={ability.modifier} slot="attack" context="attack" onResult={(attack) => onChange({ attack, roll: undefined, confirmed: false })}
          onClear={() => onChange({ attack: undefined, roll: undefined, confirmed: false })} />}
        {defense && <PhysicalSkillRoll label={ability.check === 'attack' ? '대상 방어 판정' : `대상 ${defense.stat} 판정`}
          skill={defense.stat} initialSkill={initialSkill} slot="defense" context="npc"
          onResult={(result) => onChange({ defense: result, roll: undefined, confirmed: false })}
          onClear={() => onChange({ defense: undefined, roll: undefined, confirmed: false })} />}
        {attackResult?.outcome === 'reroll' && <p className="mastery-note" role="status">{attackResult.reason}</p>}
        {ability.ifConfirmed && (ability.check === 'defense' || outcome?.applies) && <label className="mastery-tick">
          <input type="checkbox" checked={!!draft.confirmed} onChange={(event) => onChange({ confirmed: event.target.checked, roll: undefined })} />{ability.ifConfirmed}
        </label>}
        {effect && outcome?.applies && (ability.name !== 'Reaper' || draft.confirmed) && <>
          <PhysicalDiceRoll label={effect.label} dice={effect.dice} value={draft.roll} onValue={(roll) => onChange({ roll })}
            resultText={effect.mode === 'pool' ? ({ dice }) => `${effect.type} ${dice.join(' / ')} 중 필요한 눈을 선택` : undefined} />
          {reactionText && effect.type && <>
            <DamageTypeGuide type={effect.type} reactions={reactions}
              immuneConditions={target.creature ? creatureDefenses(target.creature).immuneConditions : undefined} />
            {!ignoresArmor(effect.type) && <label className="field mastery-number"><span>적용할 Armor</span>
              <input inputMode="numeric" value={draft.armor ?? ''} placeholder="방어구 없으면 0" onChange={(event) => onChange({ armor: event.target.value })}
                aria-invalid={!!draft.armor && readMasteryInteger(draft.armor) === null || undefined} />
            </label>}
            <details className="fold mastery-adjustments">
              <summary>추가 피해 보정</summary>
              <div className="mastery-form-fields">
                {Object.entries(REACTION_LABELS).map(([id, label]) => {
                  const key = id as keyof DamageReactions;
                  return <label className="mastery-tick" key={key}><input type="checkbox" checked={reactions?.[key] ?? false}
                    onChange={(event) => onChange({ reactions: { ...draft.reactions, [key]: event.target.checked } })} />{label}</label>;
                })}
                <label className="field"><span>추가 피해 보정</span><input value={draft.modifier ?? ''} placeholder="예 +2"
                  aria-invalid={!!draft.modifier && encounterInteger(draft.modifier) === null || undefined}
                  onChange={(event) => onChange({ modifier: event.target.value })} /></label>
                <label className="field"><span>추가 피해 감소</span><input inputMode="numeric" value={draft.reduction ?? ''} placeholder="0"
                  aria-invalid={!!draft.reduction && readMasteryInteger(draft.reduction) === null || undefined}
                  onChange={(event) => onChange({ reduction: event.target.value })} /></label>
              </div>
            </details>
          </>}
        </>}
      </>}
      {resolved && <p className="mastery-note mastery-target-result" role="status">{resolved.text}</p>}
    </section>
  );
}

function AbilityForm({ ability, targets, records, onRecord }: {
  ability: MasteryAbility;
  targets: MasteryTarget[];
  records: CastRecord[];
  onRecord: (record: CastRecord) => void;
}) {
  const [draft, setDraft] = usePlayDraftState('cast', EMPTY_CAST);
  const commit = usePlayRoll();
  const clear = useClearPlayDraftScope();
  const patch = (next: Partial<CastDraft>) => setDraft((previous) => ({ ...previous, ...next }));
  const level = readCreatureLevel(draft.level);
  const manualTargets = draft.manual.split('\n').map((name) => name.trim()).filter(Boolean);
  const usesTargets = ability.targets !== 'self';
  const single = ability.targets === 'one';
  const chooseAll = ability.targets === 'all';
  const limit = ability.targets === 'half-level' && level !== null ? Math.ceil(level / 2) : null;
  const allowedTargets = !usesTargets ? [{ id: 'self', label: '' }] : targets.length ? targets
    : manualTargets.map((label, index): MasteryTarget => ({ id: `manual-${index}-${label}`, label }));
  const chosen = !usesTargets || chooseAll ? allowedTargets
    : !targets.length ? single ? allowedTargets.slice(0, 1) : allowedTargets
      : draft.targets === null ? allowedTargets.slice(0, 1) : allowedTargets.filter(({ id }) => draft.targets?.includes(id));
  const variableCost = ability.special !== undefined && ability.special !== 'torrent';
  const minCost = ability.special === 'shell' ? 2 : ability.special === 'blessing' || ability.special === 'cleanse' ? 3 : 1;
  const maxCost = ability.special === 'madness' || ability.special === 'punishment' ? 100
    : ability.special === 'blessing' ? 302 : Number.MAX_SAFE_INTEGER;
  const spent = variableCost ? readMasteryInteger(draft.spent, minCost, maxCost) : null;
  const cost = spending(ability, spent, chosen.length);
  const available = draft.aether.trim() ? readMasteryInteger(draft.aether) : null;
  const invalidAether = !!draft.aether.trim() && (available === null || available < cost.aether);
  const validCount = !!chosen.length && (ability.targets !== 'half-level' || limit !== null && chosen.length <= limit);
  const prior = records.filter((record) => record.ability === ability.id);
  const usedTargets = new Set(prior.flatMap(({ affected }) => affected));
  const frequency = useLimit(ability);
  const usedOnce = frequency === 'once' && prior.length > 0 || frequency === 'target' && chosen.some(({ id }) => usedTargets.has(id));
  const stillSustained = ability.sustained && prior.at(-1)?.sustained === true;
  const restLimit = /휴식당 1회/.test(ability.text);
  const passive = ability.passive && !ACTIVE_PAPER_PASSIVES[ability.name];
  const complete = !passive && !draft.blocked && !invalidAether && (!variableCost || spent !== null) && validCount
    && !usedOnce && !stillSustained && (!restLimit || prior.length === 0 || draft.resuming);
  const results = complete ? chosen.map((target) => ({ ...target, result: targetEffect(ability, target, draft.rolls[target.id] ?? {}, spent) })) : [];
  const allResolved = !!results.length && results.every(({ result }) => result !== null);
  const detail = allResolved ? results.flatMap(({ label, result }) => result ? [`${label ? `${label} · ` : ''}${result.text}`] : []) : [];
  const healedSanity = ability.name === 'Soul Harvest' ? 2 * results.filter(({ result }) => (result?.damage ?? 0) > 0).length : 0;
  const changes = [...cost.changes, ...detail.map((text) => ({ text })),
    ...(allResolved && healedSanity > 0 ? [{ text: `내 Sanity +${healedSanity}` }] : [])];
  const reset = () => { clear('rolls'); setDraft((previous) => ({ ...EMPTY_CAST, level: previous.level, manual: previous.manual, targets: previous.targets })); };

  return (
    <div className="mastery-cast">
      <div className="mastery-rule">
        <strong lang="en">{ability.name}</strong>
        <span className="mastery-cost">{ability.use}</span>
        <span>{ability.text}</span>
        {ability.follow && <span className="mastery-note">{ability.follow}</span>}
        {ability.sustained && <span className="mastery-note">유지하는 동안 최대 Aether가 줄어듭니다. 전투 밖에서 해제할 수 있습니다.</span>}
      </div>
      {passive && <p className="mastery-note">배운 패시브 효과를 종이 시트에 반영합니다.</p>}
      {!passive && <>
        <div className="mastery-form-fields">
          {usesTargets && <label className="field"><span>PC 레벨{ability.targets === 'half-level' ? '' : ' (선택)'}</span>
            <input inputMode="numeric" value={draft.level} onChange={(event) => {
              clear('rolls');
              patch({ level: event.target.value, rolls: {} });
            }}
              placeholder="예 3" aria-invalid={!!draft.level && level === null || undefined} />
          </label>}
          {cost.aether > 0 && <label className="field"><span>현재 Aether (선택)</span>
            <input inputMode="numeric" value={draft.aether} onChange={(event) => patch({ aether: event.target.value })}
              placeholder={`비용 ${cost.aether}`} aria-invalid={invalidAether || undefined} />
          </label>}
          {variableCost && <label className="field"><span>{ability.special === 'shell' ? '사용할 Aether' : ability.special === 'madness' ? '사용할 Sanity' : '사용할 Ritual Component'}</span>
            <input inputMode="numeric" value={draft.spent} onChange={(event) => patch({ spent: event.target.value })}
              placeholder={`${minCost} 이상`} aria-invalid={!!draft.spent && spent === null || undefined} />
          </label>}
        </div>
        {invalidAether && <p className="field-err" role="alert">현재 Aether를 확인하세요. 비용 {cost.aether} 이상이 필요합니다.</p>}
        {variableCost && draft.spent && spent === null && <p className="field-err" role="alert">
          {maxCost < Number.MAX_SAFE_INTEGER ? `${minCost}–${maxCost} 사이를 입력하세요. 한 번에 주사위 100개까지 해결할 수 있습니다.` : `${minCost} 이상의 정수를 입력하세요.`}
        </p>}
        {usesTargets && (targets.length ? (
          single ? <label className="field mastery-number"><span>능력 대상</span>
            <select value={chosen[0]?.id ?? ''} onChange={(event) => patch({ targets: [event.target.value] })}>
              {!chosen.length && <option value="">선택</option>}
              {allowedTargets.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label> : <fieldset className="mastery-target-picks">
            <legend>{chooseAll ? '방 안의 모든 적' : '능력 대상'}</legend>
            {chooseAll ? <p className="mastery-note">{allowedTargets.map(({ label }) => label).join(' · ')}</p>
              : allowedTargets.map(({ id, label }) => <label className="mastery-tick" key={id}>
                <input type="checkbox" checked={chosen.some((target) => target.id === id)} onChange={(event) => patch({
                  targets: event.target.checked ? [...chosen.map((target) => target.id), id] : chosen.filter((target) => target.id !== id).map((target) => target.id),
                })} />{label}
              </label>)}
          </fieldset>
        ) : <label className="field"><span>{single ? '대상 이름' : '대상 이름 (한 줄에 하나씩)'}</span>
          {single ? <input value={draft.manual} onChange={(event) => patch({ manual: event.target.value })} />
            : <textarea value={draft.manual} rows={2} onChange={(event) => patch({ manual: event.target.value })} />}
        </label>)}
        {ability.targets === 'half-level' && <p className={level !== null && !validCount && chosen.length ? 'field-err' : 'mastery-note'} role="status">
          {limit === null ? 'PC 레벨을 입력하면 대상 수를 확인합니다.' : `레벨의 절반을 올려 최대 ${limit}체 · 선택 ${chosen.length}체`}
        </p>}
        <label className="mastery-tick"><input type="checkbox" checked={draft.blocked} onChange={(event) => patch({ blocked: event.target.checked })} />현재 Blinded 또는 Prone</label>
        {draft.blocked && <p className="mastery-note" role="status">이 상태에서는 Mastery 능력을 사용할 수 없습니다.</p>}
        {restLimit && prior.length > 0 && <label className="mastery-tick"><input type="checkbox" checked={draft.resuming} onChange={(event) => patch({ resuming: event.target.checked })} />지정된 휴식 후 사용 가능함을 시트에서 확인</label>}
        {usedOnce && <p className="mastery-note" role="status">이번 전투·장소 기록에 이 사용 제한이 적용됩니다.</p>}
        {stillSustained && <button type="button" className="btn ghost mastery-action" onClick={() => commit(() => {
          onRecord({ ability: ability.id, summary: `${ability.name} 해제 · 최대 Aether 제한 ${ability.aether} 해제`,
            changes: [{ text: `최대 Aether 제한 ${ability.aether} 해제 (${ability.name})` }], affected: [], sustained: false });
          reset();
        })}>전투 밖에서 유지 해제 기록</button>}
        {complete && <PlayDraftScope name="rolls">
          {chosen.map((target) => <PlayDraftScope name={target.id} key={target.id}>
            <TargetControls ability={ability} target={target} draft={draft.rolls[target.id] ?? {}} level={level} spent={spent}
              onChange={(change) => setDraft((previous) => ({ ...previous, rolls: { ...previous.rolls,
                [target.id]: { ...previous.rolls[target.id], ...change },
              } }))} />
          </PlayDraftScope>)}
        </PlayDraftScope>}
        {allResolved && <div className="mastery-result">
          <ul aria-label="시트에 옮길 능력 결과">{changes.map(({ text }, index) => <li key={index}>{text}</li>)}</ul>
          <button type="button" className="btn primary" onClick={() => commit(() => {
            onRecord({ ability: ability.id, summary: `${ability.name} · ${changes.map(({ text }) => text).join(' · ')}`, changes,
              affected: results.filter(({ result }) => result?.applies).map(({ id }) => id), sustained: ability.sustained });
            reset();
          })}>능력 사용 기록</button>
        </div>}
      </>}
      {ability.check === 'attack' && <div className="play-wrap-links"><XRef id="p-attack">공격과 명중 부위</XRef><XRef id="damage-pool">무기 피해 풀</XRef></div>}
    </div>
  );
}

export function PlayMastery({ targets = NO_TARGETS, onSheetChange, onJournalChange }: {
  targets?: MasteryTarget[];
  onSheetChange?: (items: PaperChange[]) => void;
  onJournalChange?: (line: string) => void;
}) {
  const [masteryId, setMasteryId] = usePlayDraftState('mastery', '');
  const [tier, setTier] = usePlayDraftState('tier', '');
  const [abilityId, setAbilityId] = usePlayDraftState('ability', '');
  const [records, setRecords] = usePlayDraftState<CastRecord[]>('mastery-records', []);
  const report = useMemo(() => ({
    journal: records.map(({ summary }) => summary).join(' / '),
    sheet: records.flatMap(({ changes }, index) => changes.map((change, part) => ({ id: `mastery-use-${index}-${part}`, ...change }))),
  }), [records]);
  useEffect(() => { onSheetChange?.(report.sheet); onJournalChange?.(report.journal); }, [report, onSheetChange, onJournalChange]);

  const mastery = masteryCatalog.find(({ id }) => id === masteryId);
  const visible = mastery?.abilities.filter((item) => item.tier <= Number(tier)) ?? [];
  const chosen = visible.find(({ id }) => id === abilityId);
  const ability = chosen && describeMasteryAbility(chosen);
  return (
    <section className="play-mastery-card" aria-label="PC Mastery 능력">
      <div className="mastery-form-fields">
        <label className="field"><span>종이 시트의 Mastery</span>
          <select value={masteryId} onChange={(event) => { setMasteryId(event.target.value); setTier(''); setAbilityId(''); }}>
            <option value="">선택</option>{masteryCatalog.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}
          </select>
        </label>
        {mastery && <label className="field"><span>배운 마지막 Tier</span>
          <select value={tier} onChange={(event) => { setTier(event.target.value); setAbilityId(''); }}>
            <option value="">선택</option>{mastery.abilities.map(({ tier: value, name }) => <option key={value} value={value}>Tier {value} · {name}</option>)}
          </select>
        </label>}
        {visible.length > 0 && <label className="field"><span>사용할 능력</span>
          <select value={abilityId} onChange={(event) => setAbilityId(event.target.value)}>
            <option value="">선택</option>{visible.map(({ id, name, use }) => <option key={id} value={id}>
              {name}{use === '패시브' && !ACTIVE_PAPER_PASSIVES[name] ? ' · 패시브' : ''}
            </option>)}
          </select>
        </label>}
      </div>
      {mastery && <details className="fold mastery-feature">
        <summary>Mastery 특성 · <span lang="en">{mastery.feature.name}</span></summary>
        <p className="mastery-note">{mastery.feature.text}</p>
      </details>}
      {ability && <PlayDraftScope name={ability.id}><AbilityForm key={ability.id} ability={ability} targets={targets} records={records}
        onRecord={(record) => setRecords((previous) => [...previous, record])} /></PlayDraftScope>}
      {records.length > 0 && <ul className="mastery-records" aria-label="이번 전투 능력 기록">
        {records.map(({ summary }, index) => <li key={index}>{summary}</li>)}
      </ul>}
      <div className="play-wrap-links"><XRef id="mastery-abilities">능력 사용 규칙</XRef>{mastery && <XRef id={mastery.id}>{mastery.name} 도감</XRef>}</div>
    </section>
  );
}
