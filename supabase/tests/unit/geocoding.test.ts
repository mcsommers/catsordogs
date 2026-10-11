import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatLocationLabel, locationSuggestions, usStateAbbreviation } from '../../functions/_shared/geocoding.ts';

test('formatLocationLabel builds City, ST for US places', () => {
  assert.equal(
    formatLocationLabel({
      name: 'Brooklyn',
      latitude: 0,
      longitude: 0,
      country_code: 'US',
      admin1: 'New York',
    }),
    'Brooklyn, NY'
  );
  assert.equal(
    formatLocationLabel({
      name: 'Toronto',
      latitude: 0,
      longitude: 0,
      country_code: 'CA',
      admin1: 'Ontario',
    }),
    null
  );
});

test('usStateAbbreviation accepts full names and existing abbreviations', () => {
  assert.equal(usStateAbbreviation('Massachusetts'), 'MA');
  assert.equal(usStateAbbreviation('MA'), 'MA');
});

test('locationSuggestions dedupes and caps', () => {
  const hits = [
    { name: 'Portland', latitude: 0, longitude: 0, country_code: 'US', admin1: 'Oregon' },
    { name: 'Portland', latitude: 0, longitude: 0, country_code: 'US', admin1: 'Maine' },
    { name: 'Portland', latitude: 0, longitude: 0, country_code: 'US', admin1: 'Oregon' },
  ];
  assert.deepEqual(locationSuggestions(hits, 5), ['Portland, OR', 'Portland, ME']);
});
