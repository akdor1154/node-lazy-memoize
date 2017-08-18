# lazy-memoize

Builds a transparent cache for a function. When the cache is outdated, it will be returned until the update function has completed (i.e. callers will never have to wait for updates after initialization.)

# Usage

```js
const cache = require('lazy-memoize');

async function doSomethingSlow(arg) {
	const result = await somethingSlow();
	return arg+result;
}

const doSomethingSlowCached = cache(doSomethingSlow, 60);

const something = await doSomethingSlowCached(); //slow;
const somethingAgain = await doSomethingSlowCached(); //fast;
// ..soon after 60 seconds
const somethingNew = await doSomethingSlowCached(); // fast, and refreshed.
```

```ts
function<T> cache(f: () => Promise<T>|T, maxAgeSeconds: number): () => Promise<T>
```

Builds a cacher for function `f`, which is invalidated and refreshed if called after `maxAgeSeconds` seconds. The cacher is called with no arguments and returns the result of `f`.
