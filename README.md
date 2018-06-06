# lazy-memoize

Builds a transparent cache for a function. When the cache is outdated, it will be returned until the update function has completed (i.e. callers will never have to wait for updates after initialization.)

# Example

```js
const cache = require('lazy-memoize');

async function doSomethingSlow(arg) {
	const result = await somethingSlow();
	return arg+result;
}

const doSomethingSlowCached = cache(doSomethingSlow, 60);

const something = await doSomethingSlowCached(123); //slow;
const somethingAgain = await doSomethingSlowCached(123); //fast;
// ..soon after 60 seconds
const somethingNew = await doSomethingSlowCached(123); // fast, and refreshed.
```

# Usage

```ts
function<T> cache(f: (A1, A2, ...) => Promise<T>, maxAgeSeconds: number, options?: Options): ((A1, A2, ...) => Promise<T>) & EventEmitter
```

Builds a cacher for function `f`, which is invalidated and refreshed if called after `maxAgeSeconds` seconds. The cacher can then be called with no arguments, and returns the result of `f`.

## Options

### errors

The `errors` option controls cache behaviour if `f` throws.

### `errors = 'passthrough'` :

If `f` throws an error and `c = cache(f)`, `c()` will throw that error until the cache is invalidated and refreshed. `c` does not emit any events. This is the default behvaiour.

### `errors = 'swallow'` :

If `f` throws an error and `c = cache(f)`, `c()` will return the last successful operation before `f()` threw. The cache will only be marked as fresh if the refresh call of `f()` does not throw, so future calls of `c()` will continue to trigger `f()` regardless of cache age, until `f()` eventually succeeds. If `f()` fails but has never previously succeeded, `c()` will throw whatever `f()` threw. If a call to `f` throws, `c` will emit an `error` event, which can (and should) be handled with a `c.on('error', (e) => { ... } )` listener.

This behaviour is designed for a function that takes a long time and occasionally fails, but in case of failures, you'd rather just try again. For example, a connection to a crappy old SAP server that sometimes times out for no reason.

# Breaking Changes

## v2.0.0

-   Requires Node >= 8
-   f() must now return a Promise (the carrot to this stick is that your cached functions now share parameter names and types with the wrapped functions, so IDEs will show better autocomplete for cached functions)
