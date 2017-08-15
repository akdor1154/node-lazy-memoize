
interface MemoizationCache<T> {
    timestamp: number,
    result: undefined | T,
    promise: undefined | Promise<T> | T,
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
        let promise;
        try {
            promise = f();
            cache.promise = promise;
            result = await promise;
            cache.error = undefined;
            cache.result = result;
        } catch (e) {
            cache.error = e;
            cache.result = undefined;
        } finally {
            cache.promise = undefined;
        }
        cache.timestamp = Date.now();
        cache.initialized = true;
    }

    const r = async function() {
        if (Date.now() >= cache.timestamp + maxAgeMS || !cache.initialized) {
            _update();
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

export = buildCacher;