declare const __QPASS_VERSION__: string;

const QPASS_VERSION =
    typeof __QPASS_VERSION__ === "string" ? __QPASS_VERSION__ : "0.0.0";

class Qpass {
    version = QPASS_VERSION; // version info

    private items: (() => Promise<any>)[] = []; // job queue
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

    // add jobs to the queue at once
    add(jobs: (() => Promise<any>)[] | (() => Promise<any>)) {
        // check if jobs is an array, if not convert to array
        const jobsArray = Array.isArray(jobs) ? jobs : [jobs];

        // check if each job is a function, if so add to queue
        for (const job of jobsArray) {
            if (typeof job !== "function") {
                throw new Error(
                    "Each job must be a function that returns a Promise"
                );
            }
            this.items.push(job);
        }

        this.processNext();
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

        jobsToRun.forEach((job, index) => {
            Promise.resolve()
                .then(() => job())
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
