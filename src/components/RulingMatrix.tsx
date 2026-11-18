import { useState } from 'react';
import type { Ruling } from '../content/schema';
import '../styles/ruling-matrix.css';

export function RulingMatrix({ matrix, compare = false }: { matrix: NonNullable<Ruling['matrix']>; compare?: boolean }) {
  const [selection, setSelection] = useState<{ row: number; col: number } | null>(null);
  const activeRow = selection ? matrix.rows[selection.row] : null;
  const activeColumn = selection ? matrix.head[selection.col] : null;

  return (
    <div className={compare ? 'matrix-wrap combat-matrix' : 'matrix-wrap'}>
      <table className="matrix">
        {matrix.caption && <caption>{matrix.caption}</caption>}
        <thead>
          <tr>
            {matrix.head.map((heading, col) => (
              <th key={col} scope="col" data-highlighted={selection?.col === col || undefined}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map(([heading, ...results], row) => (
            <tr key={heading}>
              <th scope="row" data-highlighted={selection?.row === row || undefined}>{heading}</th>
              {results.map((result, index) => {
                const col = index + 1;
                const selected = selection?.row === row && selection.col === col;
                return (
                  <td key={col}>
                    {compare ? (
                      <button
                        type="button"
                        aria-label={`${heading}, ${matrix.head[col]}: ${result}`}
                        aria-pressed={selected}
                        onClick={() => setSelection(selected ? null : { row, col })}
                      >
                        {result}
                      </button>
                    ) : result}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {compare && (
        <div className="combat-matrix-selection" role="status">
          {selection && activeRow && (
            <p><b>{activeRow[0]} / {activeColumn}</b><span>{activeRow[selection.col]}</span></p>
          )}
        </div>
      )}
    </div>
  );
}
