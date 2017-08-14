
interface MemoizationCache<T> {
    timestamp: number,
    result: undefined | T,
    promise: undefined | Promise<T> | T,
    initialized: boolean
}

function buildCacher<T>(_f: () => (Promise<T>|T), _maxAgeSeconds: number): () => Promise<T> {
    const maxAgeMS = _maxAgeSeconds * 1000;
    const f = _f;
    const cache: MemoizationCache<T> = {
        timestamp: -Infinity,
        result: undefined,
        promise: undefined,
        initialized: false
    };

    const _update = async function() {
        let result;
        let promise;
        try {
            promise = f();
            cache.promise = promise;
            result = await promise;
        } catch (e) {
            throw e;
        } finally {
            cache.promise = undefined;
        }
        cache.initialized = true;
        cache.timestamp = Date.now();
        cache.result = result;
    }

    const r = async function() {
        if (Date.now() >= cache.timestamp + maxAgeMS) {
            _update();
        }
        if (!cache.initialized) {
            _update();
            await cache.promise;
        }
        return cache.result!;
    }

    return r;
}

export = buildCacher;