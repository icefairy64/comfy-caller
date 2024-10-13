import { ComfyApiClient } from './comfy-api-client.ts'
import type { ComfyObjectInfo, ComfyInputInfo, ComfyOutputInfo, ComfyObjectInfoResponse } from './comfy-api-client.ts'

function generateNodeDefinition(object: ComfyObjectInfo) {
    let code = 'export class '
    code += object.name
    code += ' extends ComfyNode {\n'

    code += '\tclassType: string = "'
    code += object.name
    code += '"\n\n'

    code += '\tsockets: {\n'
    code += '\t\tinputs: Required<'
    code += object.name
    code += 'Inputs>\n'
    code += '\t\toutputs: {\n'
    for (const output of object.outputs) {
        code += generateOutputDefinition(output)
    }
    code += '\t\t}\n'
    code += '\t}\n\n'

    code += '\tconstructor() {\n'
    code += '\t\tsuper()\n'
    code += '\t\tconst $node = this\n'
    code += '\t\tthis.sockets = {\n'
    code += '\t\t\tinputs: {\n'
    for (const input of getNodeInputsIterator(object)) {
        code += generateInputRefInstantiation(input.name, input.input, input.type === 'required')
    }
    code += '\t\t\t},\n'
    code += '\t\t\toutputs: Object.create(Object.prototype, {\n'
    for (const output of object.outputs.map((x, i) => [x, i] as [ComfyOutputInfo, number])) {
        code += generateOutputRefInstantiation(output[0], output[1])
    }
    code += '\t\t\t})\n'
    code += '\t\t}\n'
    code += '\t}\n\n'

    code += '\tconnectAll(sources: MappedSources<'
    code += object.name
    code += 'Inputs>) {\n'
    for (const input of getNodeInputsIterator(object)) {
        code += generateInputConnect(input.name, input.input, input.type === 'required')
        code += '\n'
    }
    code += '\t}\n'

    code += '}\n\n'

    code += 'type '
    code += object.name
    code += 'Inputs = {\n'
    for (const input of getNodeInputsIterator(object)) {
        code += generateInputDefinition(input.name, input.input, input.type === 'required')
    }
    code += '}\n'

    return code
}

function* getNodeInputsIterator(object: ComfyObjectInfo) {
    for (const pair of Object.entries(object.inputs.required)) {
        yield {
            name: pair[0],
            input: pair[1],
            type: 'required' as 'required' | 'optional' | 'hidden'
        }
    }
    if (object.inputs.optional != null) {
        for (const pair of Object.entries(object.inputs.optional)) {
            yield {
                name: pair[0],
                input: pair[1],
                type: 'optional' as 'required' | 'optional' | 'hidden'
            }
        }
    }
    if (object.inputs.hidden != null) {
        for (const pair of Object.entries(object.inputs.hidden)) {
            yield {
                name: pair[0],
                input: pair[1],
                type: 'hidden' as 'required' | 'optional' | 'hidden'
            }
        }
    }
}

function generateInputDefinition(name: string, input: ComfyInputInfo, required: boolean) {
    let code = '\t\t\t'

    if (input.tooltip != null) {
        code += '/** '
        code += input.tooltip
        code += '*/\n\t\t\t'
    }

    code += '"'
    code += name
    code += '"'
    if (!required) {
        code += '?'
    }
    code += ': ComfyNodeTypedInputRef<'
    code += getInputType(input)
    code += '>\n'

    return code
}

function convertObjectInfoTypeToLocal(tp: string) {
    if (tp === 'TEXT' || tp === 'STRING') {
        return 'string'
    } else if (tp === 'FLOAT' || tp === 'INT') {
        return 'number'
    } else if (tp === 'BOOLEAN') {
        return 'boolean'
    } else {
        return 'ComfyValueType_' + tp
    }
}

function getInputType(input: ComfyInputInfo) {
    if ('type' in input) {
        return convertObjectInfoTypeToLocal(input.type)
    } else if ('genericType' in input) {
        return convertObjectInfoTypeToLocal(input.genericType)
    } else {
        if (input.values.length === 0) {
            return 'void'
        } else {
            return 'string'
        }
    }
}

function generateOutputDefinition(output: ComfyOutputInfo) {
    let code = '\t\t\t'

    if (output.tooltip != null) {
        code += '/** '
        code += output.tooltip
        code += '*/\n\t\t\t'
    }

    code += output.name
    code += ': ComfyNodeTypedSourceRef<'
    code += convertObjectInfoTypeToLocal(output.type)
    code += '>\n'

    return code
}

function generateInputRefInstantiation(name: string, input: ComfyInputInfo, required: boolean) {
    let code = '\t\t\t\t'

    code += '"'
    code += name
    code += '": new ComfyNodeTypedInputRef<'
    code += getInputType(input)
    code += '>(this, "'
    code += name
    code += '"),\n'

    return code
}

function generateOutputRefInstantiation(output: ComfyOutputInfo, index: number) {
    let code = '\t\t\t\t'

    code += '"'
    code += output.name
    code += '": {\n'
    code += '\t\t\t\t\tconfigurable: false,\n'
    code += '\t\t\t\t\tget: function () {\n'
    code += '\t\t\t\t\t\treturn { sourceNodeId: $node.id, sourceNodeOutputIndex: '
    code += index
    code += ' }\n'
    code += '\t\t\t\t\t}\n'
    code += '\t\t\t\t},\n'

    return code
}

function generateInputConnect(name: string, input: ComfyInputInfo, required: boolean) {
    let code = ''
    if (!required) {
        code += '\t\tif (sources["'
        code += name
        code += '"] !== undefined) {\n'
    }

    code += '\t\tif (typeof sources["'
    code += name
    code += '"] === "object") {\n'

    code += '\t\t\tthis.sockets.inputs["'
    code += name
    code += '"].connectTo(sources["'
    code += name
    code += '"])\n'

    code += '\t\t} else {\n'
    code += '\t\t\tthis.sockets.inputs["'
    code += name
    code += '"].value = sources["'
    code += name
    code += '"]\n'

    code += ''

    code += '\t\t}\n'

    if (!required) {
        code += '\t\t}\n'
    }

    return code
}

function generateComfyTypeDefs(response: ComfyObjectInfoResponse) {
    const typeArray = Object.values(response)
        .flatMap(o => [...getNodeInputsIterator(o)])
        .map(x => getInputType(x.input))
        .filter(t => t.startsWith('ComfyValueType_'))
    const types = new Set(typeArray)

    let code = ''

    for (const t of types) {
        code += 'const Symbol_'
        code += t
        code += ' = Symbol()\n'

        code += 'type '
        code += t
        code += ' = typeof Symbol_'
        code += t
        code += '\n'
    }

    return code
}

let host = 'localhost:8188'

const client = new ComfyApiClient(host)

const info = await client.getObjectInfo()

console.log('import { ComfyNodeTypedInputRef, ComfyNode } from "./comfy-graph.ts"')
console.log('import type { ComfyNodeTypedSourceRef } from "./comfy-graph.ts"')
console.log('')

console.log('type MappedSources<TInputs> = {')
console.log('\t[K in keyof TInputs]: TInputs[K] extends ComfyNodeTypedInputRef<infer T> ? T | ComfyNodeTypedSourceRef<T> : never')
console.log('}\n')

console.log(generateComfyTypeDefs(info))

for (const object of Object.values(info)) {
    console.log(generateNodeDefinition(object))
    console.log('')
}

client.close()