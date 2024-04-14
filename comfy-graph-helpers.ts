import { ComfyGenericNode, ComfyGraph } from './comfy-graph.ts'
import type { ComfyObjectInfoResponse } from './comfy-api-client.ts'

interface ComfyUiWorkflowNodeInput {
    name: string,
    type: string,
    link: number | null,
    widget?: {
        name: string
    },
    slot_index?: number
}

interface ComfyUiWorkflowNodeOutput {
    name: string,
    type: string,
    links: number[],
    slot_index: 0
}

interface ComfyUiWorkflowNode {
    id: number,
    type: string,
    pos: [number, number],
    size: {
        0: number,
        1: number
    },
    flags: {
        pinned?: boolean,
        collapsed?: boolean
    },
    order: number,
    mode: number,
    inputs?: ComfyUiWorkflowNodeInput[],
    outputs?: ComfyUiWorkflowNodeOutput[],
    properties: Record<string, any>,
    widgets_values?: any[]
}

interface ComfyUiWorkflowGroup {
    title: string,
    bounding: [number, number, number, number],
    color: string,
    font_size: number
}

interface ComfyUiWorkflow {
    nodes: ComfyUiWorkflowNode[],
    // link id, source node, output slot, target node, input slot, value type
    links: [number, number, number, number, number, string][],
    groups: ComfyUiWorkflowGroup[],
    config: Record<string, any>,
    extra: Record<string, any>,
    version: number
}

export function convertComfyUiWorkflowToGraph(workflow: ComfyUiWorkflow, objectInfoResponse: ComfyObjectInfoResponse): ComfyGraph {
    const graph = new ComfyGraph()

    for (const nodeDef of workflow.nodes) {
        const node = new ComfyGenericNode(nodeDef.type),
            objectInfo = objectInfoResponse[nodeDef.type]
        graph.addNode(node, nodeDef.id.toString())
        if (nodeDef.widgets_values != null) {
            let widgetIndex = 0
            for (const inputName of Object.keys(objectInfo.inputs.required)) {
                if (nodeDef.inputs == null || nodeDef.inputs.find(x => x.name === inputName) == null) {
                    if (widgetIndex >= nodeDef.widgets_values.length) {
                        throw new Error(`No widget value available for input "${inputName}" of ${nodeDef.type} node ${nodeDef.id}`)
                    }

                    // Skip 'control_after_generate' widgets
                    if ((nodeDef.type === 'KSampler' || nodeDef.type === 'PrimitiveNode') && widgetIndex === 1) {
                        widgetIndex++;
                    } else if (nodeDef.type === 'KSamplerAdvanced' && widgetIndex === 2) {
                        widgetIndex++;
                    }

                    node.getInput(inputName).value = nodeDef.widgets_values[widgetIndex]
                    widgetIndex++
                }
            }
        }
    }

    for (const linkDef of workflow.links) {
        const sourceNode = graph.nodeMap.get(linkDef[1].toString()),
            targetNode = graph.nodeMap.get(linkDef[3].toString())

        if (sourceNode == null) {
            throw new Error(`No source node found for id ${linkDef[1]} of link ${linkDef[0]}`)
        }

        if (targetNode == null) {
            throw new Error(`No target node found for id ${linkDef[3]} of link ${linkDef[0]}`)
        }

        const sourceNodeOutput = sourceNode.getOutputRef(linkDef[2]),
            targetNodeDef = workflow.nodes.find(x => x.id === linkDef[3])

        if (targetNodeDef == null) {
            throw new Error(`No target node definition found for id ${linkDef[3]} of link ${linkDef[0]}`)
        }

        const targetNodeInputName = targetNodeDef.inputs?.[linkDef[4]]?.name

        if (targetNodeInputName == null) {
            throw new Error(`No target node input ${linkDef[4]} name found for id ${linkDef[3]} of link ${linkDef[0]}`)
        }

        targetNode.getInput(targetNodeInputName).connectTo(sourceNodeOutput)
    }

    return graph
}