import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { overlay } from '../lib/overlay';
import { nav, useNav } from '../lib/store';
import { IClose } from './icons';
import { ChoiceButtons } from './ChoiceButtons';

const KEY = 'kn-reading-preferences-v1';
const DENSITIES = ['normal', 'compact', 'spacious'] as const;
const TEXT_SIZES = ['normal', 'large'] as const;
type Preferences = {
  density: typeof DENSITIES[number];
  textSize: typeof TEXT_SIZES[number];
  contrast: boolean;
  /** Original English wording under our Korean text; only exists with the local overlay. */
  originals: boolean;
};
const INITIAL: Preferences = { density: 'normal', textSize: 'normal', contrast: false, originals: true };

function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Preferences> | null;
    return {
      density: DENSITIES.find((density) => density === saved?.density) ?? INITIAL.density,
      textSize: TEXT_SIZES.find((size) => size === saved?.textSize) ?? INITIAL.textSize,
      contrast: saved?.contrast === true,
      originals: saved?.originals !== false,
    };
  } catch { return INITIAL; }
}

export function ReadingSettings() {
  const { theme } = useNav();
  const [preferences, setPreferences] = useState(readPreferences);
  const [open, setOpen] = useState(false);
  const [temporary, setTemporary] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.readingDensity = preferences.density;
    root.dataset.readingText = preferences.textSize;
    root.dataset.readingContrast = preferences.contrast ? 'high' : 'normal';
    if (overlay && !preferences.originals) root.dataset.readingOriginals = 'hidden';
    else delete root.dataset.readingOriginals;
  }, [preferences]);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    element.showModal();
    return () => {
      element.close();
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (!temporary && (event.key === KEY || event.key === null)) setPreferences(readPreferences());
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, [temporary]);

  const update = (patch: Partial<Preferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setTemporary(false);
    } catch { setTemporary(true); }
  };

  return (
    <>
      <button ref={trigger} type="button" className="iconbtn reading-settings-trigger" aria-label="읽기 설정" aria-haspopup="dialog"
        title="읽기 설정" onClick={() => setOpen(true)}><span aria-hidden="true">가A</span></button>
      <dialog ref={dialog} className="reading-settings" aria-labelledby="reading-settings-title"
        onCancel={(event) => { event.preventDefault(); setOpen(false); }}
        onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div className="reading-settings-body">
          <div className="reading-settings-heading">
            <h2 id="reading-settings-title">읽기 설정</h2>
            <button type="button" className="iconbtn" aria-label="읽기 설정 닫기" onClick={() => setOpen(false)}><IClose /></button>
          </div>
          <ChoiceButtons label="테마" value={theme} onChange={(value) => nav.setTheme(value)} options={[
            { value: 'system', label: '시스템' }, { value: 'dark', label: '어두움' }, { value: 'light', label: '밝음' },
          ]} />
          <ChoiceButtons label="글자 크기" value={preferences.textSize} onChange={(textSize) => update({ textSize })} options={[
            { value: 'normal', label: '기본' }, { value: 'large', label: '크게' },
          ]} />
          <ChoiceButtons label="읽기 간격" value={preferences.density} onChange={(density) => update({ density })} options={[
            { value: 'normal', label: '기본' }, { value: 'compact', label: '촘촘하게' }, { value: 'spacious', label: '여유 있게' },
          ]} />
          <label className="reading-settings-check"><input type="checkbox" checked={preferences.contrast}
            onChange={(event) => update({ contrast: event.target.checked })} />높은 대비</label>
          {overlay && <label className="reading-settings-check"><input type="checkbox" checked={preferences.originals}
            onChange={(event) => update({ originals: event.target.checked })} />원문 함께 보기</label>}
          {temporary && <p role="status">저장 공간을 사용할 수 없어 현재 탭에 적용했습니다.</p>}
        </div>
      </dialog>
    </>
  );
}
