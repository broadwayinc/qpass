# Qpass

Qpass is a lightweight promise-job queue for JavaScript/TypeScript.
It runs jobs in cycles with configurable parallelism (`batchSize`) and reports progress after each cycle.

## Install

```bash
npm install qpass
```

## Quick start

```js
import Qpass from "qpass";

const queue = new Qpass({
    batchSize: 3,
    onProgress: ({ batchToProcess, itemsToProcess, completed }) => {
        console.log({ batchToProcess, itemsToProcess, completed });
    },
});

const jobs = [
    () => Promise.resolve("A"),
    () => Promise.resolve("B"),
    () => Promise.resolve("C"),
    () => Promise.resolve("D"),
];

queue.add(jobs);
```

## API

### `new Qpass(options?)`

```ts
new Qpass({
    breakWhenError?: boolean;
    batchSize?: number; // >= 1, default: 1
    onProgress?: (progress: {
        batchToProcess: number;
        itemsToProcess: number;
        completed: any[];
    }) => void;
})
```

#### Options

- `batchSize` (default `1`): number of jobs to run in parallel per cycle.
- `breakWhenError` (default `false`): when `true`, queued jobs are cleared after an error is seen.
- `onProgress`: called after each cycle finishes.

### `add(jobs)`

```ts
add(jobs: (() => Promise<any>)[] | (() => Promise<any>)): void
```

- Adds one or many jobs to the queue.
- Starts processing automatically.
- `add` is not `async` and does not return a promise.

### `terminate()`

```ts
terminate(): void
```

- Clears all queued (not-yet-started) jobs.
- Already running jobs continue until they settle.

## Progress callback behavior

`onProgress` receives:

- `completed`: results (or errors) from the cycle that just finished.
- `itemsToProcess`: queued jobs still waiting to start.
- `batchToProcess`: `Math.ceil(itemsToProcess / batchSize)`.

Notes:

- Progress is reported per cycle, not per individual job completion.
- If you call `add` repeatedly (for example, inside a loop), the first cycle may be smaller than `batchSize` because processing starts immediately.

## Error handling

### Continue on error (`breakWhenError: false`)

```js
const queue = new Qpass({
    breakWhenError: false,
    batchSize: 2,
    onProgress: ({ completed }) => {
        console.log(
            completed.map((x) => (x instanceof Error ? `Error: ${x.message}` : x))
        );
    },
});

queue.add([
    () => Promise.resolve("ok-1"),
    () => Promise.reject(new Error("failed-2")),
    () => Promise.resolve("ok-3"),
]);
```

### Stop queueing after error (`breakWhenError: true`)

```js
const queue = new Qpass({
    breakWhenError: true,
    batchSize: 3,
    onProgress: ({ itemsToProcess, completed }) => {
        console.log({ itemsToProcess, completed });
    },
});

queue.add([
    () => Promise.resolve("ok-1"),
    () => Promise.reject(new Error("failed-2")),
    () => Promise.resolve("ok-3"),
    () => Promise.resolve("queued-but-may-be-cleared"),
]);
```

With `breakWhenError: true`, Qpass clears jobs still waiting in the queue after an error is observed. Jobs already running in the same cycle still settle.

## Practical pattern: queue all jobs at once

If you want predictable `itemsToProcess` values in `onProgress`, build the job array first and call `add` once:

```js
const jobs = [];

for (let i = 1; i <= 14; i++) {
    jobs.push(() => Promise.resolve(`Job ${i}`));
}

queue.add(jobs);
```

## License

ISC