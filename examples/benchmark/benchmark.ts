import { ComfyApiClient, ComfyExecutingEvent, ComfyExecutionErrorEvent, ComfyExecutionSuccessEvent, ComfyProgressEvent } from "../../comfy-api-client";
import { ComfyGraph } from "../../comfy-graph";
import { Deferred } from "../../deferred";
import { createGraph, createSets, WAN21_14B_Tunables } from "./wan14b";

// This is a huge WIP - do not rely on anything here!

const host = 'localhost:8188'

// Connect to the server

const client = new ComfyApiClient(host)

const sets = createSets({
    latentDim: [[640, 368], [832, 480], [1024, 608], [1280, 720]],
    latentLength: [1, 17, 33, 49, 65, 81, 97, 113],
    steps: [5]
})

async function run(set: WAN21_14B_Tunables): Promise<number[]> {
    const graph = createGraph(set)
    const prompt = graph.toApiPrompt()
    const deferred = new Deferred<undefined>()

    let timestamps: number[] = []

    const progressListener = (event: ComfyProgressEvent) => {
        if (event.promptId !== resp.promptId) {
            return
        }
        if (event.node !== 'Sampler') {
            return
        }
        timestamps.push(Date.now())
    }

    const executingListener = (event: ComfyExecutingEvent) => {
        if (event.promptId !== resp.promptId) {
            return
        }
        if (event.node !== 'Sampler') {
            return
        }
        timestamps.push(Date.now())
    }

    const doneListener = (event: ComfyExecutionSuccessEvent) => {
        if (event.promptId !== resp.promptId) {
            return
        }
        deferred.resolve(undefined)
    }

    const errorListener = (event: ComfyExecutionErrorEvent) => {
        if (event.promptId !== resp.promptId) {
            return
        }
        timestamps.push(Date.now())
        deferred.reject(event)
    }

    const resp = await client.queuePrompt(prompt)
    client.addEventListener('progress', progressListener)
    client.addEventListener('executing', executingListener)
    client.addEventListener('executionsuccess', doneListener)
    client.addEventListener('executionerror', errorListener)

    await deferred.promise

    client.removeEventListener('progress', progressListener)
    client.removeEventListener('executing', executingListener)
    client.removeEventListener('executionsuccess', doneListener)
    client.removeEventListener('executionerror', errorListener)

    const dts: number[] = []
    for (let idx = 0; idx < timestamps.length - 1; idx++) {
        dts.push(timestamps[idx + 1] - timestamps[idx])
    }

    return dts
}

for (const set of sets) {
    console.log(JSON.stringify(set))

    const copy = { ...set }
    copy.steps = 1
    copy.seed = Date.now()
    await run(copy)

    set.seed = 2
    const result = await run(set)
    console.log(result)
}