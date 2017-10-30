import assert = require('assert');
import assertThrows = require('assert-throws-async');
import cacher = require('../lazy-memoize');
import sms = require('source-map-support');
sms.install();

function wait(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

function runTests(options: cacher.Options) {

    describe('cacher', () => {
        it('should work with a synchronous function', async () => {
            let result = 42;
            const f = () => result;
    
            const c = cacher(f, 100, options);
            assert.strictEqual(await c(), result);
        });
    
        it('should cache a synchronous function', async () => {
            let result = 42;
            const f = () => result;
            const c = cacher(f, 100, options);
            await c();
            result = 43;
            assert.strictEqual(await c(), 42);
        });
    
        it('should refresh a synchronous function', async () => {
            let result = 42;
            const f = () => result;
            const c = cacher(f, 0, options);
            await c();
            result = 43;
            assert.strictEqual(await c(), 42);
            await wait(5); // wait for internal cache refresh
            assert.strictEqual(await c(), 43);
        });
    
        it('should work with an asynchronous function', async () => {
            let result = 42;
            const f = async () => {
                await wait(0);
                return result;
            }
    
            const c = cacher(f, 100, options);
            assert.strictEqual(await c(), result);
        });
    
        it('should cache an asynchronous function', async () => {
            let result = 42;
            const f = async () => {
                await wait(0);
                return result;
            }
            const c = cacher(f, 100, options);
            await c();
            result = 43;
            assert.strictEqual(await c(), 42);
        });
    
        it('should refresh an asynchronous function', async () => {
            let result = 42;
            const f = async () => {
                await wait(0);
                return result;
            }
            const c = cacher(f, 0, options);
            await c();
            result = 43;
            assert.strictEqual(await c(), 42);
            await wait(5); // wait for internal cache refresh
            assert.strictEqual(await c(), 43);
        });
    
    
        describe('update lock', () => {
            let i = 0;
            let j = 0;
            const f = async () => { 
                i++;
                await wait(5);
                j++;
            }
    
            const c = cacher(f, 10 * 0.001);
    
            it('should only run one update at a time', async () => {
                await c(); // call once
                await wait(20); // cache expire
                await c(); // call again
                await c(); // should not call again.
                await wait(10);
                assert.deepStrictEqual(i, 2);
                assert.deepStrictEqual(j, 2);
            })
        })
    
        it('should work with a function that takes arguments', async () => {
            let result1 = 42;
            let result2 = -42;
            const f = (x: Boolean) => (x) ? result1 : result2;
            const cachedF = cacher(f, 100);
            assert.strictEqual(await cachedF(true), 42);
            assert.strictEqual(await cachedF(false), -42);
            result1 = 1;
            result2 = -2;
            assert.strictEqual(await cachedF(true), 42);
            assert.strictEqual(await cachedF(false), -42);
        })
    
        it('should work with a function that takes multi level arguments', async () => {
            const callMap = new Map();
    
            const f = async <A1 extends number, A2 extends number, A3 extends number>(n1: A1, n2: A2, n3: A3) => {
                if (!callMap.has(n1)) { callMap.set(n1, new Map()) };
                const callMap2 = callMap.get(n1);
                if (!callMap2.has(n2)) { callMap2.set(n2, new Map()) };
                const callMap3 = callMap2.get(n2);
                const calls = (callMap3.get(n3) || 0 ) + 1;
                callMap3.set(n3, calls);
                return {value: n1 + n2 + n3, calls}
            }
    
            const cachedF = cacher(f, 0);
            assert.deepStrictEqual(await cachedF(1, 2, 3), {value: 6, calls: 1});
            assert.deepStrictEqual(await cachedF(1, 2, 3), {value: 6, calls: 1});
            await wait(10);
            assert.deepStrictEqual(await cachedF(1, 2, 3), {value: 6, calls: 2});
        })
    });
}

describe('with no options', () => {
    runTests(undefined!);
})

describe('with errors = passthrough', () => {
    runTests({errors: 'passthrough'});

    class MyError extends Error { };
    
    describe('throwing synchronous function', () => {
        const f = () => {
            throw new MyError();
        }

        const c = cacher(f, 0);


        it('should throw once', async () => {
            await assertThrows(async () => await c(), MyError);
        });

        it('should throw twice', async () => {
            await assertThrows(async () => await c(), MyError);
            await assertThrows(async () => await c(), MyError);
        })
    });


    describe('throwing asynchronous function', () => {
        const f = async () => {
            await wait(0);
            throw new MyError();
        }

        const c = cacher(f, 0);


        it('should throw once', async () => {
            await assertThrows(async () => await c(), MyError);
        });

        it('should throw twice', async () => {
            await assertThrows(async () => await c(), MyError);
            await assertThrows(async () => await c(), MyError);
        })
    });

    describe('refreshing a throwing asynchronous function', () => {
        let calls = 0;
        const f = async () => {
            await wait(5);
            calls++;
            throw new MyError();
        }

        const c = cacher(f, 0);
        it('should throw once', async () => {
            await assertThrows(() => c(), MyError);
            assert.strictEqual(calls, 1);
            await assertThrows(() => c(), MyError); // triggers refresh but returns cached value in the meantime
            assert.strictEqual(calls, 1);
        })

        it('should refresh the cache', async () => {
            await wait(10);
            assert.strictEqual(calls, 2); // refresh has completed by now
            await assertThrows(() => c(), MyError);
            assert.strictEqual(calls, 2); // triggers refresh but returns cached value in the meantime.
        });
    });


});

describe('with errors = swallow', () => {
    runTests({errors: 'swallow'});

    class MyError extends Error {
        constructor() {
            super();
            Error.captureStackTrace(this);
            this.name = MyError.name;

        }
    };

    describe('throwing synchronous function that has never succeeded', () => {
        let enableThrow = true;
        const f = () => {
            if (enableThrow) {
                throw new MyError();
            } else {
                return true;
            }
        }

        const c = cacher(f, 0, {errors: 'swallow'});


        it('should throw once', async () => {
            enableThrow = true;
            await assertThrows(async () => await c(), MyError);
        });

        it('should throw twice', async () => {
            enableThrow = true;
            await assertThrows(async () => await c(), MyError);
            await assertThrows(async () => await c(), MyError);
        })

        it('should eventually succeed', async () => {
            enableThrow = false;
            assert.strictEqual(await c(), true);
        });

    });

    describe('throwing asynchronous function that has succeeded', () => {
        let enableThrow = false;
        let calls = 0;

        const f = async () => {
            calls++;
            await wait(0);
            if (enableThrow) {
                throw new MyError();
            } else {
                return calls;
            }
        }

        const c = cacher(f, 0, {errors: 'swallow'});

        it('should succeed first', async () => {
            enableThrow = false;
            assert.strictEqual(await c(), 1);
            assert.strictEqual(calls, 1);
        });

        it('should preserve the previous result if a second call throws', async () => {
            enableThrow = true;
            let result = undefined
            await new Promise(async (resolve, reject) => {

                const listener = (e: Error) => {
                    assert(e instanceof MyError);
                    c.removeListener('error', listener);
                    resolve();
                };
                
                c.on('error', listener);

                result = await c();
            });

            assert.strictEqual(result, 1);
            assert.strictEqual(calls, 2);
                
        });
        it('should preserve the previous result if a third call throws', async () => {
            enableThrow = true;
            let result = undefined
            await new Promise(async (resolve, reject) => {

                const listener = (e: Error) => {
                    assert(e instanceof MyError);
                    c.removeListener('error', listener);
                    resolve();
                };
                
                c.on('error', listener);
                result = await c();
            });


            assert.strictEqual(await result, 1);
            assert.strictEqual(calls, 3);
        })
        it('should refresh the result if a fourth call succeeds', async () => {
            enableThrow = false;
            assert.strictEqual(await c(), 1); // triggers update, but does not wait
            await wait(4);
            assert.strictEqual(await c(), 4); // triggers update, but does not wait
            assert.strictEqual(calls, 5);
        })
    });



    describe('throwing asynchronous function', () => {
        const f = async () => {
            await wait(0);
            throw new MyError();
        }

        const c = cacher(f, 0, {errors: 'swallow'});


        it('should throw once', async () => {
            await assertThrows(async () => await c(), MyError);
        });

        it('should throw twice', async () => {
            await assertThrows(async () => await c(), MyError);
            await assertThrows(async () => await c(), MyError);
        })
    });
});