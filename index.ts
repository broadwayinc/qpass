declare const __QPASS_VERSION__: string;

const QPASS_VERSION =
    typeof __QPASS_VERSION__ === "string" ? __QPASS_VERSION__ : "0.0.0";

class Qpass {
    version = QPASS_VERSION; // version info

    private items: { id: string; job: () => Promise<any> }[] = []; // job queue
    private nextJobId: number = 1; // auto-generated job id
    private breakWhenError: boolean = false; // whether to stop on error
    private batchSize: number = 1; // number of jobs to process at once
    private onProgress?: (progress: {
        batchToProcess: number; // remaining batch count
        itemsToProcess: number; // remaining job count
        completed: any[]; // completed job results array
    }) => void; // progress callback

    private activeCount: number = 0; // number of jobs currently running
    private currentCycleCompleted: any[] = []; // completed results for current cycle
    private stopProcessing: boolean = false; // stop scheduling new jobs when true

    private get batchToProcess() {
        // calculate total batch count
        return Math.ceil(this.items.length / this.batchSize);
    }

    constructor(option?: {
        breakWhenError?: boolean;
        onProgress?: (progress: {
            batchToProcess: number;
            itemsToProcess: number;
            completed: any[];
        }) => void;
        batchSize?: number; // must be at least 1, default is 1
    }) {
        this.breakWhenError = !!option?.breakWhenError;
        this.batchSize = option?.batchSize ?? 1;

        if (typeof this.batchSize !== "number" || this.batchSize < 1) {
            throw new Error("batchSize must be at least 1");
        }

        if (option?.onProgress) {
            if (typeof option.onProgress === "function") {
                this.onProgress = option.onProgress;
            } else {
                throw new Error("onProgress must be a function");
            }
        }
    }

    // add jobs to the queue at once. now returns job id.
    add(jobs: (() => Promise<any>)[] | (() => Promise<any>)): string[] {
        // check if jobs is an array, if not convert to array
        const jobsArray = Array.isArray(jobs) ? jobs : [jobs];
        const addedIds: string[] = [];

        // check if each job is a function, if so add to queue
        for (const job of jobsArray) {
            if (typeof job !== "function") {
                throw new Error(
                    "Each job must be a function that returns a Promise"
                );
            }

            const id = String(this.nextJobId++);
            this.items.push({ id, job });
            addedIds.push(id);
        }

        this.processNext();
        return addedIds;
    }

    // change the number of jobs processed per batch
    setBatchSize(size: number) {
        if (typeof size !== "number" || size < 1) {
            throw new Error("batchSize must be at least 1");
        }
        this.batchSize = size;
    }

    // remove a queued job by id
    remove(id: string | number) {
        const jobId = String(id);
        const index = this.items.findIndex((item) => item.id === jobId);

        if (index === -1) {
            return false;
        }

        this.items.splice(index, 1);
        return true;
    }

    // process next batch of jobs
    private processNext() {
        // exit if queue is empty, processing is stopped, or a cycle is still running
        if (
            this.stopProcessing ||
            this.items.length === 0 ||
            this.activeCount > 0
        ) {
            return;
        }

        const jobsToRun = this.items.splice(0, this.batchSize);
        this.activeCount = jobsToRun.length;
        this.currentCycleCompleted = new Array(jobsToRun.length);

        jobsToRun.forEach((item, index) => {
            Promise.resolve()
                .then(() => item.job())
                .then((result) => {
                    this.finalizeJob(index, result, false);
                    return result;
                })
                .catch((err) => {
                    this.finalizeJob(index, err, true);
                    return err;
                });
        });
    }

    private finalizeJob(index: number, value: any, isError: boolean) {
        this.currentCycleCompleted[index] = value;
        this.activeCount -= 1;

        if (isError && this.breakWhenError) {
            this.stopProcessing = true;
            this.items = [];
        }

        if (this.activeCount !== 0) {
            return;
        }

        const completed = this.currentCycleCompleted.slice();
        this.currentCycleCompleted = [];

        if (this.onProgress) {
            this.onProgress({
                batchToProcess: this.batchToProcess,
                itemsToProcess: this.items.length,
                completed: completed,
            });
        }

        this.processNext();
    }

    terminate() {
        // remove all remaining jobs from queue
        this.items = [];
    }
}

export default Qpass;
