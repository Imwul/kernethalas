import { useId, useState, type ReactNode } from 'react';
import { parseDice, pooledDie, rollDie, type RollResult } from '../lib/dice';
import { readOracleValue } from '../lib/oracle';
import { usePlayRoll, usePlayRollField, usePlayRollInput } from '../lib/play-draft';
import type { PlayRollDetails } from '../lib/play-roll-history';
import { PlayDieHint, PlayZeroKey } from './play/PlayDieHints';
import '../styles/loot-journal.css';
import { RollButton } from './RollButton';

/** Damage Pool roll: one die counts. `choose` lets the player pick it; otherwise the highest die is used. */
export interface DamagePoolOptions {
  choose: boolean;
  /** Damage type of each die, in roll order. */
  labels?: readonly string[];
  /** Damage this die would deal once the target's defenses apply. */
  preview?: (amount: number, index: number) => ReactNode;
}

export function PhysicalDiceRoll({ label, dice, value, onValue, resultText, pool }: {
  label: string;
  dice: string;
  value?: RollResult;
  onValue: (value: RollResult) => void;
  resultText?: (value: RollResult) => ReactNode;
  pool?: DamagePoolOptions;
}) {
  const id = useId();
  const fieldKey = `dice:${label}`;
  const [typed, setTyped] = usePlayRollInput(`${fieldKey}:${dice}`);
  const [invalid, setInvalid] = useState(false);
  const commit = usePlayRoll();
  const terms = dice.split(/\+(?=\s*\d*d)/i).map(parseDice);
  const parsed = terms.filter((term) => term !== null);
  const allowZero = parsed.length === 1 && parsed[0].count === 1 && parsed[0].sides === 100;
  const field = usePlayRollField(fieldKey, label, dice, value?.expr === dice && !typed, allowZero);
  if (parsed.length !== terms.length) return null;
  const sides = parsed.flatMap((term) => Array.from({ length: term.count }, () => term.sides));
  const mod = parsed.reduce((total, term) => total + term.mod, 0);
  const sameSize = sides.every((side) => side === sides[0]);
  const applied = value?.expr === dice ? value : undefined;
  const picked = applied && pool ? pooledDie(applied) : null;
  const signedMod = mod > 0 ? ` +${mod}` : mod < 0 ? ` −${-mod}` : '';

  const apply = (faces: number[], source: PlayRollDetails['source']) => {
    const picked = pool ? pooledDie({ dice: faces, mod }) : null;
    commit(() => onValue(picked
      ? { expr: dice, dice: faces, mod, total: picked.amount, pick: picked.index }
      : { expr: dice, dice: faces, mod, total: faces.reduce((total, face) => total + face, mod) }), {
      label, dice, value: faces.map((face, index) => sides[index] === 100 && face === 100 ? '00' : String(face)).join(pool ? ' / ' : ' + '),
      source, field: field['data-play-roll-field'],
    });
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
          apply(faces.filter((face) => face !== null), 'manual');
        }
      }}>
        <div className="field"><label htmlFor={id}>직접 굴린 값</label><PlayDieHint dice={dice} sides={sides.length === 1 ? sides[0] : undefined} />
          <input id={id} value={typed} {...field} inputMode={sides.length === 1 ? 'numeric' : 'text'} autoComplete="off"
            onChange={(event) => { setTyped(event.target.value); setInvalid(false); }} aria-invalid={invalid || undefined}
            placeholder={sides.length === 1 ? `1–${sides[0]}` : '공백으로 구분'} />
        </div>
        {allowZero && <PlayZeroKey onInput={() => { setTyped('00'); setInvalid(false); }} />}
        <button className="btn ghost" type="submit">확인</button>
        <RollButton onClick={() => apply(sides.map((side) => rollDie(side)), 'app')} />
        {invalid && <p className="field-err" role="alert">{sameSize
          ? `1–${sides[0]}${sides[0] === 100 ? ' 또는 00' : ''} 결과를 ${sides.length}개 입력하세요.`
          : '표시된 주사위 순서대로 결과를 공백으로 구분해 입력하세요.'}</p>}
      </form>
      {applied && pool?.choose && applied.dice.length > 1 && picked && <fieldset className="damage-pool-pick">
        <legend>사용할 주사위 하나</legend>
        {applied.dice.map((face, index) => {
          const amount = face + applied.mod;
          return <label className="damage-pool-option" key={index}>
            <input type="radio" name={`${id}-pick`} checked={picked.index === index}
              onChange={() => onValue({ ...applied, pick: index, total: amount })} />
            <span className="damage-pool-face">{pool.labels?.[index] && `${pool.labels[index]} `}<b>{face}</b>{signedMod}</span>
            {pool.preview && <span className="damage-pool-preview">{pool.preview(amount, index)}</span>}
            {index === picked.highest && <span className="damage-pool-tag">가장 높음</span>}
          </label>;
        })}
      </fieldset>}
      {applied && <div className="loot-roll-result" role="status">
        <span className="readout">{picked ? picked.amount : applied.total}</span>
        {resultText && <span>{resultText(picked ? { ...applied, total: picked.amount, pick: picked.index } : applied)}</span>}
      </div>}
    </fieldset>
  );
}
