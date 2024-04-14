import objectInfoRaw from '../object-info.json'

import singleKsamplerWorkflow from './ui-workflows/single-ksampler.json'
import clipEncodeWithKsamplerWorkflow from './ui-workflows/clip-encode-with-ksampler.json'

import { test, expect } from 'bun:test'
import { convertComfyUiWorkflowToGraph } from '../../comfy-graph-helpers.ts'
import { ComfyApiClient } from '../../comfy-api-client.ts'
import type { ComfyNodeSourceRef } from '../../comfy-graph.ts'

const objectInfo = ComfyApiClient.parseObjectInfoResponse(objectInfoRaw)

const singleKsamplerGraph = convertComfyUiWorkflowToGraph(singleKsamplerWorkflow as any, objectInfo),
    clipEncodeWithKsamplerGraph = convertComfyUiWorkflowToGraph(clipEncodeWithKsamplerWorkflow as any, objectInfo)

test('nodes are loaded', () => {
    expect(singleKsamplerGraph.nodes).toBeArrayOfSize(1)

    const ksampler = singleKsamplerGraph.nodes[0]
    expect(ksampler.classType).toBe('KSampler')

    expect(ksampler.getInput('positive')).not.toBeNull()
    expect(ksampler.getInput('positive').value).toBeUndefined()

    expect(ksampler.getInput('seed').value).toBe(0)
    expect(ksampler.getInput('steps').value).toBe(20)
    expect(ksampler.getInput('cfg').value).toBe(8)
    expect(ksampler.getInput('sampler_name').value).toBe('euler')
    expect(ksampler.getInput('scheduler').value).toBe('normal')
    expect(ksampler.getInput('denoise').value).toBe(1)
})

test('nodes are connected', () => {
    expect(clipEncodeWithKsamplerGraph.nodes).toBeArrayOfSize(2)

    const ksampler = clipEncodeWithKsamplerGraph.nodeMap.get('0')!,
        clip = clipEncodeWithKsamplerGraph.nodeMap.get('1')!

    const ksamplerPositiveValue = ksampler.getInput('positive').value
    expect(ksamplerPositiveValue).toBeObject()

    const ksamplerPositiveConnection = ksamplerPositiveValue as ComfyNodeSourceRef
    expect(ksamplerPositiveConnection).toEqual(clip.getOutputRef(0))
})