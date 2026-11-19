import type { ReactNode } from 'react';
import type { OracleTable } from '../../content/schema';
import { OracleBody } from '../../views/Oracle';
import type { RoomShapeState } from '../RoomShapeDiagram';

export function PlayRoll({ label, table, value, onValue, roomShape, afterResult }: {
  label: string;
  table: OracleTable;
  value: number | null;
  onValue: (value: number | null) => void;
  roomShape?: RoomShapeState;
  afterResult?: ReactNode;
}) {
  return (
    <section className="play-explore-step" aria-label={label}>
      <h3>{label}</h3>
      <OracleBody t={table} value={value} onValue={onValue} roomShape={roomShape} afterResult={afterResult} compact collapseTableBeforeRoll />
    </section>
  );
}
