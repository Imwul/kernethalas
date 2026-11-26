import { useState } from 'react';
import { usePlayDraft, usePlayRoll } from '../../lib/play-draft';
import { readEquipmentCount } from '../../lib/play-equipment';
import { CANDLE_LIGHT_UNITS, PLAY_LIGHT_SLOT, STANDARD_LIGHT_UNITS, lightRemaining, readPlayLight, type PlayLight as LightRecord, type PlaySupplies } from '../../lib/play-light';
import { playAction } from '../../lib/play-roll-history';
import { XRef } from '../bits';
import { TogglePanel } from '../TogglePanel';
import '../../styles/play-light.css';

export function PlayLight({ supplies, onOpenGear }: { supplies: PlaySupplies; onOpenGear?: () => void }) {
  const draft = usePlayDraft();
  const commit = usePlayRoll();
  const [typed, setTyped] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  if (!draft) return null;
  const remaining = lightRemaining(readPlayLight(draft.slots), supplies.lightEntries);
  const stockText = (value: number | null) => value === null ? '미기록' : `${value}개`;
  const record = (amount: number | null) => {
    const light: LightRecord | null = amount === null ? null : { remaining: amount, included: supplies.lightEntries.map(({ id }) => id) };
    commit(() => draft.write(draft.generation, PLAY_LIGHT_SLOT, light, null),
      playAction(amount === null ? '광원 종이 기록으로 전환' : `광원 잔량 ${amount} 기록`));
    setTyped(null);
    setInvalid(false);
  };
  return (
    <TogglePanel className="play-light" label="광원 기록" badge={remaining === null ? '미기록' : `잔량 ${remaining}`}>
      <p className="play-light-stock">예비 Torch {stockText(supplies.torch)} · 램프 {stockText(supplies.lamp)} · Lamp Oil {stockText(supplies.oil)} · 양초 {stockText(supplies.candle)}</p>
      <form className="play-light-entry" onSubmit={(event) => {
        event.preventDefault();
        const value = typed?.trim();
        const amount = value ? readEquipmentCount(value) : null;
        if (amount === null) { setInvalid(true); return; }
        record(amount);
      }}>
        <label className="field"><span>현재 광원 잔량</span>
          <input inputMode="numeric" value={typed ?? (remaining === null ? '' : String(remaining))} aria-invalid={invalid || undefined}
            onChange={(event) => { setTyped(event.target.value); setInvalid(false); }} />
        </label>
        <button className="btn ghost" type="submit" disabled={typed === null}>잔량 저장</button>
        {remaining !== null && <button className="btn ghost" type="button" onClick={() => record(null)}>종이로만 기록</button>}
      </form>
      {invalid && <p className="field-err" role="alert">0 이상의 정수를 입력하세요.</p>}
      <div className="play-light-actions">
        <button className="btn ghost" type="button" onClick={() => { setTyped(String(STANDARD_LIGHT_UNITS)); setInvalid(false); }}>
          횃불·램프 {STANDARD_LIGHT_UNITS} 입력
        </button>
        <button className="btn ghost" type="button" onClick={() => { setTyped(String(CANDLE_LIGHT_UNITS)); setInvalid(false); }}>
          양초 {CANDLE_LIGHT_UNITS} 입력
        </button>
        {onOpenGear && <button className="btn ghost" type="button" onClick={onOpenGear}>장비 장부에서 사용 기록</button>}
      </div>
      <p className="play-explore-note">광원 잔량과 예비 소모품은 각각 기록합니다. <XRef id="lightsource">광원 규칙</XRef></p>
    </TogglePanel>
  );
}
