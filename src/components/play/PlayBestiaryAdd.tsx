import { useId, useRef, useState } from 'react';
import type { CreatureRecord } from '../../content/entries/creatures';

export function PlayBestiaryAdd({ creature, finished, onAdd, onCancel }: {
  creature: CreatureRecord;
  finished?: boolean;
  onAdd: (count: number) => void;
  onCancel: () => void;
}) {
  const title = useId();
  const input = useId();
  const [value, setValue] = useState('1');
  const submitted = useRef(false);
  const count = /^\d+$/.test(value.trim()) ? Number(value) : 0;
  const valid = count >= 1 && count <= 20;

  return (
    <section className="play-bestiary-add" aria-labelledby={title}>
      <h3 id={title}>도감 생물을 조우에 추가</h3>
      <p><strong lang="en">{creature.name}</strong> · 도감 개체 수 <span>{creature.number}</span></p>
      {finished ? <>
        <p>이 조우는 이미 끝났습니다. 추가하려면 먼저 조우를 다시 선택하세요.</p>
        <button className="btn ghost" type="button" onClick={onCancel}>추가 취소</button>
      </> : <form className="play-aux-form" onSubmit={(event) => {
        event.preventDefault();
        if (!valid || submitted.current) return;
        submitted.current = true;
        onAdd(count);
      }}>
        <div className="field">
          <label htmlFor={input}>추가할 개체 수</label>
          <input id={input} value={value} inputMode="numeric" autoComplete="off"
            aria-invalid={!valid || undefined} aria-describedby={!valid ? `${input}-hint` : undefined}
            onChange={(event) => setValue(event.target.value)} />
        </div>
        <button className="btn primary" type="submit" disabled={!valid}>조우에 추가 확정</button>
        <button className="btn ghost" type="button" onClick={onCancel}>추가 취소</button>
        {!valid && <p className="field-err" id={`${input}-hint`}>1–20 사이의 개체 수를 입력하세요.</p>}
      </form>}
    </section>
  );
}
