import { useEffect, useId, useState } from 'react';
import { tableById } from '../content';
import { rollDie, tableSides } from '../lib/dice';
import { journalPropertyText, journalRarity, journalRow, journalRowName, potionJournalLine, propertyCount } from '../lib/loot-journal';
import { automaticRollSides, readOracleValue, rollTable } from '../lib/oracle';
import { usePlayDraftState, usePlayRoll } from '../lib/play-draft';
import { CopyButton, XRef } from './bits';
import '../styles/loot-journal.css';

type JournalRollProps = {
  value: number | null;
  onValue: (value: number) => void;
  resultText?: string;
} & ({ tableId: string; label?: string } | { die: 'D4' | 'D6' | 'D10' | 'D20' | 'D100'; label: string });

export function JournalRoll({ label, value, onValue, resultText, ...source }: JournalRollProps) {
  const id = useId();
  const [typed, setTyped] = useState('');
  const [invalid, setInvalid] = useState(false);
  const commitRoll = usePlayRoll();
  const table = 'tableId' in source ? tableById.get(source.tableId) : undefined;
  const dice = table?.dice ?? ('die' in source ? source.die : '');
  const sides = tableSides(dice);
  if (sides === null) return null;
  const row = table && journalRow(table.id, value);
  const canRoll = !table || automaticRollSides(table) !== null;
  const commit = (roll: number) => {
    commitRoll(() => onValue(roll));
    setTyped('');
    setInvalid(false);
  };
  return (
    <fieldset className="loot-roll">
      <legend>{label ?? table?.ko} {dice}</legend>
      <form className="loot-roll-form" data-play-roll noValidate onSubmit={(event) => {
        event.preventDefault();
        const roll = readOracleValue(typed.trim(), sides);
        if (roll === null) setInvalid(true);
        else commit(roll);
      }}>
        <div className="field">
          <label htmlFor={id}>직접 굴린 값</label>
          <input id={id} inputMode="numeric" data-play-dice autoComplete="off" value={typed} placeholder={sides === 100 ? '1–100 / 00' : `1–${sides}`}
            aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined} onChange={(event) => {
              setTyped(event.target.value);
              setInvalid(false);
            }} />
        </div>
        <button type="submit" className="btn ghost">확인</button>
        {canRoll && (
          <button type="button" className="btn ghost" onClick={() => {
            const roll = table ? rollTable(table) : rollDie(sides);
            if (roll !== null) commit(roll);
          }}>{dice} 굴리기</button>
        )}
        {invalid && <p id={`${id}-error`} className="field-err" role="alert">1–{sides}{sides === 100 && ' 또는 00'}을 입력하세요.</p>}
      </form>
      {value !== null && (
        <div className="loot-roll-result" role="status">
          <span className="readout">{value}</span>
          <span>{resultText ?? row?.ko}</span>
        </div>
      )}
    </fieldset>
  );
}

function JournalLine({ text }: { text: string }) {
  return (
    <section className="loot-journal-line" aria-label="저널용 한 줄">
      <h3>저널용 한 줄</h3>
      <p>{text}</p>
      <CopyButton text={text} label="저널 문장 복사" />
    </section>
  );
}

type PotionMethod = '' | 'medicine' | 'failed' | 'drank' | 'stone';

function PotionJournal({ onJournalChange }: { onJournalChange?: (text: string) => void }) {
  const [method, setMethod] = usePlayDraftState<PotionMethod>('potion-method', '');
  const [kindRoll, setKindRoll] = usePlayDraftState<number | null>('potion-kind', null);
  const [ageRoll, setAgeRoll] = usePlayDraftState<number | null>('potion-age', null);
  const potion = journalRow('t-potions', kindRoll);
  const aging = journalRow('t-potion-aging', ageRoll);
  const identified = method !== '' && method !== 'failed';
  const text = potion && aging ? potionJournalLine(potion, aging, method === 'drank') : '';
  useEffect(() => { onJournalChange?.(text); }, [onJournalChange, text]);

  const chooseMethod = (next: PotionMethod) => {
    setMethod(next);
    if (next === '' || next === 'failed') {
      setKindRoll(null);
      setAgeRoll(null);
    }
  };

  return (
    <section className="loot-journal" aria-label="물약 기록">
      <div className="loot-journal-head">
        <h2>물약 기록</h2>
        {method !== '' && <button type="button" className="btn ghost" onClick={() => chooseMethod('')}>새 물약</button>}
      </div>
      <label className="field loot-select">
        <span>물약 감정</span>
        <select value={method} onChange={(event) => chooseMethod(event.target.value as PotionMethod)}>
          <option value="">감정 방법 또는 판정 결과 선택</option>
          <option value="medicine">Medicine 성공</option>
          <option value="failed">Medicine 실패</option>
          <option value="drank">마셔 봄</option>
          <option value="stone">Borestian Stone</option>
        </select>
      </label>
      {method === 'failed' && <p className="loot-help">마셔 본 뒤 물약 종류를 정할 수 있습니다.</p>}
      {identified && (
        <JournalRoll tableId="t-potions" value={kindRoll} onValue={(roll) => {
          setKindRoll(roll);
          setAgeRoll(null);
        }} resultText={potion && journalRowName(potion)} />
      )}
      {potion && <JournalRoll key={kindRoll} tableId="t-potion-aging" value={ageRoll} onValue={setAgeRoll} />}
      {aging?.next && <div className="loot-refs">{aging.next.map(({ id }) => <XRef key={id} id={id} />)}</div>}
      {text && <JournalLine text={text} />}
    </section>
  );
}

type Attunement = '' | 'camp' | 'reason';

interface PropertyRoll {
  value: number;
  detail: number | null;
}

interface MagicDraft {
  item: number | null;
  base: number | null;
  detail: number | null;
  mastery: number | null;
  attuned: Attunement;
  rarity: number | null;
  properties: (PropertyRoll | undefined)[];
  peculiarity: string;
}

const EMPTY_MAGIC_DRAFT: MagicDraft = {
  item: null, base: null, detail: null, mastery: null, attuned: '', rarity: null, properties: [], peculiarity: '',
};

function MagicItemJournal({ onJournalChange }: { onJournalChange?: (text: string) => void }) {
  const [draft, setDraft] = usePlayDraftState<MagicDraft>('magic-item', EMPTY_MAGIC_DRAFT);
  const item = journalRow('t-item', draft.item);
  const baseId = item?.next?.find(({ id }) => id === 't-random-weapon' || id === 't-random-armor')?.id;
  const base = baseId ? journalRow(baseId, draft.base) : undefined;
  const detailId = baseId === 't-random-armor' ? base?.next?.[0]?.id : undefined;
  const detail = detailId ? journalRow(detailId, draft.detail) : undefined;
  const mastery = item?.label === 'Amulet' ? journalRow('t-random-mastery', draft.mastery) : undefined;
  const baseReady = !!item && (!baseId || (!!base && (!detailId || !!detail)));
  const amulet = item?.label === 'Amulet';
  const propertiesId = item?.next?.find(({ id }) => id.startsWith('t-props-'))?.id;
  const rarity = draft.attuned === '' ? undefined : journalRarity(journalRow('t-item-rarity', draft.rarity));
  const lookups = (detail ?? base)?.next?.filter(({ id }) => tableById.get(id)?.dice === '—') ?? [];
  const propertySlots = Array.from({ length: rarity ? propertyCount(rarity) : 0 }, (_, index) => {
    const selected = draft.properties[index];
    const row = propertiesId ? journalRow(propertiesId, selected?.value ?? null) : undefined;
    const followUpId = row?.next?.find(({ id }) => id === 't-damage-type' || id === 't-enemy-type')?.id;
    const followUp = followUpId ? journalRow(followUpId, selected?.detail ?? null) : undefined;
    // Core p.229. These maximum-stat bonuses use a D10 when the property is determined.
    const fixedD10 = propertiesId === 't-props-gloves' && (row?.min === 15 || row?.min === 20);
    const effect = row && rarity && journalPropertyText(row, rarity, {
      subject: followUp && journalRowName(followUp),
      fixedD10: fixedD10 ? selected?.detail ?? undefined : undefined,
    });
    const complete = !!row && (!followUpId || !!followUp) && (!fixedD10 || selected?.detail != null);
    return { selected, followUpId, fixedD10, effect, complete };
  });
  const changeProperty = (index: number, selected: PropertyRoll) => {
    setDraft((previous) => ({
      ...previous,
      properties: propertySlots.map((_, i) => i === index ? selected : previous.properties[i]),
    }));
  };
  const itemName = item && [journalRowName(item), base && journalRowName(base), detail && journalRowName(detail)].filter(Boolean).join(' ');
  const note = draft.peculiarity.trim();
  const text = itemName && baseReady && (amulet
    ? mastery && [`${itemName} · Mastery ${journalRowName(mastery)}`, note].filter(Boolean).join(' · ')
    : [itemName, rarity ?? (draft.attuned ? '감정함' : '미조율'),
      ...propertySlots.flatMap(({ effect, complete }) => effect && complete ? [effect] : []),
      rarity && propertySlots.some(({ complete }) => !complete) ? '속성 확인 중' : '',
      note,
    ].filter(Boolean).join(' · '));
  useEffect(() => { onJournalChange?.(text || ''); }, [onJournalChange, text]);

  return (
    <section className="loot-journal" aria-label="마법 아이템 기록">
      <div className="loot-journal-head">
        <h2>마법 아이템 기록</h2>
        {item && <button type="button" className="btn ghost" onClick={() => setDraft(EMPTY_MAGIC_DRAFT)}>새 아이템</button>}
      </div>
      <JournalRoll tableId="t-item" value={draft.item} onValue={(roll) => setDraft({ ...EMPTY_MAGIC_DRAFT, item: roll })} />
      {baseId && <JournalRoll key={`${draft.item}-base`} tableId={baseId} value={draft.base} onValue={(roll) => {
        setDraft({ ...EMPTY_MAGIC_DRAFT, item: draft.item, base: roll, peculiarity: draft.peculiarity });
      }} />}
      {detailId && <JournalRoll key={`${base?.min}-detail`} tableId={detailId} value={draft.detail} onValue={(roll) => {
        setDraft({ ...EMPTY_MAGIC_DRAFT, item: draft.item, base: draft.base, detail: roll, peculiarity: draft.peculiarity });
      }} />}
      {lookups.length > 0 && <div className="loot-refs">{lookups.map(({ id }) => <XRef key={id} id={id} />)}</div>}
      {amulet && <JournalRoll tableId="t-random-mastery" value={draft.mastery} onValue={(roll) => setDraft({ ...draft, mastery: roll })} />}
      {mastery?.next && <div className="loot-refs">{mastery.next.map(({ id }) => <XRef key={id} id={id} />)}</div>}
      {baseReady && propertiesId && (
        <>
          <label className="field loot-select">
            <span>아이템 조율</span>
            <select value={draft.attuned} onChange={(event) => {
              const attuned = event.target.value as Attunement;
              setDraft(attuned ? { ...draft, attuned } : { ...draft, attuned, rarity: null, properties: [] });
            }}>
              <option value="">미조율</option>
              <option value="camp">캠프에서 조율함</option>
              <option value="reason">Reason 대성공으로 감정함</option>
            </select>
          </label>
          {draft.attuned === '' && <p className="loot-help"><XRef id="attunement">조율</XRef>한 뒤 희귀도와 속성을 굴립니다.</p>}
          {draft.attuned !== '' && <JournalRoll tableId="t-item-rarity" value={draft.rarity} onValue={(roll) => {
            setDraft({ ...draft, rarity: roll, properties: [] });
          }} resultText={rarity && `${rarity} · 속성 ${propertyCount(rarity)}개`} />}
          {rarity && propertySlots.map(({ selected, followUpId, fixedD10, effect }, index) => (
            <div className="loot-property" key={`${rarity}-${index}`}>
              <JournalRoll tableId={propertiesId} label={`속성 ${index + 1}`} value={selected?.value ?? null}
                onValue={(value) => changeProperty(index, { value, detail: null })}
                resultText={effect} />
              {selected && followUpId && (
                <JournalRoll key={`${selected.value}-${followUpId}`} tableId={followUpId} value={selected.detail}
                  onValue={(detail) => changeProperty(index, { ...selected, detail })} />
              )}
              {selected && fixedD10 && (
                <JournalRoll key={selected.value} die="D10" label="속성 수치" value={selected.detail}
                  onValue={(detail) => changeProperty(index, { ...selected, detail })} />
              )}
            </div>
          ))}
          {propertySlots.length > 1 && <p className="loot-help">같은 속성이 나오면 중첩합니다.</p>}
        </>
      )}
      {baseReady && (
        <details className="loot-appearance">
          <summary>외형 메모 (선택)</summary>
          <XRef id="t-peculiarity">특이점 표 열기</XRef>
          <label className="field"><span>외형 한 줄</span>
            <input value={draft.peculiarity} onChange={(event) => setDraft({ ...draft, peculiarity: event.target.value })} />
          </label>
        </details>
      )}
      {text && <JournalLine text={text} />}
    </section>
  );
}

export function LootJournal({ kind, onJournalChange }: { kind: 'potion' | 'magic-item'; onJournalChange?: (text: string) => void }) {
  return kind === 'potion' ? <PotionJournal onJournalChange={onJournalChange} /> : <MagicItemJournal onJournalChange={onJournalChange} />;
}
