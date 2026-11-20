import { useId } from 'react';
import type { PaperChange } from '../../lib/play-inventory';

export type PaperReceipt = string | Pick<PaperChange, 'id' | 'text'>;

export function paperReceiptKey(receipt: PaperReceipt) {
  return typeof receipt === 'string' ? receipt : `${receipt.id}:${receipt.text}`;
}

export function findPaperCorrections(items: PaperChange[], receipts: PaperReceipt[]) {
  const currentKeys = new Set(items.map(paperReceiptKey));
  return receipts.flatMap((receipt) => {
    if (typeof receipt === 'string' || currentKeys.has(paperReceiptKey(receipt))) return [];
    return [{ receipt, current: items.find((item) => item.id === receipt.id) }];
  });
}

type Props = {
  items: PaperChange[];
  receipts: PaperReceipt[];
} & ({ onConfirm: (previous: PaperReceipt, current: PaperChange | undefined) => void } | { onOpenGear: () => void });

export function PlayPaperCorrections(props: Props) {
  const heading = useId();
  const corrections = findPaperCorrections(props.items, props.receipts);
  const ledger = 'onOpenGear' in props;

  if (!corrections.length) return null;
  return (
    <section className="play-paper-corrections" aria-labelledby={heading}>
      <h3 id={heading}>{ledger ? '장부 정정 필요' : '종이 시트 정정표'}</h3>
      <ul>
        {corrections.map(({ receipt, current }) => (
          <li key={paperReceiptKey(receipt)}>
            <dl><div><dt>옮긴 내용</dt><dd>{receipt.text}</dd></div>
              <div><dt>현재 결과</dt><dd>{current?.text ?? '취소'}</dd></div></dl>
            {!ledger && <button className="btn ghost" type="button" aria-label={`${receipt.text} 정정 반영`}
              onClick={() => props.onConfirm(receipt, current)}>정정 반영</button>}
          </li>
        ))}
      </ul>
      {ledger && <button className="btn ghost" type="button" onClick={props.onOpenGear}>장부 정정 확인</button>}
    </section>
  );
}
