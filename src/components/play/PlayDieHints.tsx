import type { MouseEvent } from 'react';

export function PlayDieHint({ dice, sides }: { dice: string; sides?: number }) {
  return (
    <small className="play-die-hint" aria-hidden="true">
      {dice}{sides && ` · 1–${sides}`}{sides === 100 && ' · 00 허용'}
    </small>
  );
}

export function PlayZeroKey({ onInput }: { onInput: () => void }) {
  const enter = (event: MouseEvent<HTMLButtonElement>) => {
    onInput();
    const controls = event.currentTarget.form ?? event.currentTarget.parentElement;
    controls?.querySelector<HTMLInputElement>('input[data-play-roll-zero]')?.focus();
  };
  return <button className="btn ghost play-zero-key" type="button" onClick={enter} aria-label="D100에 00 입력">00</button>;
}
