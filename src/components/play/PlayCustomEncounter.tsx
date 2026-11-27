import { useId, useRef, useState } from 'react';
import { creatureById, creatureName } from '../../content/entries/creatures';
import { exportEncounterLibrary, intersects, MAX_SET_NAME, parseEncounterExport, type EncounterSet, type PlayCustomEncounterRow } from '../../lib/custom-encounters';
import { readOracleValue } from '../../lib/oracle';
import { PlayCreatureSearch } from './PlayCreatureSearch';

function rangeText({ min, max }: PlayCustomEncounterRow) {
  return min === max ? String(min) : `${min}–${max}`;
}

export function EncounterLibraryControls({ sets, active, onSelect, onChange }: {
  sets: EncounterSet[];
  active: EncounterSet;
  onSelect: (id: string) => void;
  onChange: (sets: EncounterSet[]) => void;
}) {
  const importInput = useRef<HTMLInputElement>(null);
  const latestSets = useRef(sets);
  latestSets.current = sets;
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const addSets = (items: Omit<EncounterSet, 'id'>[]) => {
    const additions = items.map((item) => ({ ...item, id: crypto.randomUUID() }));
    onChange([...latestSets.current, ...additions]);
    onSelect(additions[0].id);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportEncounterLibrary(sets)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kernethalas-encounters.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="play-custom-library">
      <label className="field"><span>이 도메인에서 사용할 조우표</span>
        <select value={active.id} onChange={(event) => onSelect(event.target.value)}>
          {sets.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <details className="fold play-custom-management">
        <summary>조우표 관리 및 파일 공유</summary>
        <EncounterSetName key={active.id} active={active} onRename={(name) => {
          onChange(sets.map((set) => set.id === active.id ? { ...set, name } : set));
        }} />
        <div className="play-custom-row-actions">
          <button className="btn ghost" type="button" onClick={() => {
            let number = sets.length + 1;
            while (sets.some(({ name }) => name === `조우표 ${number}`)) number += 1;
            addSets([{ name: `조우표 ${number}`, rows: [] }]);
            setNotice('새 조우표를 만들었습니다.');
          }}>새 조우표</button>
          <button className="btn ghost" type="button" onClick={download}>모두 내보내기</button>
          <button className="btn ghost" type="button" onClick={() => importInput.current?.click()}>파일 불러오기</button>
          <input ref={importInput} hidden aria-label="조우표 JSON 파일" type="file" accept=".json,application/json" onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setNotice('');
            setError('');
            try {
              const imported = parseEncounterExport(await file.text());
              if (!imported) {
                setError('이 사이트에서 내보낸 JSON과 1–20 범위를 확인하세요.');
                return;
              }
              addSets(imported);
              setNotice(`조우표 ${imported.length}개를 추가했습니다.`);
            } catch { setError('파일을 읽을 수 없습니다.'); }
          }} />
        </div>
        {notice && <p className="play-combat-note" role="status">{notice}</p>}
        {error && <p className="field-err" role="alert">{error}</p>}
      </details>
    </div>
  );
}

function EncounterSetName({ active, onRename }: { active: EncounterSet; onRename: (name: string) => void }) {
  const [name, setName] = useState(active.name);
  return (
    <form className="play-custom-name" onSubmit={(event) => {
      event.preventDefault();
      if (name.trim()) {
        onRename(name.trim());
        setName(name.trim());
      }
    }}>
      <label className="field"><span>조우표 이름</span>
        <input maxLength={MAX_SET_NAME} required value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button className="btn ghost" type="submit" disabled={!name.trim() || name.trim() === active.name}>이름 저장</button>
    </form>
  );
}

export function PlayCustomEncounterEditor({ rows, onChange }: {
  rows: PlayCustomEncounterRow[];
  onChange: (rows: PlayCustomEncounterRow[]) => void;
}) {
  const id = useId();
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [creatureId, setCreatureId] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(rows.length === 0);
  const creature = creatureById.get(creatureId);

  const clearDraft = () => {
    setEditing(null);
    setMinText('');
    setMaxText('');
    setCreatureId('');
    setError('');
  };
  const save = () => {
    const min = readOracleValue(minText.trim(), 20);
    const max = maxText.trim() ? readOracleValue(maxText.trim(), 20) : min;
    if (min === null || max === null || min > max) {
      setError('1–20 안에서 시작 값이 끝 값보다 작거나 같아야 합니다.');
      return;
    }
    if (!creature) {
      setError('범위에 연결할 생물을 검색해 선택하세요.');
      return;
    }
    const row = { min, max, creatureId };
    const other = rows.filter((candidate) => candidate.min !== editing);
    if (other.some((candidate) => intersects(candidate, row))) {
      setError('이미 저장한 주사위 범위와 겹칩니다.');
      return;
    }
    onChange([...other, row].sort((first, second) => first.min - second.min));
    clearDraft();
  };

  return (
    <details className="fold play-custom-encounter" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>사용자 지정 조우표 편집</summary>
      <div className="play-custom-body">
        {rows.length > 0 && <ul className="play-custom-rows" aria-label="저장한 조우 범위">
          {rows.map((row) => {
            const range = rangeText(row);
            return <li key={row.min}>
              <span className="play-custom-range">{range}</span>
              <strong>{creatureName(creatureById.get(row.creatureId) ?? { id: row.creatureId, name: row.creatureId })}</strong>
              <div className="play-custom-row-actions">
                <button type="button" className="btn ghost" aria-label={`${range} 범위 수정`} onClick={() => {
                  setEditing(row.min);
                  setMinText(String(row.min));
                  setMaxText(row.min === row.max ? '' : String(row.max));
                  setCreatureId(row.creatureId);
                  setError('');
                }}>수정</button>
                <button type="button" className="btn ghost" aria-label={`${range} 범위 삭제`} onClick={() => {
                  onChange(rows.filter((candidate) => candidate.min !== row.min));
                  if (editing === row.min) clearDraft();
                }}>삭제</button>
              </div>
            </li>;
          })}
        </ul>}
        <form className="play-custom-form" noValidate onSubmit={(event) => {
          event.preventDefault();
          save();
        }}>
          <div className="play-custom-fields">
            <label className="field"><span>시작 D20</span>
              <input inputMode="numeric" autoComplete="off" placeholder="1–20" value={minText} onChange={(event) => {
                setMinText(event.target.value);
                setError('');
              }} />
            </label>
            <label className="field"><span>끝 D20 (선택)</span>
              <input inputMode="numeric" autoComplete="off" placeholder="1–20" value={maxText} onChange={(event) => {
                setMaxText(event.target.value);
                setError('');
              }} />
            </label>
          </div>
          <PlayCreatureSearch label="범위에 연결할 생물" onSelect={(candidate) => {
            setCreatureId(candidate.id);
            setError('');
          }} />
          {creature && <p className="play-combat-note" role="status">선택한 생물 <strong>{creatureName(creature)}</strong></p>}
          <div className="play-custom-row-actions">
            <button type="submit" className="btn primary" aria-describedby={error ? `${id}-error` : undefined}>
              {editing === null ? '범위 추가' : '수정 저장'}
            </button>
            {editing !== null && <button type="button" className="btn ghost" onClick={clearDraft}>수정 취소</button>}
          </div>
          {error && <p id={`${id}-error`} className="field-err" role="alert">{error}</p>}
        </form>
      </div>
    </details>
  );
}
