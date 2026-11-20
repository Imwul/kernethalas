import type { ReactNode } from 'react';
import type { OracleTable } from '../../content/schema';
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
  const body = <OracleBody t={table} value={value} onValue={onValue} roomShape={roomShape} afterResult={afterResult} compact collapseTableBeforeRoll />;
  return (
    <section className="play-explore-step" aria-label={label}>
      <h3>{label}</h3>
      {condense ? <PlayFinishedStep summary={row ? `${table.dice} ${value} · ${row.ko}` : null}>{body}</PlayFinishedStep> : body}
    </section>
  );
}
