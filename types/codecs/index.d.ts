declare module "codecs" {
	export type encoder<T> = {
		encode: (message: T) => Uint8Array;
		decode: (buffer: Uint8Array) => T;
	};
	export type codec =
		| "utf8"
		| "json"
		| "ndjson"
		| "binary"
		| "hex"
		| "ascii"
		| "base64"
		| "ucs2"
		| "ucs-2"
		| "utf16le"
		| "utf-16le"
		| encoder;
	function codecs<T>(type: codec, fallback?: codec): encoder<T>;

	export default codecs;
}
