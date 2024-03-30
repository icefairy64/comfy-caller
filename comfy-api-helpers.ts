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

export async function getObjectInputValues(api: ComfyApiClient, object: string, input: string) {
    const info = await api.getObjectInfo(),
        objectInfo = info[object].inputs.required[input]

    if (!('values' in objectInfo) || objectInfo.values.length === 0) {
        throw new Error('No values available')
    }

    return objectInfo.values
}

export function getCheckpoints(api: ComfyApiClient) {
    return getObjectInputValues(api, 'CheckpointLoaderSimple', 'ckpt_name')
}

export function getLoras(api: ComfyApiClient) {
    return getObjectInputValues(api, 'LoraLoader', 'lora_name')
}