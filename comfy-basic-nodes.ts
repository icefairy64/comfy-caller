import { ComfyNode } from './comfy-graph.ts'

export class ComfyKSamplerNode extends ComfyNode {
    classType: string = 'KSampler'

    get seed() {
        return this.getInput('seed')
    }

    get steps() {
        return this.getInput('steps')
    }

    get cfg() {
        return this.getInput('cfg')
    }

    get samplerName() {
        return this.getInput('sampler_name')
    }

    get scheduler() {
        return this.getInput('scheduler')
    }

    get denoise() {
        return this.getInput('denoise')
    }

    get model() {
        return this.getInput('model')
    }

    get positive() {
        return this.getInput('positive')
    }

    get negative() {
        return this.getInput('negative')
    }

    get latentImage() {
        return this.getInput('latent_image')
    }

    get latent() {
        return this.getOutputRef(0)
    }
}

export class ComfyCheckpointLoaderSimpleNode extends ComfyNode {
    classType: string = 'CheckpointLoaderSimple'

    get checkpointName() {
        return this.getInput('ckpt_name')
    }

    get model() {
        return this.getOutputRef(0)
    }

    get clip() {
        return this.getOutputRef(1)
    }

    get vae() {
        return this.getOutputRef(2)
    }
}

export class ComfyEmptyLatentImageNode extends ComfyNode {
    classType: string = 'EmptyLatentImage'

    get width() {
        return this.getInput('width')
    }

    get height() {
        return this.getInput('height')
    }

    get batchSize() {
        return this.getInput('batch_size')
    }

    get latent() {
        return this.getOutputRef(0)
    }
}

export class ComfyClipTextEncodeNode extends ComfyNode {
    classType: string = 'CLIPTextEncode'

    get clip() {
        return this.getInput('clip')
    }

    get text() {
        return this.getInput('text')
    }

    get conditioning() {
        return this.getOutputRef(0)
    }
}

export class ComfyVaeDecodeNode extends ComfyNode {
    classType: string = 'VAEDecode'

    get samples() {
        return this.getInput('samples')
    }

    get vae() {
        return this.getInput('vae')
    }

    get image() {
        return this.getOutputRef(0)
    }
}

export class ComfySaveImageWebsocketNode extends ComfyNode {
    classType: string = 'SaveImageWebsocket'

    get images() {
        return this.getInput('images')
    }
}