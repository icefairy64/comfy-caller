import { ComfyApiClient } from '../comfy-api-client.ts'
import {
    ComfyCheckpointLoaderSimpleNode,
    ComfyClipTextEncodeNode,
    ComfyEmptyLatentImageNode,
    ComfyKSamplerNode, ComfySaveImageWebsocketNode, ComfyVaeDecodeNode
} from '../comfy-basic-nodes.ts'
import { ComfyGraph } from '../comfy-graph.ts'
import { getCheckpoints, promptForImage } from '../comfy-api-helpers.ts'

const host = '127.0.0.1:8188',
    positivePrompt = 'beautiful scenery nature glass bottle landscape, purple galaxy bottle',
    negativePrompt = 'text',
    imageWidth = 512,
    imageHeight = 512

// Connect to the server

const client = new ComfyApiClient(host)

// Get checkpoints

const checkpoints = await getCheckpoints(client)

const firstCkptName = checkpoints[0]
console.log(`Using checkpoint ${firstCkptName}`)

// Build a node graph

const graph = new ComfyGraph()

const ckpt = new ComfyCheckpointLoaderSimpleNode()
ckpt.checkpointName.value = firstCkptName

const positiveClip = new ComfyClipTextEncodeNode()
positiveClip.text.value = positivePrompt

const negativeClip = new ComfyClipTextEncodeNode()
negativeClip.text.value = negativePrompt

const emptyLatent = new ComfyEmptyLatentImageNode()
emptyLatent.width.value = imageWidth
emptyLatent.height.value = imageHeight
emptyLatent.batchSize.value = 1

const sampler = new ComfyKSamplerNode()
sampler.seed.value = 595944585462224
sampler.steps.value = 28
sampler.denoise.value = 1
sampler.cfg.value = 8
sampler.samplerName.value = 'euler'
sampler.scheduler.value = 'normal'

const decode = new ComfyVaeDecodeNode()

const wsImage = new ComfySaveImageWebsocketNode()

graph.addNode(ckpt)
graph.addNode(positiveClip)
graph.addNode(negativeClip)
graph.addNode(emptyLatent)
graph.addNode(sampler, 'KSAMPLER')
graph.addNode(decode, 'VAE DECODE')
graph.addNode(wsImage, 'IMAGE')

positiveClip.clip.connectTo(ckpt.clip)
negativeClip.clip.connectTo(ckpt.clip)

sampler.model.connectTo(ckpt.model)
sampler.positive.connectTo(positiveClip.conditioning)
sampler.negative.connectTo(negativeClip.conditioning)
sampler.latentImage.connectTo(emptyLatent.latent)

decode.samples.connectTo(sampler.latent)
decode.vae.connectTo(ckpt.vae)

wsImage.images.connectTo(decode.image)

if (wsImage.id === undefined) {
    throw new Error('No id generated for output node')
}

// Convert JS graph representation to API prompt

const prompt = graph.toApiPrompt()

// Optional: setup progress listeners

client.addEventListener('progress', event => {
    console.log(`Progress: ${event.progress} / ${event.progressMax} for node ${event.node}`)
})

// Queue the prompt and wait for the image

const blob = await promptForImage(client, prompt, wsImage.id)
console.log(`Received image, size: ${blob.size} bytes`)

// Save the image to the disk

if (global.Bun) {
    console.log('Saving as output.png')
    await Bun.write('output.png', blob)
} else {
    console.error('TODO: image saving is not implemented for non-Bun environments')
}

// Close the connection

client.close()