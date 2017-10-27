
interface MemoizationCache<T> {
    timestamp: number,
    result: undefined | T,
    promise: undefined | Promise<any>,
    initialized: boolean,
    error: Error | undefined
}

function buildCacher<T>(_f: () => (Promise<T>|T), _maxAgeSeconds: number): () => Promise<T> {
    const maxAgeMS = _maxAgeSeconds * 1000;
    const f = _f;
    const cache: MemoizationCache<T> = {
        timestamp: -Infinity,
        result: undefined,
        promise: undefined,
        initialized: false,
        error: undefined
    };

    const _update = async function() {
        let result;

        try {
            const result = await f();
            cache.error = undefined;
            cache.result = result;
        } catch (e) {
            cache.error = e;
            cache.result = undefined;
        }

        cache.timestamp = Date.now();
        cache.initialized = true;
    }

    const _updateWithLock = function() {
        if (cache.promise) {
            return;
        }

        cache.promise = _update().then(() => {cache.promise = undefined});
    }

    const r = async function() {
        if (Date.now() >= cache.timestamp + maxAgeMS || !cache.initialized) {
            _updateWithLock();
        }
        if (!cache.initialized) {
            await cache.promise;
        }
        if (cache.error) {
            throw cache.error;
        }
        return cache.result!;
    }

    return r;
}

function createCacherFromArgs<R>(f: () => Promise<R> | R, maxAgeSeconds: number): () => Promise<R>;
function createCacherFromArgs<R, A1>(f: (a: A1) => Promise<R> | R, maxAgeSeconds: number): (a1: A1) => Promise<R>;
function createCacherFromArgs<R, A1, A2>(f: (a1: A1, a2: A2) => Promise<R> | R, maxAgeSeconds: number): (a1: A1, a2: A2) => Promise<R>;
function createCacherFromArgs<R, A1, A2, A3>(f: (a1: A1, a2: A2, a3: A3) => Promise<R> | R, maxAgeSeconds: number): (a1: A1, a2: A2, a3: A3) => Promise<R>;
function createCacherFromArgs<R, A1, A2, A3, A4>(f: (a1: A1, a2: A2, a3: A3, a4: A4) => Promise<R> | R, maxAgeSeconds: number): (a1: A1, a2: A2, a3: A3, a4: A4) => Promise<R>;
function createCacherFromArgs<R, A1, A2, A3, A4, A5>(f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => Promise<R> | R, maxAgeSeconds: number): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => Promise<R>;
function createCacherFromArgs<R, A1, A2, A3, A4, A5, A6>(f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => Promise<R> | R, maxAgeSeconds: number): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => Promise<R>;
function createCacherFromArgs<R, A1, A2, A3, A4, A5, A6, A7>(f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7) => Promise<R> | R, maxAgeSeconds: number): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7) => Promise<R>;
function createCacherFromArgs<R, A1, A2, A3, A4, A5, A6, A7, A8>(f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8) => Promise<R> | R, maxAgeSeconds: number): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8) => Promise<R>;
function createCacherFromArgs<R>(f: (...args: any[]) => Promise<R> | R, maxAgeSeconds: number) {
    const rootMap = new Map();
    const rootCacher = buildCacher(() => f(), maxAgeSeconds);

    return function(...args: any[]): Promise<R> {
        const cacher: (() => Promise<R>) | Map<any, any> = args.reduce(
            (currentMap: Map<any, Map<any, any> | (() => Promise<R>)>, nextArg, i) => {
                if (!currentMap.has(nextArg)) {
                    const mapValue = (i === args.length - 1)
                        ? buildCacher(() => f(...args), maxAgeSeconds)
                        : new Map();
                    currentMap.set(nextArg, mapValue);
                }
                const nextMap = currentMap.get(nextArg)!;
                return nextMap;
            }, rootMap)

        return (cacher === rootMap) ? rootCacher() : (cacher as () => Promise<R>)();
    }
}

export = createCacherFromArgs;