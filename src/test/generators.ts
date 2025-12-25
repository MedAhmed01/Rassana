import * as fc from 'fast-check';

/**
 * Generator for valid usernames (alphanumeric, 3-50 characters)
 */
export const usernameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,49}$/);

/**
 * Generator for valid passwords (minimum 8 characters with complexity)
 */
export const passwordArb = fc.string({ minLength: 8, maxLength: 50 })
  .filter(s => /[a-z]/.test(s) && /[A-Z]/.test(s) && /[0-9]/.test(s));

/**
 * Generator for simple passwords (for testing, less strict)
 */
export const simplePasswordArb = fc.string({ minLength: 8, maxLength: 30 });

/**
 * Generator for user roles
 */
export const roleArb = fc.constantFrom('admin', 'student') as fc.Arbitrary<'admin' | 'student'>;

/**
 * Generator for future dates (valid expiration)
 * Ensures dates are at least 1 hour in the future
 */
export const futureDateArb = fc.integer({ min: 1, max: 365 }).map(days => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
});

/**
 * Generator for past dates (expired credentials)
 */
export const pastDateArb = fc.integer({ min: 1, max: 365 }).map(days => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
});

/**
 * Generator for valid card IDs (alphanumeric with optional hyphens)
 */
export const cardIdArb = fc.stringMatching(/^[A-Z]{2,4}-[0-9]{3,6}$/);

/**
 * Generator for valid YouTube URLs
 */
export const youtubeUrlArb = fc.constantFrom(
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ',
  'https://www.youtube.com/watch?v=abc123XYZ',
  'https://youtube.com/watch?v=test12345'
).chain(base => 
  fc.string({ minLength: 11, maxLength: 11 }).map(id => 
    `https://www.youtube.com/watch?v=${id.replace(/[^a-zA-Z0-9_-]/g, 'x')}`
  )
);

/**
 * Generator for card subjects
 */
export const subjectArb = fc.constantFrom('physics', 'math') as fc.Arbitrary<'physics' | 'math'>;

/**
 * Generator for card titles
 */
export const cardTitleArb = fc.string({ minLength: 5, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Generator for user credentials
 */
export const userCredentialsArb = fc.record({
  username: usernameArb,
  password: simplePasswordArb,
  role: roleArb,
  expires_at: futureDateArb,
});

/**
 * Generator for expired user credentials
 */
export const expiredUserCredentialsArb = fc.record({
  username: usernameArb,
  password: simplePasswordArb,
  role: roleArb,
  expires_at: pastDateArb,
});

/**
 * Generator for card create requests
 */
export const cardCreateRequestArb = fc.record({
  card_id: cardIdArb,
  video_url: youtubeUrlArb,
  title: fc.option(cardTitleArb, { nil: undefined }),
  subject: fc.option(subjectArb, { nil: undefined }),
});

/**
 * Generator for UUIDs
 */
export const uuidArb = fc.uuid();

/**
 * Generator for timestamps
 */
export const timestampArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
}).map(d => d.toISOString());
