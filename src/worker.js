/**
 * Module worker that runs the analysis off the main thread, so a runaway pattern
 * cannot freeze the page: the runner (runner.js) stops this worker after 500 ms.
 */
import { READY_MESSAGE, respond } from './runner.js';

self.onmessage = (event) => self.postMessage(respond(event.data));
self.postMessage(READY_MESSAGE);
