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
function<T> cache(f: (A1, A2, ...) => Promise<T>|T, maxAgeSeconds: number): (A1, A2, ...) => Promise<T>
```

Builds a cacher for function `f`, which is invalidated and refreshed if called after `maxAgeSeconds` seconds. The cacher can then be called with no arguments, and returns the result of `f`.
