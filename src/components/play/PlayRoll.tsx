import type { OracleTable } from '../../content/schema';
import { OracleBody } from '../../views/Oracle';

export function PlayRoll({ label, table, value, onValue }: {
  label: string;
  table: OracleTable;
  value: number | null;
  onValue: (value: number | null) => void;
}) {
  return (
    <section className="play-explore-step" aria-label={label}>
      <h3>{label}</h3>
      <OracleBody t={table} value={value} onValue={onValue} compact collapseTableBeforeRoll />
    </section>
  );
}
