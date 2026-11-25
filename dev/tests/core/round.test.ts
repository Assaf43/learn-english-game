import { expect, test } from 'vitest';
import { RoundTracker } from '../../src/core/round';

test('RoundTracker: first-try, reveal on second wrong, double correct ignored', () => {
  const r = new RoundTracker(['a', 'b']);
  expect(r.answer(false)).toEqual({ wrongCount: 1, reveal: false });
  expect(r.answer(false)).toEqual({ wrongCount: 2, reveal: true });
  r.answer(true); r.answer(true);
  expect(r.next()).toBe(true);
  r.answer(true);
  expect(r.next()).toBe(false);
  expect(r.items()).toEqual([{ wordId: 'a', firstTry: false }, { wordId: 'b', firstTry: true }]);
});

test('a wrong tap after the correct answer is ignored', () => {
  const r = new RoundTracker(['a']);
  r.answer(true);
  expect(r.answer(false)).toEqual({ wrongCount: 0, reveal: false });
  expect(r.items()).toEqual([{ wordId: 'a', firstTry: true }]);
  expect(r.firstTryCount()).toBe(1);
});

test('currentId and position follow next()', () => {
  const r = new RoundTracker(['a', 'b', 'c']);
  expect(r.currentId()).toBe('a');
  expect(r.position()).toEqual({ index: 0, total: 3 });
  r.answer(true);
  r.next();
  expect(r.currentId()).toBe('b');
  expect(r.position()).toEqual({ index: 1, total: 3 });
});

test('requeueCurrent appends the id once and keeps total', () => {
  const r = new RoundTracker(['a', 'b']);
  r.answer(false);
  r.requeueCurrent();
  r.requeueCurrent();
  r.answer(true);
  expect(r.next()).toBe(true);
  expect(r.currentId()).toBe('b');
  r.answer(true);
  expect(r.next()).toBe(true);
  expect(r.currentId()).toBe('a');
  expect(r.position()).toEqual({ index: 1, total: 2 });
  r.requeueCurrent();
  expect(r.answer(true)).toEqual({ wrongCount: 0, reveal: false });
  expect(r.next()).toBe(false);
  expect(r.items()).toEqual([{ wordId: 'a', firstTry: false }, { wordId: 'b', firstTry: true }]);
  expect(r.firstTryCount()).toBe(1);
});

test('an item never answered correctly is not first-try', () => {
  const r = new RoundTracker(['a', 'b']);
  r.next();
  r.answer(true);
  expect(r.items()).toEqual([{ wordId: 'a', firstTry: false }, { wordId: 'b', firstTry: true }]);
});

test('answers after the round is over are ignored', () => {
  const r = new RoundTracker(['a']);
  r.answer(true);
  expect(r.next()).toBe(false);
  expect(r.next()).toBe(false);
  r.answer(false);
  expect(r.currentId()).toBe('a');
  expect(r.firstTryCount()).toBe(1);
});
