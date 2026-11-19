import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import {
  CARRY_TYPES, MAGIC_SALE, MERCHANT_STOCK, carryingSpace, magicPrices, merchantPrices, readEquipmentCount, tradeTotals,
  type CarryType, type TradeDirection, type TradeLine,
} from '../../lib/play-equipment';
import { usePlayDraftState } from '../../lib/play-draft';
import { XRef } from '../bits';
import '../../styles/play-equipment.css';

type SheetItem = { id: string; text: string };

interface EquipmentProps {
  onSheetChange?: (items: SheetItem[]) => void;
  onJournalChange?: (line: string) => void;
}

const displayNumber = new Intl.NumberFormat('ko-KR');
const money = (amount: number) => `${displayNumber.format(amount)}₵`;
const signed = (amount: number) => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${displayNumber.format(Math.abs(amount))}`;

type RawCounts = Record<CarryType, string>;
const EMPTY_COUNTS: RawCounts = { normal: '', heavy: '', light: '', coins: '', gems: '' };
const EMPTY_CARRY = { current: EMPTY_COUNTS, loot: EMPTY_COUNTS, backpack: false, pouches: 0 };

function readCounts(raw: RawCounts) {
  const counts = {} as Record<CarryType, number>;
  for (const { id } of CARRY_TYPES) {
    const count = readEquipmentCount(raw[id]);
    if (count === null) return null;
    counts[id] = count;
  }
  return counts;
}

function CarryingCalculator() {
  const heading = useId();
  const [draft, setDraft] = usePlayDraftState('carrying', EMPTY_CARRY);
  const { current, loot, backpack, pouches } = draft;
  const currentCounts = readCounts(current);
  const lootCounts = readCounts(loot);
  const space = currentCounts && lootCounts && carryingSpace(currentCounts, lootCounts, backpack, pouches);

  const countField = (key: 'current' | 'loot', type: CarryType, label: string) => (
    <input
      aria-label={label} type="text" inputMode="numeric" autoComplete="off" placeholder="0"
      value={draft[key][type]} aria-invalid={readEquipmentCount(draft[key][type]) === null || undefined}
      onChange={(event) => {
        const value = event.target.value;
        setDraft((previous) => ({ ...previous, [key]: { ...previous[key], [type]: value } }));
      }}
    />
  );

  return (
    <section className="play-equipment-panel" aria-labelledby={heading}>
      <h3 id={heading}>소지칸 검산</h3>
      <div className="play-carry-options">
        <label className="play-equipment-check">
          <input type="checkbox" checked={backpack} onChange={(event) => setDraft({ ...draft, backpack: event.target.checked })} />
          <span>Backpack</span>
        </label>
        <div className="field">
          <label htmlFor={`${heading}-pouches`}>Pouch 수</label>
          <select id={`${heading}-pouches`} value={pouches} onChange={(event) => setDraft({ ...draft, pouches: Number(event.target.value) })}>
            {[0, 1, 2, 3].map((count) => <option key={count} value={count}>{count}개</option>)}
          </select>
        </div>
      </div>
      <table className="play-carry-table" aria-label="보유품과 추가 전리품 수량">
        <thead><tr><th scope="col">종류</th><th scope="col">보유</th><th scope="col">추가</th></tr></thead>
        <tbody>
          {CARRY_TYPES.map(({ id, label }) => (
            <tr key={id}>
              <th scope="row">{label}</th>
              <td>{countField('current', id, `${label} 보유 수량`)}</td>
              <td>{countField('loot', id, `${label} 추가 수량`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {space ? (
        <dl className="play-equipment-totals" aria-label="소지칸 계산 결과">
          <div><dt>최대 소지</dt><dd>{space.capacity}칸</dd></div>
          <div><dt>획득 전</dt><dd>{slotDifference(space.capacity - space.before)}</dd></div>
          <div><dt>획득 후</dt><dd>{slotDifference(space.capacity - space.after)}</dd></div>
        </dl>
      ) : <p className="field-err" role="alert">수량을 계산할 수 있는 0 이상의 정수로 입력하세요.</p>}
      <div className="play-equipment-rule">
        <p>Light 10개당 1칸, 동전·보석은 합계 100개당 1칸입니다. 남는 묶음도 1칸을 차지합니다. 휴대품만 입력하세요.</p>
        <XRef id="encumbrance" />
      </div>
    </section>
  );
}

function slotDifference(slots: number) {
  return <span className={slots < 0 ? 'play-equipment-over' : undefined}>
    {slots < 0 ? '초과' : '여유'} {displayNumber.format(Math.abs(slots))}칸
  </span>;
}

interface TradeDraft {
  direction: TradeDirection;
  choice: string;
  quantity: string;
  name: string;
  manualPrice: string;
}

const EMPTY_TRADE: TradeDraft = { direction: 'buy', choice: '', quantity: '1', name: '', manualPrice: '' };

function tradeReport(lines: TradeLine[]) {
  const totals = tradeTotals(lines);
  const items: SheetItem[] = [];
  if (!totals || !lines.length) return { items, journal: '' };
  const names = new Map<string, number>();
  for (const { name, quantity, direction } of lines) {
    const change = direction === 'buy' ? quantity : -quantity;
    names.set(name, (names.get(name) ?? 0) + change);
  }
  if (totals.net) items.push({ id: 'equipment:coins', text: `동전 ${signed(totals.net)}₵ (거래)` });
  for (const [name, change] of names) {
    if (change) items.push({ id: `equipment:item:${name}`, text: `${name} ${signed(change)} (거래)` });
  }
  const cash = totals.net ? `동전 ${signed(totals.net)}₵` : '동전 변동 없음';
  return { items, journal: `${cash} · ${lines.map(({ direction, name, quantity }) =>
    `${direction === 'buy' ? '구매' : '판매'} ${name} ${displayNumber.format(quantity)}개`).join(' · ')}` };
}

function MerchantCalculator({ onSheetChange, onJournalChange }: EquipmentProps) {
  const heading = useId();
  const [draft, setDraft] = usePlayDraftState('trade', EMPTY_TRADE);
  const [lines, setLines] = usePlayDraftState<TradeLine[]>('trade-lines', []);
  const [confirmed, setConfirmed] = usePlayDraftState<TradeLine[]>('trade-confirmed', []);
  const [error, setError] = useState('');
  const { direction, choice, quantity, name, manualPrice } = draft;
  const isCustom = choice === 'custom';
  const ordinary = merchantPrices.get(choice);
  const magic = direction === 'sell' && choice.startsWith('magic:') ? magicPrices.get(choice.slice(6)) : undefined;
  const price = ordinary ? (direction === 'sell' ? Math.ceil(ordinary.price / 2) : ordinary.price) : magic?.price;
  const totals = tradeTotals(lines);
  const report = useMemo(() => tradeReport(confirmed), [confirmed]);
  const confirmedCurrent = confirmed.length > 0 && JSON.stringify(confirmed) === JSON.stringify(lines);
  useEffect(() => { onSheetChange?.(report.items); }, [onSheetChange, report.items]);
  useEffect(() => { onJournalChange?.(report.journal); }, [onJournalChange, report.journal]);

  const update = (changes: Partial<TradeDraft>) => {
    setDraft((previous) => ({ ...previous, ...changes }));
    setError('');
  };

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const count = readEquipmentCount(quantity);
    const lineName = isCustom ? name.trim() : ordinary?.name ?? magic?.name;
    const unitPrice = isCustom && manualPrice.trim() ? readEquipmentCount(manualPrice) : price;
    if (!lineName) return setError(isCustom ? '품목 이름을 입력하세요.' : '거래할 품목을 선택하세요.');
    if (!count) return setError('수량을 1 이상의 정수로 입력하세요.');
    if (unitPrice === undefined || unitPrice === null) return setError('단가를 0 이상의 정수로 입력하세요.');
    const next = [...lines, { direction, name: lineName, price: unitPrice, quantity: count }];
    if (!Number.isSafeInteger(next.reduce((sum, line) => sum + line.quantity, 0)) || !tradeTotals(next)) {
      return setError('거래 합계를 계산할 수 있도록 단가나 수량을 줄이세요.');
    }
    setLines(next);
    update({ choice: '', quantity: '1', name: '', manualPrice: '' });
  };

  return (
    <section className="play-equipment-panel" aria-labelledby={heading}>
      <h3 id={heading}>상인 거래</h3>
      <form className="play-trade-form" noValidate onSubmit={add}>
        <div className="play-trade-choices">
          <div className="field">
            <label htmlFor={`${heading}-direction`}>거래 방식</label>
            <select id={`${heading}-direction`} value={direction} onChange={(event) => {
              const next = event.target.value as TradeDirection;
              update({ direction: next, choice: next === 'buy' && choice.startsWith('magic:') ? '' : choice });
            }}>
              <option value="buy">구매</option><option value="sell">판매</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${heading}-item`}>거래할 품목</label>
            <select id={`${heading}-item`} value={choice} onChange={(event) => update({ choice: event.target.value })}>
              <option value="" disabled>품목 선택</option>
              <option value="custom">품목과 단가 직접 입력</option>
              {MERCHANT_STOCK.map(({ name: category, items }) => (
                <optgroup key={category} label={category}>
                  {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </optgroup>
              ))}
              {direction === 'sell' && (
                <optgroup label="희귀도별 마법 아이템 매입">
                  {MAGIC_SALE.map((item) => <option key={item.id} value={`magic:${item.id}`}>{item.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        </div>
        {isCustom && <label className="field">
          <span>품목 이름</span><input value={name} onChange={(event) => update({ name: event.target.value })} />
        </label>}
        <div className="play-trade-quote">
          <label className="field">
            <span>수량</span>
            <input type="text" inputMode="numeric" autoComplete="off" value={quantity}
              onChange={(event) => update({ quantity: event.target.value })} />
          </label>
          {isCustom ? (
            <label className="field">
              <span>합의 단가 (₵)</span>
              <input type="text" inputMode="numeric" autoComplete="off" value={manualPrice}
                onChange={(event) => update({ manualPrice: event.target.value })} />
            </label>
          ) : (
            <div className="field">
              <span>개당 가격</span>
              <p className="play-trade-unit" aria-live="polite">{price === undefined ? '—' : money(price)}</p>
            </div>
          )}
        </div>
        {error && <p className="field-err" role="alert">{error}</p>}
        <button type="submit" className="btn ghost">거래 목록에 추가</button>
      </form>
      {lines.length > 0 && totals && (
        <div className="play-trade-cart">
          <ul aria-label="거래 목록">
            {lines.map(({ direction: type, name: item, quantity: count, price: unit }, index) => (
              <li key={`${type}:${item}:${unit}:${index}`}>
                <span>{type === 'buy' ? '구매' : '판매'} · <b>{item}</b> {displayNumber.format(count)}개</span>
                <strong>{money(count * unit)}</strong>
                <button type="button" className="btn ghost" aria-label={`${item} ${index + 1}번 거래 줄 삭제`}
                  onClick={() => setLines((previous) => previous.filter((_, row) => row !== index))}>삭제</button>
              </li>
            ))}
          </ul>
          <dl className="play-equipment-totals" aria-label="거래 합계">
            <div><dt>구매 합계</dt><dd>{money(totals.buy)}</dd></div>
            <div><dt>판매 합계</dt><dd>{money(totals.sell)}</dd></div>
            <div><dt>동전 증감</dt><dd>{signed(totals.net)}₵</dd></div>
          </dl>
        </div>
      )}
      {onSheetChange || onJournalChange ? (
        <div className="play-trade-actions">
          {lines.length > 0 && <button type="button" className="btn primary" onClick={() => setConfirmed(lines)} disabled={confirmedCurrent}>
            {confirmedCurrent ? '거래 기록에 반영됨' : '거래 기록에 반영'}
          </button>}
          {confirmed.length > 0 && <button type="button" className="btn ghost" onClick={() => setConfirmed([])}>반영한 거래 지우기</button>}
        </div>
      ) : null}
      <div className="play-equipment-rule">
        <p>일반 물품은 정가의 절반(개당 올림)에 매입합니다. 마법 아이템은 희귀도별 금액을 쓰며 아뮬렛은 매입 대상에서 제외됩니다.</p>
        <XRef id="traders">상인 거래 규칙</XRef>
      </div>
    </section>
  );
}

export function PlayEquipment(props: EquipmentProps) {
  return (
    <div className="play-equipment">
      <CarryingCalculator />
      <MerchantCalculator {...props} />
    </div>
  );
}
