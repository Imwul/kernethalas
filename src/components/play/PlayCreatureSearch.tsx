import { useId, useState } from 'react';
import { creatureById, type CreatureRecord } from '../../content/entries/creatures';
import { findCreatureNames } from '../../lib/search';

export function PlayCreatureSearch({ label = '생물 이름', onSelect }: {
  label?: string;
  onSelect: (creature: CreatureRecord) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const names = findCreatureNames(query);

  return (
    <div className="play-combat-search">
      <div className="field">
        <label htmlFor={inputId}>{label}</label>
        <input id={inputId} type="search" placeholder="예: Necropede, 네크로피드" value={query}
          onChange={(event) => setQuery(event.target.value)} />
      </div>
      {query.trim() && names.length === 0 && <p role="status">이름에 맞는 생물이 없습니다.</p>}
      {names.length > 0 && (
        <ul className="play-combat-matches">
          {names.map((id) => {
            const creature = creatureById.get(id);
            return creature && (
              <li key={id}><button type="button" className="btn ghost" onClick={() => {
                setQuery('');
                onSelect(creature);
              }}>{creature.name}</button></li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
