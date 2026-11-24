import type { CheckOutcome } from '../../lib/dice';
import { usePlayDraftState } from '../../lib/play-draft';
import { PhysicalSkillRoll } from '../PhysicalSkillRoll';
import { XRef } from '../bits';

export function PlayFlee({ onFlee }: { onFlee: () => void }) {
  const [outcome, setOutcome] = usePlayDraftState<CheckOutcome | null>('flee-outcome', null);
  const passed = outcome === 'success' || outcome === 'critical';
  return (
      <section className="play-flee play-aux-body" aria-label="전투 도주">
        <p className="play-combat-note">표준 행동을 사용해 Dodge를 굴립니다.</p>
        <PhysicalSkillRoll label="도주 Dodge 판정" skill="Dodge" slot="flee-dodge"
          onResult={(result) => setOutcome(result.outcome)} onClear={() => setOutcome(null)} />
        {outcome && <p className="play-combat-note">{passed
          ? '이전 장소로 물러납니다. 이곳에 돌아오면 남겨둔 적은 Health가 가득 찹니다.'
          : '길이 막혔습니다. 이 전투에서 이탈할 수 없습니다.'}</p>}
        {passed && <button type="button" className="btn primary play-aux-action" onClick={() => {
          setOutcome(null);
          onFlee();
        }}>후퇴하고 적 편성 기록</button>}
        <XRef id="q-flee" />
      </section>
  );
}
