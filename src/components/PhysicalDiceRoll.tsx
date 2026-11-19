import { useState, type ReactNode } from 'react';
import { parseDice, rollDie, type RollResult } from '../lib/dice';
import { readOracleValue } from '../lib/oracle';
import { usePlayRoll } from '../lib/play-draft';
import '../styles/loot-journal.css';

export function PhysicalDiceRoll({ label, dice, value, onValue, resultText }: {
  label: string;
  dice: string;
  value?: RollResult;
  onValue: (value: RollResult) => void;
  resultText?: (value: RollResult) => ReactNode;
}) {
  const [typed, setTyped] = useState('');
  const [invalid, setInvalid] = useState(false);
  const commit = usePlayRoll();
  const terms = dice.split(/\+(?=\s*\d*d)/i).map(parseDice);
  const parsed = terms.filter((term) => term !== null);
  if (parsed.length !== terms.length) return null;
  const sides = parsed.flatMap((term) => Array.from({ length: term.count }, () => term.sides));
  const mod = parsed.reduce((total, term) => total + term.mod, 0);
  const sameSize = sides.every((side) => side === sides[0]);
  const applied = value?.expr === dice ? value : undefined;

  const apply = (faces: number[]) => {
    commit(() => onValue({ expr: dice, dice: faces, mod, total: faces.reduce((total, face) => total + face, mod) }));
    setTyped('');
    setInvalid(false);
  };

  return (
    <fieldset className="loot-roll physical-dice-roll">
      <legend>{label} {dice}</legend>
      <form className="loot-roll-form" data-play-roll noValidate onSubmit={(event) => {
        event.preventDefault();
        const pieces = typed.trim().split(/[\s,]+/);
        const faces = sides.map((size, index) => readOracleValue(pieces[index] ?? '', size));
        if (pieces.length !== sides.length || faces.some((face) => face === null)) {
          setInvalid(true);
        } else {
          apply(faces.filter((face) => face !== null));
        }
      }}>
        <label className="field"><span>직접 굴린 값</span>
          <input value={typed} data-play-dice inputMode={sides.length === 1 ? 'numeric' : 'text'} autoComplete="off"
            onChange={(event) => { setTyped(event.target.value); setInvalid(false); }} aria-invalid={invalid || undefined}
            placeholder={sides.length === 1 ? `1–${sides[0]}` : '공백으로 구분'} />
        </label>
        <button className="btn ghost" type="submit">확인</button>
        <button className="btn ghost" type="button" onClick={() => apply(sides.map((side) => rollDie(side)))}>굴리기</button>
        {invalid && <p className="field-err" role="alert">{sameSize
          ? `1–${sides[0]}${sides[0] === 100 ? ' 또는 00' : ''} 결과를 ${sides.length}개 입력하세요.`
          : '표시된 주사위 순서대로 결과를 공백으로 구분해 입력하세요.'}</p>}
      </form>
      {applied && <div className="loot-roll-result" role="status">
        <span className="readout">{applied.total}</span>
        {resultText && <span>{resultText(applied)}</span>}
      </div>}
    </fieldset>
  );
}
