import Qpass from "./index.js";

// job creator
const createJob =
    (id, duration, shouldFail = false) =>
    () => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (shouldFail) {
                    reject(new Error(`Job ${id} failed`));
                } else {
                    resolve(`Job ${id} completed`);
                }
            }, duration);
        });
    };

// test code
console.log("🚀 Qpass test started\n");

const onProgress = ({ batchToProcess, itemsToProcess, completed }) => {
    console.log(`Remaining batches: ${batchToProcess}`);
    console.log(`Remaining jobs: ${itemsToProcess}`);
    if(itemsToProcess === 4) {
        console.log("Terminating the queue...");
        queue.terminate();
    }
    console.log(
        "Completed:",
        completed.map((r) => (r instanceof Error ? `Error: ${r.message}` : r))
    );

    console.log("---");

    if (itemsToProcess === 0) {
        console.log("🚀 Qpass test completed");
    }
};

const queue = new Qpass({
    breakWhenError: false,
    batchSize: 3,
    onProgress: onProgress,
});

for (let i = 1; i <= 14; i++) {
    queue.add(createJob(i, 800, i % 3 === 0)); // multiples of 3 will fail
}