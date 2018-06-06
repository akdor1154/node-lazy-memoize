interface MemoizationCache<T> {
    timestamp: number;
    result: undefined | T;
    promise: undefined | Promise<any>;
    initialized: boolean;
    error: Error | undefined;
}

import events = require('events');

const getOwnPropertyDescriptors =
    (Object as any).getOwnPropertyDescriptors ||
    function getOwnPropertyDescriptors<O extends object>(genericObject: O) {
        const ownKeys = Reflect.ownKeys(genericObject) as (keyof O)[];
        const descriptors = {} as { [k in keyof O]: PropertyDescriptor };

        for (let key of ownKeys) {
            let descriptor = Reflect.getOwnPropertyDescriptor(genericObject, key);
            descriptors[key] = descriptor!;
        }

        return descriptors;
    };

const EventEmitter = events.EventEmitter;
const eventEmitterProperties = getOwnPropertyDescriptors(EventEmitter.prototype);
function buildCacher<T>(_f: () => Promise<T> | T, _maxAgeSeconds: number, passedOptions: createCacherFromArgs.Options | undefined, eventEmitter: events.EventEmitter): () => Promise<T> {
    const maxAgeMS = _maxAgeSeconds * 1000;
    const f = _f;
    const cache: MemoizationCache<T> = {
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

    return r;
}

function createCacherFromArgs<R>(f: () => Promise<R> | R, maxAgeSeconds: number, options?: createCacherFromArgs.Options): (() => Promise<R>) & events.EventEmitter;
function createCacherFromArgs<R, A1>(f: (a: A1) => Promise<R> | R, maxAgeSeconds: number, options?: createCacherFromArgs.Options): ((a1: A1) => Promise<R>) & events.EventEmitter;
function createCacherFromArgs<R, A1, A2>(f: (a1: A1, a2: A2) => Promise<R> | R, maxAgeSeconds: number, options?: createCacherFromArgs.Options): ((a1: A1, a2: A2) => Promise<R>) & events.EventEmitter;
function createCacherFromArgs<R, A1, A2, A3>(f: (a1: A1, a2: A2, a3: A3) => Promise<R> | R, maxAgeSeconds: number, options?: createCacherFromArgs.Options): ((a1: A1, a2: A2, a3: A3) => Promise<R>) & events.EventEmitter;
function createCacherFromArgs<R, A1, A2, A3, A4>(f: (a1: A1, a2: A2, a3: A3, a4: A4) => Promise<R> | R, maxAgeSeconds: number, options?: createCacherFromArgs.Options): ((a1: A1, a2: A2, a3: A3, a4: A4) => Promise<R>) & events.EventEmitter;
function createCacherFromArgs<R, A1, A2, A3, A4, A5>(f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => Promise<R> | R, maxAgeSeconds: number, options?: createCacherFromArgs.Options): ((a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => Promise<R>) & events.EventEmitter;
function createCacherFromArgs<R, A1, A2, A3, A4, A5, A6>(f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => Promise<R> | R, maxAgeSeconds: number, options?: createCacherFromArgs.Options): ((a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => Promise<R>) & events.EventEmitter;
function createCacherFromArgs<R, A1, A2, A3, A4, A5, A6, A7>(f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7) => Promise<R> | R, maxAgeSeconds: number, options?: createCacherFromArgs.Options): ((a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7) => Promise<R>) & events.EventEmitter;
function createCacherFromArgs<R, A1, A2, A3, A4, A5, A6, A7, A8>(f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8) => Promise<R> | R, maxAgeSeconds: number, options?: createCacherFromArgs.Options): ((a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8) => Promise<R>) & events.EventEmitter;
function createCacherFromArgs<R>(f: (...args: any[]) => Promise<R> | R, maxAgeSeconds: number, options?: createCacherFromArgs.Options) {
    const rootMap = new Map();
    const aggregateCacher = function(...args: any[]): Promise<R> {
        const cacher: (() => Promise<R>) | Map<any, any> = args.reduce((currentMap: Map<any, Map<any, any> | (() => Promise<R>)>, nextArg, i) => {
            if (!currentMap.has(nextArg)) {
                const mapValue = i === args.length - 1 ? buildCacher(() => f(...args), maxAgeSeconds, options, aggregateCacher) : new Map();
                currentMap.set(nextArg, mapValue);
            }
            const nextMap = currentMap.get(nextArg)!;
            return nextMap;
        }, rootMap);

        return cacher === rootMap ? rootCacher() : (cacher as () => Promise<R>)();
    } as ((...args: any[]) => Promise<R>) & events.EventEmitter;
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
