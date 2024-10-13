import { ComfyApiClient } from '../comfy-api-client.ts'
import {
    CheckpointLoaderSimple,
    CLIPTextEncode,
    EmptyLatentImage,
    KSampler, SaveImageWebsocket, VAEDecode
} from '../generated-types.ts'
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

const ckpt = new CheckpointLoaderSimple()
ckpt.connectAll({
    ckpt_name: firstCkptName
})

const positiveClip = new CLIPTextEncode()
const negativeClip = new CLIPTextEncode()
const emptyLatent = new EmptyLatentImage()
const sampler = new KSampler()
const decode = new VAEDecode()
const wsImage = new SaveImageWebsocket()

graph.addNode(ckpt)
graph.addNode(positiveClip)
graph.addNode(negativeClip)
graph.addNode(emptyLatent)
graph.addNode(sampler, 'KSAMPLER')
graph.addNode(decode, 'VAE DECODE')
graph.addNode(wsImage, 'IMAGE')

positiveClip.connectAll({
    text: positivePrompt,
    clip: ckpt.sockets.outputs.CLIP
})

negativeClip.connectAll({
    text: negativePrompt,
    clip: ckpt.sockets.outputs.CLIP
})

emptyLatent.connectAll({
    batch_size: 1,
    width: imageWidth,
    height: imageHeight
})

sampler.connectAll({
    seed: 595944585462224,
    steps: 28,
    denoise: 1,
    cfg: 8,
    sampler_name: 'euler',
    scheduler: 'normal',
    model: ckpt.sockets.outputs.MODEL,
    positive: positiveClip.sockets.outputs.CONDITIONING,
    negative: negativeClip.sockets.outputs.CONDITIONING,
    latent_image: emptyLatent.sockets.outputs.LATENT
})

decode.connectAll({
    samples: sampler.sockets.outputs.LATENT,
    vae: ckpt.sockets.outputs.VAE
})

wsImage.connectAll({
    images: decode.sockets.outputs.IMAGE
})

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