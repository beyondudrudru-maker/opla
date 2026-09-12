/**
 * utils/requestQueue.js
 * 
 * A lightweight concurrency manager to prevent API rate limits and 
 * RAM crashes during heavy chat spam.
 */

class RequestQueue {
    constructor(concurrencyLimit = 2) {
        this.queue = [];
        this.activeCount = 0;
        this.concurrencyLimit = concurrencyLimit;
    }

    async enqueue(taskFunction) {
        return new Promise((resolve, reject) => {
            this.queue.push({ taskFunction, resolve, reject });
            this.processNext();
        });
    }

    async processNext() {
        // Stop if we hit the concurrency limit or the queue is empty
        if (this.activeCount >= this.concurrencyLimit || this.queue.length === 0) {
            return;
        }

        this.activeCount++;
        const { taskFunction, resolve, reject } = this.queue.shift();

        try {
            const result = await taskFunction();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.activeCount--;
            // Trigger the next item in line once the current one finishes
            this.processNext(); 
        }
    }
}

// Export a single, global instance so the whole app shares one queue
module.exports = new RequestQueue();
