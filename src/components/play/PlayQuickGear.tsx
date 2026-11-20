import { useId, useRef, useState } from 'react';
import { GEAR_LOCATIONS, gearKey, isQuickGear, isQuickUseEntry, undoGearEntry, useOneGearItem,
  type GearItem, type GearLedger } from '../../lib/play-inventory';

interface Props {
  ledger: GearLedger;
  roomId: string;
  pendingNames: ReadonlySet<string>;
  onShowPending: () => void;
  onChange: (operation: (ledger: GearLedger) => ReturnType<typeof useOneGearItem>) => Promise<boolean>;
}

export function PlayQuickGear({ ledger, roomId, pendingNames, onShowPending, onChange }: Props) {
  const heading = useId();
  const [request, setRequest] = useState<{ roomId: string; operationId: string; item: GearItem } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ roomId: string; text: string } | null>(null);
  const committing = useRef(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const confirmation = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const items = ledger.items.filter((item) => item.count > 0 && isQuickGear(item));
  const active = request?.roomId === roomId ? request : null;
  const latest = ledger.entries.at(-1);
  const quickUndo = latest && isQuickUseEntry(latest, roomId) ? latest : null;
  const blocked = active && pendingNames.has(gearKey(active.item.name));
  const close = () => {
    setRequest(null);
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus();
      else title.current?.focus();
    });
  };
  const commit = async (operation: Parameters<Props['onChange']>[0], message: string) => {
    if (committing.current) return false;
    committing.current = true;
    setBusy(true);
    try {
      const saved = await onChange(operation);
      if (saved) setFeedback({ roomId, text: message });
      return saved;
    } finally {
      committing.current = false;
      setBusy(false);
    }
  };
  if (!roomId || (!items.length && !quickUndo && !active && feedback?.roomId !== roomId)) return null;

  return (
    <section className="play-quick-gear" aria-labelledby={heading}>
      <h3 id={heading} ref={title} tabIndex={-1}>소모품 빠른 사용</h3>
      {items.length > 0 && <ul className="play-quick-gear-items">
        {items.map((item) => {
          const pending = pendingNames.has(gearKey(item.name));
          const label = `${item.name} · ${GEAR_LOCATIONS[item.location]}`;
          return <li key={item.id}>
            <div><strong>{item.name}</strong><span>{GEAR_LOCATIONS[item.location]} · {item.count}개</span></div>
            <button type="button" className="btn ghost" disabled={busy} aria-label={`${label} ${pending ? '사용 기록 확인' : '1개 사용'}`}
              onClick={(event) => {
                if (pending) { onShowPending(); return; }
                opener.current = event.currentTarget;
                setFeedback(null);
                setRequest({ roomId, item, operationId: crypto.randomUUID() });
                requestAnimationFrame(() => confirmation.current?.focus());
              }}>{pending ? '기록 확인' : '1개 사용'}</button>
          </li>;
        })}
      </ul>}
      {active && <div className="play-quick-gear-confirm" role="group" aria-label="소모품 사용 확인">
        <p><strong>{active.item.name}</strong> · {GEAR_LOCATIONS[active.item.location]} · <b>{active.item.count} → {active.item.count - 1}개</b></p>
        {blocked && <p>이번 장소의 사용 기록에서 확인하세요.</p>}
        <div className="play-header-actions">
          <button type="button" className="btn primary" ref={confirmation} disabled={busy || !!blocked} onClick={async () => {
            if (await commit((old) => useOneGearItem(old, active.item, roomId, active.operationId), `${active.item.name} 1개를 사용했습니다.`)) close();
          }}>사용 확정</button>
          <button type="button" className="btn ghost" disabled={busy} onClick={close}>취소</button>
        </div>
      </div>}
      {feedback?.roomId === roomId && <p className="play-gear-integrity" role="status">{feedback.text}</p>}
      {quickUndo && <div>
        <button type="button" className="btn ghost" disabled={busy || !!active} onClick={() => {
          void commit((old) => undoGearEntry(old, quickUndo.id), `${quickUndo.next.name} 사용을 되돌렸습니다.`);
        }}>빠른 사용 되돌리기</button>
      </div>}
    </section>
  );
}
