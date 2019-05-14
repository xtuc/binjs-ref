'use strict';

import fromShift from '../../src/source/from-shift';
import { parseScript } from 'shift-parser';
import initWASM, { encodeMultipart } from './pkg';

const VERSION = 'binjs-21';

function createBinASTRes(content) {
    const bastRes = new Response(content);
    bastRes.headers.set('X-Worker-Cache', 'HIT');
    // bastRes.headers.delete('Content-Encoding');
    bastRes.headers.set('Content-Type', 'application/javascript-binast');
    bastRes.headers.append('Vary', 'Accept');
    return bastRes;
}
function fetchOrigin(path) {
  // return fetch("https://xtuc.github.io/binjs-demo/build" + path);
  return fetch("https://www.apple.com" + path);
}
function toExtBinJs(path) {
  const parts = path.split(".");
  parts[parts.length - 1] = "binjs";
  return parts.join(".");
}

function transformLikeToJSON(obj, callback) {
	return (function transform(obj, k, v) {
		obj[k] = v = callback.call(obj, k, v);

		if (typeof v === 'object' && v !== null) {
			for (let k in v) {
				transform(v, k, v[k]);
			}
		}

		return v;
	})({ '': obj }, '', obj);
}

addEventListener('fetch', event => {
	// if (event.request.method !== 'GET') return;

	// let url = new URL(event.request.url);
	// if (!url.pathname.endsWith('.js')) return;

	// let accept = event.request.headers.get('Accept') || '';
	// if (!accept.startsWith('application/javascript-binast')) return;

	// event.passThroughOnException();
	event.respondWith(handleBinJS(event));
});

async function handleBinJS(event) {
  const req = event.request;
  let path = (new URL(req.url)).pathname;
  const supportBinJs = req.headers.get("Accept")
    .split(",").includes("application/javascript-binast");
  const lastSegment = path.substring(path.lastIndexOf('/'))
  const serveBinJs = lastSegment.endsWith(".js") && supportBinJs;

  if (lastSegment.indexOf('.') === -1) {
    path += '/index.html'
  }

	async function log(...args) {
		args.unshift(req.url);
		console.log(...args);
        await fetch('https://lip-branches-shape-administrator.trycloudflare.com/add', {
            method: 'POST',
            body: args.join(' ')
        });
	}

	try {
        if (serveBinJs === false) {
          return fetchOrigin(path);
        }
        const cache = await caches.open(VERSION);

        {
			let cacheRes = await cache.match(req);
			log('cache match', !!cacheRes);
			if (cacheRes) return cacheRes;
		}

		// {
		// 	let cachedBast = await kv.get(path);
		// 	if (cachedBast !== null) {
                // await log('cache matched');
                // return createBinASTRes(toUint8Array(cachedBast));
            // }
		// }

        // let origReq = new Request(req);
        // origReq.headers.set('Accept', '*/*');
        // origRes = await fetch(origReq);
        const origRes = await fetchOrigin(path);
        // log('original response', origRes && origRes.statusText);
        if (!origRes.ok) return origRes;

        const js = await origRes.clone().text();

        // too big to transform
        if (js.length > 300 * 1024) {
            await log('aborting; too big to transform (~' + js.length / 1024 + 'kb)');
            return origRes;
        }

		event.waitUntil(
			(async function transformAndCache() {
				try {
                    await log('init wasm');
                    await initWASM(wasmprogram);
                    await log('init wasm - ok');

					await log('original response text', js.length);

					const shiftAST = parseScript(js, { earlyErrors: false });
					await log('parsed');

					const bAST = transformLikeToJSON(shiftAST, fromShift);
					await log('transformed');

					let encoded = encodeMultipart(bAST);
					await log('encoded', encoded.length);

                    await cache.put(req, createBinASTRes(encoded));
					// await kv.put(path, toString(encoded));
					await log('cached');
				} catch (e) {
					await log('error', e.stack);
                    throw e;
				}
			})()
		);

		return origRes;
	} catch (e) {
		await log('error', e.stack);
        return new Response(e.stack);
	}
}
