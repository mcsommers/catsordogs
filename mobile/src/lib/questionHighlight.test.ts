import { questionHighlightParts } from './questionHighlight';

describe('questionHighlightParts', () => {
  it('returns one segment when the query is empty', () => {
    expect(questionHighlightParts('Hello world', '')).toEqual([{ text: 'Hello world', highlight: false }]);
  });

  it('marks matching words for search highlighting', () => {
    expect(questionHighlightParts('Something you love most?', 'love')).toEqual([
      { text: 'Something you ', highlight: false },
      { text: 'love', highlight: true },
      { text: ' most?', highlight: false },
    ]);
  });

  it('is case insensitive', () => {
    expect(questionHighlightParts('LOVE wins', 'love')).toEqual([
      { text: 'LOVE', highlight: true },
      { text: ' wins', highlight: false },
    ]);
  });
});
