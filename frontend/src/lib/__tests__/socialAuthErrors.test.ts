import { isCancellationError } from '../socialAuthErrors';

// Getting this wrong is not subtle: every user who backs out of the Google or
// Apple sheet would be shown a "sign-in failed" alert.
describe('isCancellationError', () => {
  const GOOGLE_CANCEL = 'SIGN_IN_CANCELLED';

  it.each([
    ['the Google SDK cancel code', GOOGLE_CANCEL],
    ['the Apple sheet dismissal', 'ERR_REQUEST_CANCELED'],
    ['the alternate Apple cancel code', 'ERR_CANCELED'],
  ])('treats %s as a cancellation', (_label, code) => {
    expect(isCancellationError({ code }, GOOGLE_CANCEL)).toBe(true);
  });

  it.each([
    ['a network failure', { code: 'ERR_NETWORK' }],
    ['Play Services missing', { code: 'PLAY_SERVICES_NOT_AVAILABLE' }],
    ['a plain Error', new Error('boom')],
    ['a missing token', { message: 'Google did not return an ID token' }],
  ])('does not swallow %s', (_label, error) => {
    expect(isCancellationError(error, GOOGLE_CANCEL)).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'ERR_CANCELED'],
    ['a numeric code', { code: 12501 }],
  ])('handles %s without throwing', (_label, error) => {
    expect(isCancellationError(error, GOOGLE_CANCEL)).toBe(false);
  });

  // The Google code is passed in rather than imported, so it must not be
  // assumed present -- Apple-only flows call this with nothing.
  it('still recognises Apple cancels when no Google code is supplied', () => {
    expect(isCancellationError({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(isCancellationError({ code: GOOGLE_CANCEL })).toBe(false);
  });
});
