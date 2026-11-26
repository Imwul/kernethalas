import type { Ruling } from '../content/schema';
import { Cite, VChip, XRef } from './bits';
import { RulingMatrix } from './RulingMatrix';

export function RulingBody({ ruling, showVerification = false, compare = ruling.id === 'q-both-fail' }: {
  ruling: Ruling;
  showVerification?: boolean;
  compare?: boolean;
}) {
  return (
    <>
      {showVerification && <div className="marks"><VChip v={ruling.verification} /> <Cite source={ruling.source} /></div>}
      <p className="ans">{ruling.answer}</p>
      {ruling.matrix && <RulingMatrix matrix={ruling.matrix} compare={compare} />}
      {ruling.conditions?.length ? <div>
        <span className="kicker">적용 조건 · 비교</span>
        <ul className="bullets">{ruling.conditions.map((text) => <li key={text}>{text}</li>)}</ul>
      </div> : null}
      {ruling.exceptions?.length ? <div>
        <span className="kicker">예외</span>
        <ul className="bullets">{ruling.exceptions.map((text) => <li key={text}>{text}</li>)}</ul>
      </div> : null}
      <div className="preview-links">
        {[...ruling.refs, ...(ruling.tables ?? [])].map((id) => <XRef key={id} id={id} showKind />)}
      </div>
      {!showVerification && <Cite source={ruling.source} />}
    </>
  );
}
