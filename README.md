# Comfy Caller

## About

Comfy Caller is a set of small TypeScript libraries to interact with ComfyUI API.

One of the main goals for this project is to not only provide the wrappers for API calls, but also provide tools to
build the prompt graph directly in JS code.

## [NEW] Code generation

You can generate node model types for a running Comfy instance by running `comfy-codegen.ts` script and piping the output into a new TypeScript file.

## Runtime support

Currently, Comfy Caller is only tested with [Bun](https://bun.sh/), but I assume that it should work fine with other JS runtimes as well.

## Examples

All the usage examples are located in the `examples` directory.

## Feature status

- [x] API wrappers
  - [x] WebSocket events
    - [x] `SaveImageWebsocket` output
  - [x] Prompt queueing
  - [x] Object info (available node list + values, e.g. checkpoints)
  - [ ] History
  - [ ] Image upload
  - [ ] On-demand system / queue status
  - [ ] Anything else
- [x] Graph modeling
  - [x] Abstract node interface
  - [x] Graph construction / node connection
  - [x] Node models
    - [x] [NEW] Generating node models from a running Comfy instance (see [`comfy-codegen.ts`](comfy-codegen.ts) and [`examples/simple-img-graph-gentypes.ts`](examples/simple-img-graph-gentypes.ts))
  - [x] UI workflow import
  - [ ] API workflow import

## License

MIT