import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  activateCampaign, campaignHref, CAMPAIGN_NAME_MAX, DEFAULT_PLAY_CAMPAIGN, finishCampaignCharacterSetup, PlayCampaignContext, PLAY_CAMPAIGN_PARAM,
  readTabCampaign, recoverLegacyPlayTab, saveCampaignName, usePlayCampaigns,
} from '../../lib/play-campaigns';
import { navigate, useLocation } from '../../lib/router';
import { PlayPopover } from './PlayPanels';
import '../../styles/play-campaign.css';

const CampaignDesk = createContext({ selector: null as ReactNode, needsCharacterSetup: false, finishCharacterSetup: () => {} });

/** The play desk shows the campaign picker inside its own header. */
export function useCampaignDesk() {
  return useContext(CampaignDesk);
}

export function CampaignPlay({ children }: { children: ReactNode }) {
  const { search } = useLocation();
  const [recovered] = useState(() => {
    const before = readTabCampaign();
    recoverLegacyPlayTab();
    const after = readTabCampaign();
    return after !== before ? after : null;
  });
  const { campaigns, last } = usePlayCampaigns();
  const requested = search.get(PLAY_CAMPAIGN_PARAM);
  const active = campaigns.find(({ id }) => id === requested)
    ?? campaigns.find(({ id }) => id === readTabCampaign())
    ?? campaigns.find(({ id }) => id === recovered || id === last)
    ?? campaigns[0];
  const inputId = useId();
  const [editing, setEditing] = useState<'new' | 'rename' | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [temporary, setTemporary] = useState(false);
  const [selected, setSelected] = useState(active.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelected(active.id);
    setEditing(null);
    setTemporary(activateCampaign(active.id));
  }, [active.id]);

  const open = (id: string, fromNewCampaign = false) => {
    setPickerOpen(false);
    navigate(campaignHref(id, fromNewCampaign ? undefined : search));
  };
  const edit = (mode: 'new' | 'rename') => {
    setError('');
    setName(mode === 'rename' ? active.name : '');
    setEditing(mode);
    requestAnimationFrame(() => input.current?.focus());
  };

  const selector = (
    <PlayPopover className="campaign-selector" label="플레이 캠페인 선택" open={pickerOpen} onOpenChange={setPickerOpen}
      trigger={<><span>캠페인</span><strong>{active.name}</strong></>}>
        <section aria-label="플레이 캠페인 관리" className="campaign-selector-body">
          <div className="campaign-selector-row">
            <label className="field"><span>플레이할 캠페인</span>
              <select value={selected} onChange={(event) => setSelected(event.target.value)}>
                {campaigns.map(({ id, name: title }) => <option key={id} value={id}>{title}</option>)}
              </select>
            </label>
            <button type="button" className="btn ghost" disabled={selected === active.id} onClick={() => open(selected)}>캠페인 열기</button>
          </div>
          <div className="campaign-selector-actions">
            <button type="button" className="btn ghost" onClick={() => edit('new')}>새 캠페인</button>
            <button type="button" className="btn ghost" onClick={() => edit('rename')}>이름 바꾸기</button>
          </div>
          {editing && <form className="campaign-selector-row" onSubmit={(event) => {
            event.preventDefault();
            const result = saveCampaignName(name, editing === 'rename' ? active.id : undefined);
            if ('error' in result) { setError(result.error); return; }
            setTemporary(result.temporary);
            setEditing(null);
            setError('');
            if (editing === 'new') open(result.id, true);
          }}>
            <label htmlFor={inputId} className="field"><span>캠페인 이름</span>
              <input id={inputId} value={name} ref={input} maxLength={CAMPAIGN_NAME_MAX} required autoComplete="off"
                onChange={(event) => setName(event.target.value)} />
            </label>
            <div className="campaign-selector-actions">
              <button type="submit" className="btn primary" disabled={!name.trim()}>{editing === 'new' ? '만들고 열기' : '이름 저장'}</button>
              <button type="button" className="btn ghost" onClick={() => { setEditing(null); setError(''); }}>취소</button>
            </div>
          </form>}
          {error && <p className="field-err" role="alert">{error}</p>}
        </section>
    </PlayPopover>
  );

  return (
    <>
      {requested && requested !== active.id && requested !== DEFAULT_PLAY_CAMPAIGN && <p className="campaign-storage-status" role="status">
        요청한 캠페인이 이 브라우저에 없어 {active.name} 캠페인을 열었습니다.
      </p>}
      {temporary && <p className="campaign-storage-status" role="status">브라우저에 캠페인 목록을 저장할 수 없어 이 탭에서 보관 중입니다.</p>}
      <CampaignDesk.Provider value={{ selector, needsCharacterSetup: active.needsCharacterSetup === true,
        finishCharacterSetup: () => setTemporary(finishCampaignCharacterSetup(active.id)) }}>
        <PlayCampaignContext.Provider key={active.id} value={active.id}>{children}</PlayCampaignContext.Provider>
      </CampaignDesk.Provider>
    </>
  );
}
