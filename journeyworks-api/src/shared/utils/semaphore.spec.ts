import { Semaphore } from './semaphore';

describe('Semaphore', () => {
  it('should throw if maxConcurrency < 1', () => {
    expect(() => new Semaphore(0)).toThrow(
      'Semaphore maxConcurrency must be >= 1',
    );
    expect(() => new Semaphore(-1)).toThrow(
      'Semaphore maxConcurrency must be >= 1',
    );
  });

  it('should allow a single task to run immediately', async () => {
    const sem = new Semaphore(1);
    const result = await sem.run(async () => 42);
    expect(result).toBe(42);
  });

  it('should report activeCount and pendingCount correctly', async () => {
    const sem = new Semaphore(2);
    expect(sem.activeCount).toBe(0);
    expect(sem.pendingCount).toBe(0);

    // Create resolvers so we can control when tasks finish
    const resolvers: Array<() => void> = [];

    const makeTask = () =>
      sem.run(
        () =>
          new Promise<void>((resolve) => {
            resolvers.push(resolve);
          }),
      );

    const p1 = makeTask();
    const p2 = makeTask();

    // Allow microtask to execute so the fn callbacks register resolvers
    await new Promise((r) => setTimeout(r, 0));

    const p3 = makeTask();

    // Allow microtask queue to settle
    await new Promise((r) => setTimeout(r, 0));

    // 2 running, 1 queued
    expect(sem.activeCount).toBe(2);
    expect(sem.pendingCount).toBe(1);

    // Release one slot — p3 should pick it up
    resolvers[0]();
    await p1;

    // Allow microtask to process
    await new Promise((r) => setTimeout(r, 0));

    expect(sem.activeCount).toBe(2);
    expect(sem.pendingCount).toBe(0);

    resolvers[1]();
    resolvers[2]();
    await Promise.all([p2, p3]);

    expect(sem.activeCount).toBe(0);
    expect(sem.pendingCount).toBe(0);
  });

  it('should limit concurrency to maxConcurrency', async () => {
    const sem = new Semaphore(2);
    let maxConcurrent = 0;
    let current = 0;

    const task = async (delay: number) => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise((r) => setTimeout(r, delay));
      current--;
      return delay;
    };

    const results = await Promise.all([
      sem.run(() => task(50)),
      sem.run(() => task(50)),
      sem.run(() => task(50)),
      sem.run(() => task(50)),
    ]);

    expect(maxConcurrent).toBe(2);
    expect(results).toEqual([50, 50, 50, 50]);
  });

  it('should re-throw errors from fn and release the slot', async () => {
    const sem = new Semaphore(1);

    await expect(
      sem.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // Slot should be released even after failure
    expect(sem.activeCount).toBe(0);

    // Another task should succeed
    const result = await sem.run(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('should execute tasks in FIFO order', async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    const tasks = [1, 2, 3, 4].map((n) =>
      sem.run(async () => {
        order.push(n);
        await new Promise((r) => setTimeout(r, 10));
      }),
    );

    await Promise.all(tasks);
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('should handle high concurrency safely', async () => {
    const sem = new Semaphore(5);
    let maxConcurrent = 0;
    let current = 0;

    const tasks = Array.from({ length: 20 }, (_, i) =>
      sem.run(async () => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await new Promise((r) => setTimeout(r, Math.random() * 20));
        current--;
        return i;
      }),
    );

    const results = await Promise.all(tasks);

    expect(maxConcurrent).toBeLessThanOrEqual(5);
    expect(results).toHaveLength(20);
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
});
