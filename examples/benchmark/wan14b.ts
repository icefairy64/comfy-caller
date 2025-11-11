import { ComfyGraph } from "../../comfy-graph";
import { CLIPLoader, CLIPTextEncode, EmptyHunyuanLatentVideo, KSampler, PreviewAny, SaveLatent, UnetLoaderGGUFDisTorch2MultiGPU } from "../../comfy-typedefs";

export type WAN21_14B_Tunables = {
    latentDim: [number, number],
    latentLength: number,
    steps: number,
    seed: number
}

export function createGraph(params: WAN21_14B_Tunables) {
    const graph = new ComfyGraph()

    const unetLoader = graph.createNode(UnetLoaderGGUFDisTorch2MultiGPU)
    const clipLoader = graph.createNode(CLIPLoader)
    const te = graph.createNode(CLIPTextEncode)
    const latent = graph.createNode(EmptyHunyuanLatentVideo)
    const sampler = graph.createNode(KSampler, 'Sampler')
    const out = graph.createNode(PreviewAny)

    unetLoader.connectAll({
        unet_name: 'wan2.2_t2v_low_noise_14B_Q6_K.gguf',
        virtual_vram_gb: 4,
        donor_device: 'cpu',
        compute_device: 'cuda:0',
        eject_models: true
    })

    clipLoader.connectAll({
        clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
        type: 'wan'
    })
    
    te.connectAll({
        clip: clipLoader.sockets.outputs.CLIP,
        text: 'abc'
    })

    latent.connectAll({
        width: params.latentDim[0],
        height: params.latentDim[1],
        length: params.latentLength,
        batch_size: 1
    })

    sampler.connectAll({
        cfg: 1,
        denoise: 1,
        model: unetLoader.sockets.outputs.MODEL,
        negative: te.sockets.outputs.CONDITIONING,
        positive: te.sockets.outputs.CONDITIONING,
        scheduler: 'simple',
        sampler_name: 'euler',
        seed: params.seed,
        steps: params.steps,
        latent_image: latent.sockets.outputs.LATENT
    })

    out.connectAll({
        source: sampler.sockets.outputs.LATENT
    })

    return graph
}

type ArrayedTunables = {
    [K in keyof WAN21_14B_Tunables]: WAN21_14B_Tunables[K] extends infer T ? T[] : never
}

export function createSets(params: Partial<ArrayedTunables>) {
    const keys = Object.keys(params),
        currentKey = keys[0]

    if (keys.length === 1) {
        return params[currentKey].map(x => ({
            [currentKey]: x
        })) as WAN21_14B_Tunables[]
    }

    const results: WAN21_14B_Tunables[] = [],
        rest = {
            ...params
        }

    delete rest[currentKey]
    const restSets = createSets(rest)

    for (const value of params[currentKey]) {
        for (const restSet of restSets) {
            results.push({
                [currentKey]: value,
                ...restSet
            })
        }
    }    
    
    return results
}