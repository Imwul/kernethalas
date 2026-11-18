import { describe, it, expect } from 'vitest';
import { search, chosung, findSituations, querySuggestions } from '../src/lib/search';

const top = (q: string, n = 3) => search(q).slice(0, n).map((h) => h.doc.id);

describe('bilingual search', () => {
  it('finds rules by English term', () => {
    expect(top('Prone')).toContain('prone');
    expect(top('Defensive Move')).toContain('defensive-move');
    expect(top('Overseer Influence')).toContain('overseer-influence');
    expect(top('Resolve')).toEqual(expect.arrayContaining(['resistances']));
  });
  it('finds rules by Korean term', () => {
    expect(top('넘어짐')).toContain('prone');
    expect(top('출혈')).toContain('bleeding');
    expect(top('긴장 주사위')).toContain('tension-die');
    expect(top('방어 동작')).toContain('defensive-move');
  });
  it('matches Hangul initials', () => {
    expect(chosung('넘어짐')).toBe('ㄴㅇㅈ');
    expect(top('ㄴㅇㅈ', 5)).toContain('prone');
  });
  it('tolerates a one-letter typo in English', () => {
    expect(top('tenson', 5)).toEqual(expect.arrayContaining([expect.stringMatching(/tension/)]));
  });
  it('finds tables and creatures', () => {
    expect(top('growing darkness')).toContain('t-growing-darkness');
    expect(top('Necropede')).toContain('cr-necropede');
  });
  it('finds Masteries by English name, Korean gloss, initials and ability', () => {
    expect(top('Flamecaster', 1)).toEqual(['m-flamecaster']);
    expect(top('화염술사', 1)).toEqual(['m-flamecaster']);
    expect(top('ㅎㅇㅅㅅ', 1)).toEqual(['m-flamecaster']);
    expect(top('Fireball', 1)).toEqual(['m-flamecaster']);
    expect(top('무기의 달인', 1)).toEqual(['m-weapon-master']);
  });
  it('finds creatures by one of their action names', () => {
    expect(top('Shadow Reapers', 1)).toEqual(['cr-dreadlord']);
    expect(top('Chain Lash', 1)).toEqual(['cr-abyssal-vexator']);
  });
  it('keeps the removed title glosses searchable', () => {
    expect(top('Damage Pool')).toContain('damage-pool');
    expect(top('도메인 지배자')).toContain('overseers');
  });
  it('matches transposed letters, abbreviations and Korean particles attached to English', () => {
    expect(top('prnoe', 1)).toEqual(['prone']);
    expect(top('dmg', 1)).toEqual(['damage-pool']);
    expect(top('Armor를 어떻게 계산하나요?', 3)).toContain('q-damage-order');
  });
  it('filters content types and returns the matched text for a table row', () => {
    const hits = search('Catastrophic Tumble', 5, 'table');
    expect(hits[0]).toMatchObject({ doc: { id: 't-noncombat-crits' }, snippet: expect.stringContaining('Catastrophic Tumble') });
    expect(hits.every(({ doc }) => doc.kind === 'table')).toBe(true);
    expect(search('new room', 5, 'procedure')[0].doc.id).toBe('p-explore-room');
    expect(search('defensive move', 5, 'reference').every(({ doc }) => !['table', 'procedure'].includes(doc.kind))).toBe(true);
  });
  it('suggests relevant runnable queries after an over-specific or misspelled query', () => {
    const query = 'Gorwing uniquelyunfound';
    expect(search(query, 5, 'table')).toEqual([]);
    expect(querySuggestions(query, 'table')).toContain('Growing Darkness');
    expect(querySuggestions('asdfghjkl', 'procedure').every((term) => search(term, 1, 'procedure').length === 1)).toBe(true);
    expect(search('??')).toEqual([]);
  });
});

describe('situation finder', () => {
  it.each([
    ['공격과 방어가 모두 실패했다', 'both-fail', 'q-both-fail'],
    ['상대방의 공격을 방어하려 한다', 'defend', 'attack-check'],
    ['여러 적과 동시에 싸우고 있다', 'multiple-enemies', 'q-multiple-enemies'],
    ['Prone 상태에서 일어나려 한다', 'stand', 'q-prone-stand'],
    ['Frightening 특성을 가진 적을 만났다', 'frightening', 'frightening-horrifying'],
    ['피해량과 Armor를 계산해야 한다', 'damage', 'q-damage-order'],
    ['새로운 공간을 탐험하려 한다', 'explore', 'p-explore-room'],
    ['Overseer와 관련된 효과를 확인해야 한다', 'overseer', 'overseer-influence'],
    ['How do I stand up from Prone?', 'stand', 'q-prone-stand'],
    ['How do I defend?', 'defend', 'attack-check'],
    ['What if both rolls failed?', 'both-fail', 'q-both-fail'],
  ])('links “%s” to its existing Gravebound reference', (query, situation, ref) => {
    expect(findSituations(query)[0]?.id).toBe(situation);
    expect(top(query, 3)).toContain(ref);
  });
  it('finds English terms typed the way they sound in Hangul', () => {
    expect(top('프론', 1)).toEqual(['prone']);
    expect(top('텐션 다이', 1)).toEqual(['tension-die']);
    expect(top('텐션다이', 1)).toEqual(['tension-die']);
    expect(top('파이어볼', 1)).toEqual(['m-flamecaster']);
    expect(top('플레임캐스터', 1)).toEqual(['m-flamecaster']);
    expect(top('이니셔티브', 1)).toEqual(['initiative']);
    expect(top('데미지 풀', 1)).toEqual(['damage-pool']);
  });
});
