export class Deferred<T> {
    promise: Promise<T>

    private _resolve?: (value: T) => void
    private _reject?: (err: any) => void

    constructor() {
        this.promise = new Promise((res, rej) => {
            this._resolve = res
            this._reject = rej
        })
    }

    resolve(value: T) {
        this._resolve?.(value)
    }

    reject(err: any) {
        this._reject?.(err)
    }
}