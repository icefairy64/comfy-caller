import { Deferred } from './deferred.ts'

export interface ComfyImageDataEvent {
    type: 'imagedata',
    data: Blob
}

export interface ComfyProgressEvent {
    type: 'progress',
    progress: number,
    progressMax: number,
    promptId: string,
    node: string | null
}

export interface ComfyExecutionStartEvent {
    type: 'executionstart',
    promptId: string
}

export interface ComfyExecutionCachedEvent {
    type: 'executioncached',
    nodes: string[],
    promptId: string
}

export interface ComfyExecutionSuccessEvent {
    type: 'executionsuccess',
    promptId: string
}

export interface ComfyExecutingEvent {
    type: 'executing',
    node: string | null,
    promptId: string
}

export interface ComfyStatusEvent {
    type: 'status',
    queueRemaining: number,
    clientId?: string
}

export type ComfyEvent =
    ComfyImageDataEvent |
    ComfyProgressEvent |
    ComfyExecutionStartEvent |
    ComfyExecutingEvent |
    ComfyExecutionCachedEvent |
    ComfyExecutionSuccessEvent |
    ComfyStatusEvent

export type ComfyEventType = ComfyEvent['type']

type ComfyEventOfType<T> = Extract<ComfyEvent, { type: T }>

export interface ComfyPromptResponse {
    promptId: string,
    number: number,
    nodeErrors: Record<string, string>
}

interface ComfyInputGenericInfo {
    tooltip?: string
}

export type ComfyInputInfo = ({
    type: 'TEXT',
    multiline: boolean
} | {
    type: 'FLOAT',
    defaultValue: number,
    minValue: number,
    maxValue: number,
    step: number,
    round: number
} | {
    type: 'INT',
    defaultValue: number,
    minValue: number,
    maxValue: number,
    step?: number
} | {
    type: 'STRING',
    defaultValue: string
} | {
    type: 'BOOLEAN',
    defaultValue: boolean
} | {
    type: 'MODEL'
} | {
    type: 'VAE'
} | {
    type: 'CONDITIONING'
} | {
    type: 'LATENT'
} | {
    type: 'CLIP'
} | {
    type: 'IMAGE'
} | {
    type: 'MASK'
} | {
    genericType: string
} | {
    values: string[]
}) & ComfyInputGenericInfo

export interface ComfyOutputInfo {
    type: string,
    name: string,
    isList: boolean,
    tooltip?: string
}

export interface ComfyObjectInfo {
    inputs: {
        required: Record<string, ComfyInputInfo>,
        optional?: Record<string, ComfyInputInfo>,
        hidden?: Record<string, ComfyInputInfo>
    }
    outputs: ComfyOutputInfo[],
    name: string,
    displayName: string,
    description: string,
    category: string,
    isOutputNode: boolean
}

export type ComfyObjectInfoResponse = Record<string, ComfyObjectInfo>

export class ComfyApiClient {
    private readonly ws: WebSocket
    private readonly host: string
    private clientId: string = 'unknown'

    private readonly readyDeferred: Deferred<void>
    private readonly eventListeners: Map<ComfyEventType | undefined, Array<(event: any) => void>>

    readonly readyPromise: Promise<void>
    ready: boolean = false

    constructor(host: string, clientId?: string) {
        this.host = host
        this.ws = new WebSocket(`ws://${host}/ws${clientId != null ? '?clientId=' + clientId : ''}`)
        this.eventListeners = new Map()

        this.readyDeferred = new Deferred<void>()
        this.readyPromise = this.readyDeferred.promise

        this.ws.addEventListener('error', ev => {
            this.readyDeferred.reject(ev)
        })

        this.ws.addEventListener('message', ev => this.onMessage(ev))
    }

    close() {
        this.ws.close()
    }

    async queuePrompt(prompt: any): Promise<ComfyPromptResponse> {
        const req = await fetch(`http://${this.host}/prompt`, {
            method: 'POST',
            body: new Blob([JSON.stringify({
                prompt,
                client_id: this.clientId
            })], {
                type: 'application/json'
            })
        })

        if (!req.ok) {
            throw new Error('Failed to enqueue prompt: ' + await req.text())
        }

        const json = await req.json()
        return {
            promptId: json['prompt_id'],
            number: json['number'],
            nodeErrors: json['nodeErrors']
        }
    }

    private onMessage(event: MessageEvent<string | Uint8Array>) {
        if (event.data instanceof Uint8Array) {
            const imageData = event.data.slice(8),
                blob = new Blob([imageData], {
                    type: 'image/png'
                })
            this.fireEvent({
                type: 'imagedata',
                data: blob
            })
        } else {
            const json = JSON.parse(event.data),
                comfyEvent = this.parseEvent(json)
            this.processEvent(comfyEvent)
        }
    }

    private parseEvent(json: any): ComfyEvent {
        const data = json.data
        switch (json['type']) {
            case 'status': return {
                type: 'status',
                queueRemaining: data['status']['exec_info']['queue_remaining'],
                clientId: data['sid']
            }
            case 'progress': return {
                type: 'progress',
                progress: data['value'],
                progressMax: data['max'],
                promptId: data['prompt_id'],
                node: data['node']
            }
            case 'execution_start': return {
                type: 'executionstart',
                promptId: data['prompt_id']
            }
            case 'execution_cached': return {
                type: 'executioncached',
                nodes: data['nodes'],
                promptId: data['prompt_id']
            }
            case 'execution_success': return {
                type: 'executionsuccess',
                promptId: data['prompt_id']
            }
            case 'executing': return {
                type: 'executing',
                node: data['node'],
                promptId: data['prompt_id']
            }
            case 'execution_error': throw new Error(JSON.stringify(data))
            default: throw new Error(`Unknown event type ${json['type']}`)
        }
    }

    private processEvent(event: ComfyEvent) {
        if (event.type === 'status' && event.clientId != null) {
            this.clientId = event.clientId
            if (!this.ready) {
                this.ready = true
                this.readyDeferred.resolve()
            }
        }
        this.fireEvent(event)
    }

    private fireEvent<E extends ComfyEvent>(event: E) {
        const listeners = this.eventListeners.get(event.type)
        if (listeners != null) {
            for (let listener of listeners) {
                listener(event)
            }
        }
    }

    addEventListener<K extends ComfyEventType>(eventType: K, listener: (event: NoInfer<ComfyEventOfType<K>>) => void) {
        if (!this.eventListeners.get(eventType)) {
            this.eventListeners.set(eventType, [])
        }
        this.eventListeners.get(eventType)?.push(listener)
    }

    removeEventListener<K extends ComfyEventType>(eventType: K, listener: (event: NoInfer<ComfyEventOfType<K>>) => void) {
        const listeners = this.eventListeners.get(eventType)
        if (listeners != null) {
            const listenerIndex = listeners.indexOf(listener)
            if (listenerIndex >= 0) {
                listeners.splice(listenerIndex, 1)
            }
        }
    }

    async getObjectInfo(): Promise<ComfyObjectInfoResponse> {
        const req = await fetch(`http://${this.host}/object_info`)

        if (!req.ok) {
            throw new Error('Failed to enqueue prompt: ' + await req.text())
        }

        const data = await req.json()
        return ComfyApiClient.parseObjectInfoResponse(data)
    }

    private static parseObjectInputInfo(info: any[]): ComfyInputInfo {
        const type: string | string[] = info[0],
            data: ComfyInputGenericInfo | undefined = info[1]
        let result

        if (type instanceof Array) {
            result = {
                values: type
            }
        } else if (type === 'TEXT') {
            result = {
                type: 'TEXT',
                multiline: info[1].multiline
            }
        } else if (type === 'FLOAT') {
            result = {
                type: 'FLOAT',
                defaultValue: info[1].default,
                minValue: info[1].min,
                maxValue: info[1].max,
                step: info[1].step,
                round: info[1].round,
            }
        } else if (type === 'INT') {
            result = {
                type: 'INT',
                defaultValue: info[1].default,
                minValue: info[1].min,
                maxValue: info[1].max,
                step: info[1].step
            }
        } else if (type === 'STRING') {
            result = {
                type: 'STRING',
                defaultValue: info[1].default
            }
        } else if (type === 'BOOLEAN') {
            result = {
                type: 'BOOLEAN',
                defaultValue: info[1].default
            }
        } else if (type === 'CONDITIONING') {
            result = {
                type: 'CONDITIONING'
            }
        } else if (type === 'MODEL') {
            result = {
                type: 'MODEL'
            }
        } else if (type === 'LATENT') {
            result = {
                type: 'LATENT'
            }
        } else if (type === 'CLIP') {
            result = {
                type: 'CLIP'
            }
        } else if (type === 'VAE') {
            result = {
                type: 'VAE'
            }
        } else if (type === 'IMAGE') {
            result = {
                type: 'IMAGE'
            }
        } else if (type === 'MASK') {
            result = {
                type: 'MASK'
            }
        } else {
            result = {
                genericType: type
            }
        }

        if (data?.tooltip != null) {
            result.tooltip = data.tooltip
        }
        
        return result
    }

    static parseObjectInfoResponse(data: any): ComfyObjectInfoResponse {
        const result: ComfyObjectInfoResponse = {}

        for (const objectKey in data) {
            const serverInfo = data[objectKey],
                objectInfo: ComfyObjectInfo = {
                    inputs: {
                        required: {}
                    },
                    outputs: [],
                    name: serverInfo.name,
                    category: serverInfo.category,
                    description: serverInfo.description,
                    displayName: serverInfo['display_name'],
                    isOutputNode: serverInfo['output_node']
                }

            result[objectKey] = objectInfo

            if (serverInfo.input.required != null) {
                for (const input in serverInfo.input.required) {
                    objectInfo.inputs.required[input] = ComfyApiClient.parseObjectInputInfo(serverInfo.input.required[input])
                }
            }

            if (serverInfo.input.optional != null) {
                objectInfo.inputs.optional = {}
                for (const input in serverInfo.input.optional) {
                    objectInfo.inputs.optional[input] = ComfyApiClient.parseObjectInputInfo(serverInfo.input.optional[input])
                }
            }

            if (serverInfo.input.hidden != null) {
                objectInfo.inputs.hidden = {}
                for (const input in serverInfo.input.hidden) {
                    objectInfo.inputs.hidden[input] = ComfyApiClient.parseObjectInputInfo(serverInfo.input.hidden[input])
                }
            }

            for (let outputIndex = 0; outputIndex < serverInfo.output.length; outputIndex++) {
                objectInfo.outputs.push({
                    type: serverInfo.output[outputIndex],
                    isList: serverInfo['output_is_list'][outputIndex],
                    name: serverInfo['output_name'][outputIndex],
                    tooltip: serverInfo['output_tooltips']?.[outputIndex]
                })
            }
        }

        return result
    }
}