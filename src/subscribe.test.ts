import { subscribe } from './subscribe';
import { type Trigger } from './types';
import { setTimeout } from 'node:timers';
import * as sinon from 'sinon';
import { expect, it } from 'vitest';

const defaultTrigger = {
  expression: ['match', 'foo', 'basename'],
  id: 'foo',
  initialRun: true,
  interruptible: false,
  name: 'foo',
  onChange: async () => {},
  onTeardown: async () => {},
  persistent: false,
  relativePath: 'foo',
  retry: {
    retries: 0,
  },
  throttleOutput: {
    delay: 0,
  },
  watch: 'foo',
} as Trigger;

const wait = (time: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};

it('evaluates onChange', async () => {
  const trigger = {
    ...defaultTrigger,
  } as Trigger;

  const subscriptionMock = sinon.mock(trigger);

  const onChange = subscriptionMock.expects('onChange').once().resolves(null);

  const subscription = subscribe(trigger);

  subscription.trigger([]);

  expect(subscriptionMock.verify());

  expect(onChange.args[0][0].taskId).toMatch(/^[a-z\d]{8}$/u);
});

it('swallow onChange errors', async () => {
  const trigger = {
    ...defaultTrigger,
  } as Trigger;

  const subscriptionMock = sinon.mock(trigger);

  subscriptionMock.expects('onChange').once().rejects(new Error('foo'));

  const subscription = subscribe(trigger);

  await subscription.trigger([]);

  expect(subscriptionMock.verify());
});

it('removes duplicates', async () => {
  const trigger = {
    ...defaultTrigger,
  };

  const subscriptionMock = sinon.mock(trigger);

  const onChange = subscriptionMock.expects('onChange').once().resolves(null);

  const subscription = subscribe(trigger);

  subscription.trigger([
    {
      filename: '/foo',
    },
    {
      filename: '/foo',
    },
    {
      filename: '/bar',
    },
  ]);

  expect(subscriptionMock.verify());

  expect(onChange.args[0][0].files).toEqual([
    { name: '/foo' },
    { name: '/bar' },
  ]);
});

it('waits for onChange to complete when { interruptible: false }', async () => {
  const abortController = new AbortController();

  const trigger = {
    ...defaultTrigger,
    abortSignal: abortController.signal,
    interruptible: false,
  };

  const triggerMock = sinon.mock(trigger);

  const onChange = triggerMock.expects('onChange').twice();

  let completed = false;

  onChange.onFirstCall().callsFake(async () => {
    await wait(100);

    completed = true;
  });

  onChange.onSecondCall().callsFake(() => {
    expect(completed).toBe(true);

    abortController.abort();
  });

  const subscription = subscribe(trigger);

  await subscription.trigger([]);
  await subscription.trigger([]);

  expect(onChange.callCount).toBe(2);
});

it('waits for onChange to complete when { interruptible: true } when it receives a shutdown signal', async () => {
  const abortController = new AbortController();

  const trigger = {
    ...defaultTrigger,
    abortSignal: abortController.signal,
  };

  let resolved = false;

  const subscriptionMock = sinon.mock(trigger);

  subscriptionMock
    .expects('onChange')
    .once()
    .callsFake(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolved = true;

          resolve(null);
        }, 100);
      });
    });

  const subscription = subscribe(trigger);

  setImmediate(() => {
    abortController.abort();
  });

  await subscription.trigger([]);

  expect(subscriptionMock.verify());

  expect(resolved).toBe(true);
});

it('retries failing routines', async () => {
  const trigger = {
    ...defaultTrigger,
    retry: {
      retries: 1,
    },
  };

  const subscriptionMock = sinon.mock(trigger);

  const onChange = subscriptionMock.expects('onChange').twice();

  onChange.onFirstCall().rejects(new Error('foo'));
  onChange.onSecondCall().resolves(null);

  const subscription = await subscribe(trigger);

  await subscription.trigger([]);

  expect(onChange.verify());
});

it('reports { first: true } only for the first event', async () => {
  const trigger = {
    ...defaultTrigger,
  };

  const subscriptionMock = sinon.mock(trigger);

  const onChange = subscriptionMock.expects('onChange').twice();

  onChange.onFirstCall().resolves(null);

  onChange.onSecondCall().resolves(null);

  const subscription = subscribe(trigger);

  await subscription.trigger([]);
  await subscription.trigger([]);

  expect(onChange.args).toMatchObject([
    [
      {
        first: true,
      },
    ],
    [
      {
        first: false,
      },
    ],
  ]);

  expect(subscriptionMock.verify());
});
