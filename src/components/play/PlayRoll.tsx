import { useMemo, type ReactNode } from 'react';
import type { OracleTable } from '../../content/schema';
import { rowDetail, rowTitle } from '../../lib/oracle';
import { OracleBody } from '../../views/Oracle';
import type { RoomShapeState } from '../RoomShapeDiagram';
import { PlayFinishedStep } from './PlayFocus';

export function PlayRoll({ label, table, value, onValue, roomShape, afterResult, condense = false }: {
  label: string;
  table: OracleTable;
  value: number | null;
  onValue: (value: number | null) => void;
  roomShape?: RoomShapeState;
  afterResult?: ReactNode;
  condense?: boolean;
}) {
  const row = condense && value !== null ? table.rows.find(({ min, max }) => value >= min && value <= max) : undefined;
  // Editorial clarifications explain the summary itself; at the table they only push the next roll down.
  const playTable = useMemo(() => table.notes?.some(({ type }) => type === 'clarification')
    ? { ...table, notes: table.notes.filter(({ type }) => type !== 'clarification') } : table, [table]);
  const body = <OracleBody t={playTable} value={value} onValue={onValue} roomShape={roomShape} afterResult={afterResult} compact collapseTableBeforeRoll play />;
  return (
    <section className="play-explore-step" aria-label={label}>
      <h3>{label}</h3>
      {condense ? <PlayFinishedStep summary={row ? `${table.dice} ${value} · ${rowTitle(row)}` : null} detail={row ? rowDetail(row) : undefined}>{body}</PlayFinishedStep> : body}
    </section>
  );
}
