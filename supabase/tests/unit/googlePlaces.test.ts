import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coordinatesFromPlaceDetails, formatGooglePrediction } from '../../functions/_shared/googlePlaces.ts';

test('formatGooglePrediction builds City, ST from structured text', () => {
  assert.equal(
    formatGooglePrediction({
      structuredFormat: {
        mainText: { text: 'Brooklyn' },
        secondaryText: { text: 'NY, USA' },
      },
      types: ['sublocality', 'political'],
    }),
    'Brooklyn, NY'
  );
  assert.equal(
    formatGooglePrediction({
      structuredFormat: {
        mainText: { text: 'Brooklyn' },
        secondaryText: { text: 'New York, NY, USA' },
      },
      types: ['sublocality_level_1', 'political'],
    }),
    'Brooklyn, NY'
  );
  assert.equal(
    formatGooglePrediction({
      structuredFormat: {
        mainText: { text: 'Boston' },
        secondaryText: { text: 'Massachusetts, USA' },
      },
      types: ['locality'],
    }),
    'Boston, MA'
  );
  assert.equal(
    formatGooglePrediction({
      text: { text: 'Austin, TX, USA' },
      types: ['locality'],
    }),
    'Austin, TX'
  );
  assert.equal(
    formatGooglePrediction({
      structuredFormat: { mainText: { text: 'I-95' }, secondaryText: { text: 'USA' } },
      types: ['route'],
    }),
    null
  );
});

test('coordinatesFromPlaceDetails keep US lat/lng and drop other countries', () => {
  assert.deepEqual(
    coordinatesFromPlaceDetails({
      location: { latitude: 40.65, longitude: -73.95 },
      addressComponents: [{ shortText: 'US', types: ['country'] }],
    }),
    { latitude: 40.65, longitude: -73.95 }
  );
  assert.equal(
    coordinatesFromPlaceDetails({
      location: { latitude: 43.65, longitude: -79.38 },
      addressComponents: [{ shortText: 'CA', types: ['country'] }],
    }),
    null
  );
  assert.equal(coordinatesFromPlaceDetails({ location: {} }), null);
});
