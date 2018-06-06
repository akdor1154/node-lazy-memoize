interface MemoizationCache<T> {
    timestamp: number;
    result: undefined | T;
    promise: undefined | Promise<any>;
    initialized: boolean;
    error: Error | undefined;
}

import events = require('events');

const EventEmitter = events.EventEmitter;
const eventEmitterProperties = Object.getOwnPropertyDescriptors(EventEmitter.prototype);

function buildCacher<F extends () => Promise<any>>(_f: F, _maxAgeSeconds: number, passedOptions: createCacherFromArgs.Options | undefined, eventEmitter: events.EventEmitter): typeof _f {
    const maxAgeMS = _maxAgeSeconds * 1000;
    const f = _f;
    const cache: MemoizationCache<UnPromise<ReturnType<typeof _f>>> = {
        timestamp: -Infinity,
        result: undefined,
        promise: undefined,
        initialized: false,
        error: undefined
    };

    const options = Object.assign(
        {
            errors: 'passthrough'
        } as createCacherFromArgs.Options,
        passedOptions
    );

    const _update =
        options.errors === 'passthrough'
            ? async function() {
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
            : async function() {
                  try {
                      const result = await f();
                      cache.error = undefined;
                      cache.result = result;
                      cache.timestamp = Date.now();
                      cache.initialized = true;
                  } catch (e) {
                      // todo: emit error.
                      if (!cache.initialized) {
                          cache.error = e;
                      }
                      eventEmitter.emit('error', e);
                  }
              };

    const _updateWithLock = function() {
        if (cache.promise) {
            return;
        }
        let savedE: Error | undefined;
        cache.promise = _update()
            .catch(e => {
                savedE = e;
            })
            .then(() => {
                cache.promise = undefined;
                if (savedE) {
                    throw savedE;
                }
            });
    };

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
    };

    return r as typeof _f;
}

type UnPromise<T> = T extends Promise<infer R> ? R : any;

function createCacherFromArgs<F extends (...args: any[]) => Promise<any>>(f: F, maxAgeSeconds: number, options?: createCacherFromArgs.Options): typeof f & events.EventEmitter {
    const rootMap = new Map();
    const aggregateCacher = function(...args: any[]): Promise<any> {
        const cacher: (() => Promise<any>) | Map<any, any> = args.reduce((currentMap: Map<any, Map<any, any> | (() => Promise<any>)>, nextArg, i) => {
            if (!currentMap.has(nextArg)) {
                const mapValue = i === args.length - 1 ? buildCacher(() => f(...args), maxAgeSeconds, options, aggregateCacher) : new Map();
                currentMap.set(nextArg, mapValue);
            }
            const nextMap = currentMap.get(nextArg)!;
            return nextMap;
        }, rootMap);

        return cacher === rootMap ? rootCacher() : (cacher as () => Promise<any>)();
    } as (typeof f) & events.EventEmitter;
    Object.defineProperties(aggregateCacher, eventEmitterProperties);
    EventEmitter.call(aggregateCacher);

    const rootCacher = buildCacher(() => f(), maxAgeSeconds, options, aggregateCacher);

    return aggregateCacher;
}
namespace createCacherFromArgs {
    export interface Options {
        errors: 'passthrough' | 'swallow';
    }
}

export = createCacherFromArgs;
