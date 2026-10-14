import {
  BIRTHDAY_ERROR,
  SAVE_ERROR,
  ageInYears,
  birthdayFieldProblem,
  firstProfileFinishIssue,
  parseHeightFtIn,
  profileSaveProblem,
  toggleChoice,
} from './profileForm';

describe('choosing chips', () => {
  it('adds and removes a choice', () => {
    expect(toggleChoice([], 'Hiking', 5)).toEqual(['Hiking']);
    expect(toggleChoice(['Hiking'], 'Hiking', 5)).toEqual([]);
  });

  it('ignores a new choice once the limit is reached, but still allows removing', () => {
    const full = ['a', 'b', 'c', 'd', 'e'];
    expect(toggleChoice(full, 'f', 5)).toEqual(full);
    expect(toggleChoice(full, 'a', 5)).toEqual(['b', 'c', 'd', 'e']);
  });

  it('has no limit when the field has none', () => {
    expect(toggleChoice(['a'], 'b', null)).toEqual(['a', 'b']);
  });
});

describe('birthday on Build Profile', () => {
  const today = new Date(2026, 9, 11);

  it('rejects someone under 18 immediately', () => {
    const teen = `${today.getFullYear() - 17}-01-01`;
    expect(birthdayFieldProblem(teen, today)).toBe(BIRTHDAY_ERROR);
    expect(ageInYears(teen, today)).toBe(17);
  });

  it('accepts someone who is 18 today', () => {
    const adult = `${today.getFullYear() - 18}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(birthdayFieldProblem(adult, today)).toBeNull();
  });
});

describe('Finish Setup validation order', () => {
  it('scrolls to the first missing required field', () => {
    expect(
      firstProfileFinishIssue({ photoCount: 0, firstName: '', birthday: null, gender: null, heightFeet: '', heightInches: '' })?.field
    ).toBe(
      'photos'
    );
    expect(
      firstProfileFinishIssue({
        photoCount: 1,
        firstName: '',
        birthday: '2000-01-01',
        gender: 'Woman',
        heightFeet: '',
        heightInches: '',
      })?.field
    ).toBe('first_name');
  });
});

describe('Build Profile save errors (03c)', () => {
  it('marks the Birthday field when the server refuses the birthday', () => {
    const refused = { code: '23514', message: 'You must be at least 18 years old to use this app.' };
    expect(profileSaveProblem(refused, 'birthday')).toEqual({ field: 'birthday', banner: null });
    expect(BIRTHDAY_ERROR).toMatch(/18 or older/);
  });

  it('shows the connection banner for network problems', () => {
    expect(profileSaveProblem({ message: 'Network request failed' }, 'birthday')).toEqual({ field: null, banner: SAVE_ERROR });
    expect(profileSaveProblem({ message: 'Network request failed' }, 'details').banner).toBe(SAVE_ERROR);
  });

  it("uses the server's own explanation for other rule checks", () => {
    const err = { code: '23514', message: 'Choose up to 5 for Interests.' };
    expect(profileSaveProblem(err, 'details')).toEqual({ field: null, banner: 'Choose up to 5 for Interests.' });
  });

  it('shows Finish Setup server errors even when the code is not 23514', () => {
    const err = {
      code: 'P0001',
      message: 'Profile is not finished. Still needed: at least 1 photo.',
    };
    expect(profileSaveProblem(err, 'finish')).toEqual({
      field: null,
      banner: 'Profile is not finished. Still needed: at least 1 photo.',
    });
  });

  it('shows nothing when there is no error', () => {
    expect(profileSaveProblem(null, 'finish')).toEqual({ field: null, banner: null });
  });
});

describe('height', () => {
  it('converts feet and inches to total inches for the server', () => {
    expect(parseHeightFtIn('5', '9')).toBe(69);
    expect(parseHeightFtIn('', '')).toBeNull();
    expect(parseHeightFtIn('5', '')).toBe(60);
    expect(parseHeightFtIn('', '9')).toBe('invalid');
    expect(parseHeightFtIn('5', '12')).toBe('invalid');
    expect(parseHeightFtIn('9', '0')).toBe('invalid');
  });
});
