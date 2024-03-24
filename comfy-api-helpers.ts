import type { ComfyApiClient, ComfyExecutingEvent, ComfyImageDataEvent } from './comfy-api-client.ts'
import { Deferred } from './deferred.ts'

export async function promptForImage(api: ComfyApiClient, prompt: any, imageNodeId: string) {
    const deferred = new Deferred<Blob>()
    let processingNode: string | null = null

    const imageListener = async (ev: ComfyImageDataEvent) => {
        if (processingNode === imageNodeId) {
            deferred.resolve(ev.data)
        }
    }

    const executingListener = (ev: ComfyExecutingEvent) => {
        processingNode = ev.node
    }

    api.addEventListener('imagedata', imageListener)
    api.addEventListener('executing', executingListener)

    await api.queuePrompt(prompt)
    const result = await deferred.promise

    api.removeEventListener('imagedata', imageListener)
    api.removeEventListener('executing', executingListener)

    return result
}