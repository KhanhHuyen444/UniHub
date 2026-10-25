import assert from 'node:assert/strict';
import test from 'node:test';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import nesting from 'tailwindcss/nesting/index.js';

async function compile(raw, css = '@tailwind utilities;', options = {}) {
  const result = await postcss([
    nesting(),
    tailwindcss({
      content: [{ raw, extension: 'html' }],
      corePlugins: { preflight: false },
      ...options,
    }),
  ]).process(css, { from: undefined });
  assert.deepEqual(result.warnings(), []);
  return result.root;
}

function declaration(root, selector, property) {
  const values = [];
  root.walkRules((rule) => {
    if (rule.selectors.includes(selector)) {
      rule.walkDecls(property, (decl) => values.push(decl.value));
    }
  });
  assert.ok(values.length > 0, `Missing ${property} for ${selector}`);
  return values;
}

test('Tailwind preserves responsive, group, peer and arbitrary selectors', async () => {
  const root = await compile(
    'md:hover:block group-hover:block peer-checked:block [&>span]:block data-[state=open]:block w-[37px]',
  );
  for (const selector of [
    String.raw`.md\:hover\:block:hover`,
    String.raw`.group:hover .group-hover\:block`,
    String.raw`.peer:checked ~ .peer-checked\:block`,
    String.raw`.\[\&\>span\]\:block>span`,
    String.raw`.data-\[state\=open\]\:block[data-state="open"]`,
  ]) {
    assert.deepEqual(declaration(root, selector, 'display'), ['block']);
  }
  assert.deepEqual(declaration(root, String.raw`.w-\[37px\]`, 'width'), [
    '37px',
  ]);
  let responsive = false;
  root.walkAtRules('media', (rule) => {
    if (rule.params === '(min-width: 768px)') {
      responsive = rule
        .toString()
        .includes(String.raw`.md\:hover\:block:hover`);
    }
  });
  assert.ok(responsive);
});

test('Tailwind nesting dependency preserves grouped selectors and @apply', async () => {
  const root = await compile(
    'card panel block',
    `.card, .panel {
      @apply p-4;
      &:hover { @apply block; }
      &[data-open="yes"] > span { @apply font-bold; }
    }`,
  );
  for (const base of ['.card', '.panel']) {
    assert.deepEqual(declaration(root, base, 'padding'), ['1rem']);
    assert.deepEqual(declaration(root, `${base}:hover`, 'display'), ['block']);
    assert.deepEqual(
      declaration(root, `${base}[data-open="yes"] > span`, 'font-weight'),
      ['700'],
    );
  }
  root.walkAtRules('apply', () => assert.fail('@apply must be expanded'));
});

test('Tailwind prefix and important selector keep variant declarations', async () => {
  const root = await compile(
    'tw-block hover:tw-block',
    '@tailwind utilities;',
    {
      prefix: 'tw-',
      important: '#app',
    },
  );
  assert.deepEqual(declaration(root, '#app .tw-block', 'display'), ['block']);
  assert.deepEqual(
    declaration(root, String.raw`#app .hover\:tw-block:hover`, 'display'),
    ['block'],
  );
});
