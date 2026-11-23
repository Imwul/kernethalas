import { describe, expect, it } from 'vitest';
import { createPlayTimelineEntry, formatTimeline } from '../src/lib/play-timeline';

describe('formatTimeline', () => {
  it('lists every place in visiting order with facts and sheet lines', () => {
    const first = createPlayTimelineEntry({ id: '1/1', domainId: 1, roomNumber: 1, title: '장소 1',
      facts: [{ label: '모양', value: '방 · 출입구 2개' }], sheet: [], applied: [] })!;
    const second = createPlayTimelineEntry({ id: '1/2', domainId: 1, roomNumber: 2, title: '납골당', paperId: 'B3',
      facts: [{ label: '이벤트', value: '42' }], sheet: [{ id: 'hp', text: 'Health −2' }], applied: ['hp:Health −2'], journalCopied: true })!;
    expect(formatTimeline([first, second], '도메인 1')).toBe([
      '도메인 1',
      '장소 1\n모양 · 방 · 출입구 2개',
      '장소 2 · 납골당 · 지도 B3\n이벤트 · 42\n시트 · Health −2',
    ].join('\n\n'));
  });
});
