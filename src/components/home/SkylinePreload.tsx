import { SKYLINE_URL } from "@/lib/three/assetUrls";

/**
 * Kicks off the skyline GLB download as soon as the HTML parser reaches it,
 * in parallel with the JS bundle. HeroSequence's own preload() for this asset
 * can only run client-side (the device heuristic needs `navigator`), which on
 * slow links serialized the two largest downloads: bundle first, then the
 * 2.8 MB skyline. The street light GLB doesn't need this treatment — its
 * preload is unconditional, so React emits it in the SSR HTML already.
 *
 * The checks MUST mirror shouldLoadSkyline() (and onConstrainedNetwork) in
 * src/lib/three/quality.ts — change them together. The `as`/`crossOrigin`
 * pair must match the GLTFLoader fetch (anonymous) or the browser downloads
 * the file twice instead of reusing the preload.
 */
export function SkylinePreload() {
  const script =
    "(function(){try{" +
    "var n=navigator,c=n.connection||{};" +
    'if(c.saveData||/(^|-)2g$/.test(c.effectiveType||""))return;' +
    "if((n.hardwareConcurrency||4)<=2||(n.deviceMemory||4)<=2)return;" +
    'var l=document.createElement("link");' +
    'l.rel="preload";l.as="fetch";l.crossOrigin="anonymous";' +
    `l.href=${JSON.stringify(SKYLINE_URL)};` +
    "document.head.appendChild(l)" +
    "}catch(e){}})()";
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
