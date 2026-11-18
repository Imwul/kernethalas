import type { OracleTable, TableRow } from '../content/schema';
import { oracleRowsAvailable } from '../lib/oracle';
import { tableRowSource } from '../lib/overlay';
import { XRef } from './bits';

export const rangeText = (r: TableRow, dice: string) =>
  dice === '—' ? r.label ?? String(r.min) : r.min === r.max ? pad(r.min, dice) : `${pad(r.min, dice)}–${pad(r.max, dice)}`;
const pad = (n: number, dice: string) => (dice === 'D100' ? String(n).padStart(2, '0') : String(n));

/** The English label adds nothing when the table is a plain gloss or the Korean already opens with it. */
export function showLabel(t: OracleTable, r: TableRow): boolean {
  if (!r.label || t.gloss || r.label === r.ko) return false;
  const k = r.ko.trim().toLowerCase();
  const l = r.label.trim().toLowerCase();
  return !(k === l || k.startsWith(l + '.') || k.startsWith(l + ' ') || k.startsWith(l + ':') || k.startsWith(l + ' —'));
}
/** One short title for a row: the dice readout and copy text use this. */
export const rowTitle = (t: OracleTable, r: TableRow) => (t.gloss ? r.ko : r.label ?? r.ko);

export function TableView({ t, hit }: { t: OracleTable; hit?: number | null }) {
  const lookup = t.dice === '—';
  const many = (t.columns?.length ?? 0) >= 2;
  const showResult = !lookup || t.rows.some((r) => r.ko !== r.label);
  if (!t.rows.length) return <p className="empty">수록된 결과가 없습니다. 출처에서 확인하세요.</p>;
  return (
    <table role="table" className={`ttable${many ? ' cols-many' : ''}${lookup ? ' lookup' : ''}`}>
      <caption>
        {t.en} — {t.dice === '—' ? '조회표' : t.dice}
        {t.mode === 'local-only' && !oracleRowsAvailable(t) && ' · 번호와 원본 쪽수'}
      </caption>
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col">{lookup ? '항목' : t.dice}</th>
          {showResult && <th scope="col">결과</th>}
          {t.columns?.map((c) => (
            <th key={c.key} scope="col">
              {c.ko}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {t.rows.map((r) => {
          const isHit = hit != null && hit >= r.min && hit <= r.max;
          const raw = tableRowSource(t.id, r.min);
          // original wording adds nothing when it is just the row's English label again
          const src = raw && !t.gloss && raw.trim().replace(/\.$/, '') !== r.label ? raw : undefined;
          const next = !!r.next?.length && (
            <span className="nexts">
              {r.next.map((item) => (
                <span key={item.id}>
                  <XRef id={item.id} />
                  {item.note && <span className="muted"> ({item.note})</span>}
                </span>
              ))}
            </span>
          );
          return (
            <tr role="row" key={r.min} className={isHit ? 'hit' : undefined} aria-current={isHit ? 'true' : undefined} tabIndex={isHit ? -1 : undefined}>
              <td className="rng">{rangeText(r, t.dice)}{!showResult && next}</td>
              {showResult && (
                <td>
                  {!lookup && showLabel(t, r) && <span className="lbl">{r.label}</span>}
                  {(!lookup || r.ko !== r.label) && r.ko}
                  {src && <span className="src">{src}</span>}
                  {next}
                </td>
              )}
              {t.columns?.map((c) => (
                <td key={c.key} data-col={c.ko}>
                  {r.cols?.[c.key]}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
