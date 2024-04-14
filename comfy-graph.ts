export interface ComfyNodeSourceRef {
    sourceNodeId: string,
    sourceNodeOutputIndex: number
}

export class ComfyNodeInputRef {
    node: ComfyNode
    name: string

    constructor(node: ComfyNode, name: string) {
        this.node = node
        this.name = name
    }

    get value() {
        return this.node.inputs[this.name]
    }

    set value(value: any) {
        this.node.inputs[this.name] = value
    }

    connectTo(source: ComfyNodeSourceRef) {
        this.node.inputs[this.name] = source
    }
}

export abstract class ComfyNode {
    id: string | undefined
    inputs: Record<string, any | ComfyNodeSourceRef> = {}

    abstract classType: string

    getInput(name: string) {
        return new ComfyNodeInputRef(this, name)
    }

    getOutputRef(outputIndex: number): ComfyNodeSourceRef {
        if (this.id === undefined) {
            throw new Error('No id specified')
        }
        return {
            sourceNodeId: this.id,
            sourceNodeOutputIndex: outputIndex
        }
    }
}

export class ComfyGenericNode extends ComfyNode {
    classType: string

    constructor(classType: string) {
        super()
        this.classType = classType
    }
}

export class ComfyGraph {
    nodes: ComfyNode[] = []
    nodeMap: Map<string, ComfyNode> = new Map()

    addNode(node: ComfyNode, id?: string) {
        if (id === undefined) {
            id = this.nodes.length.toString()
        }
        node.id = id
        this.nodes.push(node)
        this.nodeMap.set(id, node)
    }

    toApiPrompt() {
        const json: Record<string, any> = {}
        for (const node of this.nodes) {
            if (node.id === undefined) {
                throw new Error('No id for node ' + node)
            }
            const inputs: Record<string, any> = {}
            for (const inputName in node.inputs) {
                const inputValue = node.inputs[inputName]
                if (inputValue instanceof Object) {
                    inputs[inputName] = [inputValue.sourceNodeId, inputValue.sourceNodeOutputIndex]
                } else {
                    inputs[inputName] = inputValue
                }
            }
            json[node.id] = {
                inputs,
                class_type: node.classType,
                _meta: {}
            }
        }
        return json
    }
}