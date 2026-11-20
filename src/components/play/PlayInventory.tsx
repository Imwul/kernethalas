import { useEffect, useRef, useState, type FormEvent } from 'react';
import { readEquipmentCount } from '../../lib/play-equipment';
import { campaignStorageKey, usePlayCampaignId } from '../../lib/play-campaigns';
import {
  ARMOR_DICE, GEAR_LOCATIONS, GEAR_WEIGHTS, applyGearEffect, availableQuickUses, gearKey, gearWeight, isGearStorageEvent, isQuickGear, matchingGear,
  readGearLedger, sameGearItem, saveGearItem, showIntegrity, storeGearLedger, undoGearEntry,
  type GearItem, type GearLedger, type PaperChange,
} from '../../lib/play-inventory';
import { PlayQuickGear } from './PlayQuickGear';
import '../../styles/play-inventory.css';

type LedgerOperation = (ledger: GearLedger) => ReturnType<typeof saveGearItem>;

export function useGearLedger() {
  const campaignId = usePlayCampaignId();
  const [ledger, setLedger] = useState<GearLedger>(() => readGearLedger(campaignId) ?? { items: [], entries: [] });
  const current = useRef(ledger);
  const [error, setError] = useState('');
  const [temporary, setTemporary] = useState(false);
  const storageUnavailable = useRef(false);
  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (!isGearStorageEvent(event, campaignId) || storageUnavailable.current) return;
      const stored = readGearLedger(campaignId);
      if (stored) {
        current.current = stored;
        setLedger(stored);
      }
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, [campaignId]);
  const change = async (operation: LedgerOperation) => {
    const commit = () => {
      const latest = storageUnavailable.current ? current.current : readGearLedger(campaignId) ?? current.current;
      const result = operation(latest);
      if ('error' in result) {
        current.current = latest;
        setLedger(latest);
        setError(result.error);
        return false;
      }
      storageUnavailable.current = !storeGearLedger(result.ledger, campaignId);
      current.current = result.ledger;
      setLedger(result.ledger);
      setTemporary(storageUnavailable.current);
      setError('');
      return true;
    };
    if (navigator.locks) {
      try { return await navigator.locks.request(campaignStorageKey('kn-play-gear', campaignId), commit); }
      catch { setError('장부에 변경을 저장할 수 없습니다. 다시 시도하세요.'); return false; }
    }
    return commit();
  };
  return { ledger, change, error, temporary };
}

function GearEditor({ item, onSave, onCancel }: {
  item: GearItem | null;
  onSave: (item: GearItem, reason: string, original: GearItem | null) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [original] = useState(item);
  const [name, setName] = useState(item?.name ?? '');
  const [count, setCount] = useState(item ? String(item.count) : '1');
  const [location, setLocation] = useState<GearItem['location']>(item?.location ?? 'pack');
  const [weight, setWeight] = useState<GearItem['weight'] | ''>(item?.weight ?? '');
  const [integrity, setIntegrity] = useState<GearItem['integrity']>(item?.integrity);
  const [quickUse, setQuickUse] = useState(item?.quickUse);
  const [reason, setReason] = useState(item ? '' : '처음 등록');
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const details = { name: name.trim(), location, weight: weight || gearWeight(name), integrity, quickUse };
  const quickSample = { id: '', count: 0, ...details };
  const canUseQuickly = isQuickGear({ ...quickSample, quickUse: true });
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = count.trim() ? readEquipmentCount(count) : null;
    if (!name.trim() || !reason.trim() || amount === null || (integrity && integrity !== 'broken' && amount !== 1)) {
      setInvalid(true);
      return;
    }
    setPending(true);
    await onSave({ ...details, id: original?.id ?? crypto.randomUUID(), count: integrity === 'broken' ? 0 : amount }, reason.trim(), original);
    setPending(false);
  };
  return (
    <form className="play-gear-editor" noValidate onSubmit={submit} aria-label={item ? '장부 항목 변경' : '장비 등록'}>
      <div className="play-gear-fields">
        <label className="field"><span>품목 이름</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field"><span>현재 수량</span><input inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} /></label>
        <label className="field"><span>보관 위치</span><select value={location} onChange={(event) => setLocation(event.target.value as GearItem['location'])}>
          {Object.entries(GEAR_LOCATIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label className="field"><span>소지칸 분류</span><select value={weight} onChange={(event) => setWeight(event.target.value as GearItem['weight'] | '')}>
          <option value="">{GEAR_WEIGHTS[gearWeight(name)]} 기본값</option>
          {Object.entries(GEAR_WEIGHTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label className="field"><span>방어구 내구도</span><select value={integrity ?? ''} onChange={(event) => {
          setIntegrity(event.target.value ? event.target.value as GearItem['integrity'] : undefined);
        }}>
          <option value="">해당 없음</option>
          {ARMOR_DICE.map((die) => <option key={die}>{die}</option>)}
          {item?.integrity === 'broken' && <option value="broken">파괴</option>}
        </select></label>
        <label className="field"><span>변경 이유</span><input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      </div>
      {canUseQuickly && <label className="play-gear-quick-option">
        <input type="checkbox" checked={isQuickGear(quickSample)} onChange={(event) => setQuickUse(event.target.checked)} />
        <span>빠른 사용에 표시</span>
      </label>}
      {invalid && <p className="field-err" role="alert">품목 이름, 0 이상의 수량과 변경 이유를 입력하세요. 내구도를 기록하는 방어구는 한 개씩 등록합니다.</p>}
      <div className="play-header-actions">
        <button type="submit" className="btn primary" disabled={pending}>장부에 저장</button>
        <button type="button" className="btn ghost" onClick={onCancel}>취소</button>
      </div>
    </form>
  );
}

function entryText(old: GearItem | null, next: GearItem) {
  if (!old) return `${next.count}개 등록`;
  const details = [];
  if (old.count !== next.count) details.push(`${old.count} → ${next.count}`);
  if (old.integrity !== next.integrity) details.push(`내구도 ${old.integrity ? showIntegrity(old.integrity) : '—'} → ${next.integrity ? showIntegrity(next.integrity) : '—'}`);
  if (old.location !== next.location) details.push(`${GEAR_LOCATIONS[old.location]} → ${GEAR_LOCATIONS[next.location]}`);
  if (old.name !== next.name) details.push(`이름 ${old.name} → ${next.name}`);
  if (old.weight !== next.weight) details.push(`${GEAR_WEIGHTS[old.weight]} → ${GEAR_WEIGHTS[next.weight]}`);
  if (isQuickGear(old) !== isQuickGear(next)) details.push(isQuickGear(next) ? '빠른 사용에 표시' : '빠른 사용에서 숨김');
  return details.join(' · ');
}

export function PlayInventory({ state, changes, roomId }: {
  state: ReturnType<typeof useGearLedger>;
  changes: PaperChange[];
  roomId: string;
}) {
  const { ledger, change, error, temporary } = state;
  const [editing, setEditing] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const pendingSection = useRef<HTMLElement>(null);
  const editingItem = ledger.items.find(({ id }) => id === editing) ?? null;
  const postedBySource = new Map(ledger.entries.map((entry) => [entry.source, entry]));
  const pendingNames = new Set(changes.flatMap(({ id, gear }) =>
    gear?.kind === 'count' && gear.amount < 0 && !postedBySource.has(`${roomId}/${id}`) ? [gearKey(gear.name)] : []));
  return (
    <section className="play-gear" aria-label="현재 장비와 소모 내역">
      <div className="play-gear-summary">
        <h2>현재 장비</h2>
        <button className="btn ghost" type="button" onClick={() => setEditing('new')}>장비 추가</button>
      </div>
      {temporary && <p className="play-empty" role="status">브라우저 저장 공간을 사용할 수 없어 현재 화면에 장부를 보관합니다.</p>}
      {error && <p className="field-err" role="alert">{error}</p>}
      <PlayQuickGear ledger={ledger} roomId={roomId} pendingNames={pendingNames} onChange={change} onShowPending={() => {
        pendingSection.current?.focus({ preventScroll: true });
        pendingSection.current?.scrollIntoView({ block: 'start' });
      }} />
      {editing && <GearEditor key={editing} item={editingItem} onSave={async (item, reason, original) => {
        const saved = await change((old) => {
          if (original && !sameGearItem(old.items.find(({ id }) => id === original.id), original)) {
            return { error: '편집하는 동안 이 품목이 바뀌었습니다. 수량을 다시 확인하세요.' };
          }
          return saveGearItem(old, item, reason);
        });
        if (saved) setEditing(null);
        return saved;
      }} onCancel={() => setEditing(null)} />}
      {ledger.items.length > 0 ? (
        <div className="play-gear-groups">
          {Object.entries(GEAR_LOCATIONS).map(([location, label]) => {
            const items = ledger.items.filter((item) => item.location === location);
            if (!items.length) return null;
            return <section key={location} aria-label={label}>
              <h3>{label}</h3>
              <ul className="play-gear-list">{items.map((item) => <li key={item.id}>
                <div><strong>{item.name}</strong>{item.integrity && <span className="play-gear-integrity">내구도 {showIntegrity(item.integrity)}</span>}</div>
                <span className="play-gear-amount">{item.count}</span>
                <button type="button" className="btn ghost" aria-label={`${item.name} 변경`} onClick={() => setEditing(item.id)}>변경</button>
              </li>)}</ul>
            </section>;
          })}
        </div>
      ) : <p className="play-empty">종이 시트에서 확인한 장비와 소모품을 등록하세요.</p>}
      {roomId && changes.length > 0 && <section className="play-gear-pending" aria-label="이번 장소의 장비 변경" ref={pendingSection} tabIndex={-1}>
        <h3>이번 장소의 장비 변경</h3>
        <ul className="play-gear-list">{changes.map(({ id, text, gear }) => {
          if (!gear) return null;
          const source = `${roomId}/${id}`;
          const posted = postedBySource.get(source);
          const changedAfterPosting = posted && posted.reason !== text;
          const matches = gear.kind === 'count' ? matchingGear(ledger, gear.name) : [];
          const chosen = matches.find(({ id: itemId }) => targets[id] === itemId);
          const countItem = chosen ?? (matches.length === 1 ? matches[0] : null);
          const accounted = !posted && countItem && gear.kind === 'count' && gear.amount < 0
            ? availableQuickUses(ledger, roomId, countItem.id, -gear.amount) : [];
          const extra = gear.kind === 'count' ? -gear.amount - accounted.length : 0;
          return <li key={id}>
            <div><strong>{text}</strong>{gear.kind === 'count' && countItem && !posted && !accounted.length && <span className="play-gear-integrity">
              {countItem.count} → {countItem.count + gear.amount}
            </span>}{changedAfterPosting && <span className="play-gear-integrity">장부에 반영한 값 · {posted.reason}</span>}
              {!!posted?.linkedQuickUses?.length && <span className="play-gear-integrity">기존 사용 {posted.linkedQuickUses.length}개 연결</span>}
            </div>
            {!posted && matches.length > 1 && <select aria-label={`${text}에 해당하는 품목`} value={chosen?.id ?? ''}
              onChange={(event) => setTargets((old) => ({ ...old, [id]: event.target.value }))}>
              <option value="">품목 선택</option>
              {matches.map((item) => <option value={item.id} key={item.id}>{item.name} · {GEAR_LOCATIONS[item.location]} · {item.count}</option>)}
            </select>}
            {accounted.length ? <div className="play-gear-accounted">
              <p className="play-gear-integrity">이 품목을 이번 장소에서 빠른 사용으로 {accounted.length}개 차감했습니다.</p>
              <button type="button" className="btn primary" onClick={() => void change((old) =>
                applyGearEffect(old, gear, text, source, countItem?.id, { roomId, ids: accounted }))}>
                {extra > 0 ? `기존 사용 연결하고 ${extra}개 추가 차감` : '기존 사용 연결'}
              </button>
              <button type="button" className="btn ghost" onClick={() => void change((old) =>
                applyGearEffect(old, gear, text, source, countItem?.id))}>별도 사용 {extra + accounted.length}개 차감</button>
            </div> : <button type="button" className="btn ghost" disabled={!!posted || matches.length > 1 && !chosen}
              aria-label={`장부에 반영 ${text}`} onClick={() => void change((old) => applyGearEffect(old, gear, text, source, chosen?.id))}>
              {changedAfterPosting ? '이전 값 반영됨' : posted ? '반영됨' : '반영'}
            </button>}
          </li>;
        })}</ul>
      </section>}
      {ledger.entries.length > 0 && <details className="fold play-gear-history">
        <summary>장비 변경 내역 · {ledger.entries.length}건</summary>
        <button type="button" className="btn ghost" onClick={() => void change(undoGearEntry)}>마지막 장부 변경 되돌리기</button>
        <ol>{ledger.entries.slice().reverse().map(({ id, old, next, reason, linkedQuickUses }) => <li key={id}>
          <strong>{[next.name, entryText(old, next)].filter(Boolean).join(' · ')}</strong><span>{reason}</span>
          {!!linkedQuickUses?.length && <span>기존 사용 {linkedQuickUses.length}개 연결</span>}
        </li>)}</ol>
      </details>}
    </section>
  );
}
