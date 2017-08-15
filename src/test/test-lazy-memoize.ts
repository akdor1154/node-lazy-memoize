import assert = require('assert');
import assertThrows = require('assert-throws-async');
import cacher = require('../lazy-memoize');

function wait(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}


describe('cacher', () => {
    it('should work with a synchronous function', async () => {
        let result = 42;
        const f = () => result;

        const c = cacher(f, 100);
        assert.strictEqual(await c(), result);
    });

    it('should cache a synchronous function', async () => {
        let result = 42;
        const f = () => result;
        const c = cacher(f, 100);
        await c();
        result = 43;
        assert.strictEqual(await c(), 42);
    });

    it('should refresh a synchronous function', async () => {
        let result = 42;
        const f = () => result;
        const c = cacher(f, 0);
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

        const c = cacher(f, 100);
        assert.strictEqual(await c(), result);
    });

    it('should cache an asynchronous function', async () => {
        let result = 42;
        const f = async () => {
            await wait(0);
            return result;
        }
        const c = cacher(f, 100);
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
        const c = cacher(f, 0);
        await c();
        result = 43;
        assert.strictEqual(await c(), 42);
        await wait(5); // wait for internal cache refresh
        assert.strictEqual(await c(), 43);
    });

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


});