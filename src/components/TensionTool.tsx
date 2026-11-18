import { useState } from 'react';
import { rollDie } from '../lib/dice';
import { XRef } from './bits';
import '../styles/tension-tool.css';

const TENSION_DICE = [8, 6, 4] as const;
const NEXT_DIE = { 8: 6, 6: 4, 4: 8 } as const;

export function TensionTool() {
  const [result, setResult] = useState<{ sides: (typeof TENSION_DICE)[number]; value: number } | null>(null);
  const darkness = result?.sides === 4 && result.value <= 2;
  const nextDie = result && (result.value <= 2 ? NEXT_DIE[result.sides] : result.sides);

  return (
    <div className="tension-tool">
      <div className="tension-rolls" role="group" aria-label="긴장 주사위 굴리기">
        {TENSION_DICE.map((sides) => (
          <button key={sides} type="button" className="btn ghost" aria-label={`D${sides} 굴리기`} onClick={() => setResult({ sides, value: rollDie(sides) })}>
            D{sides}
          </button>
        ))}
      </div>
      <div className="tension-result" role="status">
        {result && (
          <>
            <div className="tension-value">
              <span>D{result.sides} 결과</span>
              <span className="readout">{result.value}</span>
            </div>
            <div className="tension-next">
              {darkness && <XRef id="t-growing-darkness">짙어지는 어둠 표 열기</XRef>}
              <span>{darkness && '표를 굴린 뒤 '}다음 긴장 주사위 <strong>D{nextDie}</strong></span>
            </div>
          </>
        )}
      </div>
      <div className="tension-refs">
        <XRef id="tension-die">긴장 주사위 규칙</XRef>
        <XRef id="growing-darkness">짙어지는 어둠 규칙</XRef>
      </div>
    </div>
  );
}
