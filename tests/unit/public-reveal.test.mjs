import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from '../helpers/loadTypeScript.mjs';

for (const reduced of [false, true]) test(`section reveals are stationary, bounded and reduced-motion safe (${reduced})`, () => {
  const { FadeUp } = loadTypeScript('components/Reveal.tsx', {
    'framer-motion': { motion: { article: 'article', div: 'div', form: 'form', h2: 'h2', ol: 'ol', p: 'p', ul: 'ul' }, useReducedMotion: () => reduced },
  });
  const submit = () => {};
  for (const as of ['article', 'div', 'form']) {
    const element = FadeUp({ as, children: 'Original content', delay: 5, onSubmit: submit });
    assert.equal(element.type, as);
    assert.equal(element.props.children, 'Original content');
    assert.deepEqual(element.props.initial, reduced ? false : { opacity: 0 });
    assert.deepEqual(element.props.whileInView, { opacity: 1 });
    assert.deepEqual(element.props.viewport, { once: true, amount: .12 });
    assert.equal(element.props.transition.duration, reduced ? 0 : .45);
    assert.equal(element.props.transition.delay, reduced ? 0 : .18);
    if (as === 'form') assert.equal(element.props.onSubmit, submit);
  }
});
