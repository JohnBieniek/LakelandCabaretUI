import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config, validateContent, validateFields } from './validate-content.mjs';

test('all content and local images satisfy the CMS schema', validateContent);
test('invalid contact details and missing photos fail before publication', () => {
  assert.throws(
    () => validateFields([{ name: 'email', type: 'string' }], { email: 'bad email' }),
    /invalid email/,
  );
  assert.throws(
    () =>
      validateFields([{ name: 'photo', type: 'image' }], { photo: '/images/missing-photo.png' }),
    /image must exist/,
  );
  assert.throws(
    () =>
      validateFields([{ name: 'photo', type: 'image' }], { photo: '/images/../../package.json' }),
    /image must exist/,
  );
});
test('photo slot counts cannot break the slideshow timing', () => {
  const field = config.content.find((entry) => entry.name === 'photos').fields[0];
  assert.throws(() => validateFields([field], { dj: [] }), /expected 10/);
});
test('optional empty content and new FAQ entries are supported', () => {
  const fields = config.content.find((entry) => entry.name === 'faqs').fields;
  validateFields(fields, { heading: 'Questions', items: [] });
  validateFields(fields, {
    heading: 'Questions',
    items: [{ question: 'Where?', answer: 'Mid-Michigan' }],
  });
  assert.throws(
    () => validateFields(fields, { heading: 'Questions', items: [{ question: 'Where?' }] }),
    /answer: required/,
  );
});
