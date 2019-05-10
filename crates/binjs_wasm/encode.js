'use strict';

import fromShift from '../../src/source/from-shift';
import { parseScript } from 'shift-parser';

const VERSION = 'binjs-19';

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

    event.passThroughOnException();
    event.respondWith(handleBinJS(event));
});

async function handleBinJS(event) {
    try {
        const req = event.request;

        // return new Response("before");
        const {encodeMultipart} = await import("./pkg");
        return new Response("after");

        function log(...args) {
            args.unshift(req.url);

            console.log(...args);

            // event.waitUntil(
            //   fetch('...', {
            //     method: 'POST',
            //     body: args.join(' ')
            //   })
            // );
        }

        // const cache = await caches.open(VERSION);

        // {
        // 	let cacheRes = await cache.match(req);
        // 	log('cache match', !!cacheRes);
        // 	if (cacheRes) return cacheRes;
        // }

        const origRes = await fetch("https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment.min.js");

        let js = await origRes.clone().text();
        log('original response text', js.length);

        const shiftAST = parseScript(js, { earlyErrors: false });
        log('parsed');

        const bAST = transformLikeToJSON(shiftAST, fromShift);
        log('transformed');

        let encoded = encodeMultipart(bAST);
        log('encoded', encoded.length);

        const bastRes = new Response(encoded, origRes);
        bastRes.headers.delete('Content-Encoding');
        bastRes.headers.set('Content-Type', 'application/javascript-binast');
        bastRes.headers.append('Vary', 'Accept');
        log('created response');

        // await cache.put(req, bastRes);
        log('cached');
        return bastRes;
    } catch (e) {
        log('error', e.stack);
        return new Response(e.stack || e);
        throw e;
    }
}
