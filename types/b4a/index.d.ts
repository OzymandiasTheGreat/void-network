/// <reference types="node" />
declare module "b4a" {
	export function isBuffer(value: any): boolean;
	export function isEncoding(encoding: BufferEncoding): boolean;
	export function alloc(
		size: number,
		fill?: any,
		encoding?: BufferEncoding,
	): Uint8Array;
	export function allocUnsafe(size: number): Uint8Array;
	export function allocUnsafeSlow(size: number): Uint8Array;
	export function byteLength(string: string): number;
	export function compare(buf1: Uint8Array, buf2: Uint8Array): number;
	export function concat(
		buffers: Uint8Array[],
		totalLength?: number,
	): Uint8Array;
	export function copy(
		source: Uint8Array,
		target: Uint8Array,
		targetStart?: number,
		sourceStart?: number,
		sourceEnd?: number,
	): void;
	export function equals(buf1: Uint8Array, buf2: Uint8Array): boolean;
	export function fill(
		buffer: Uint8Array,
		value: any,
		offset?: number | BufferEncoding,
		end?: number,
	): Uint8Array;
	export function from(array: Array): Uint8Array;
	export function from(
		arrayBuffer: ArrayBuffer,
		byteOffset?: number,
		length?: number,
	): Uint8Array;
	export function from(buffer: Uint8Array): Uint8Array;
	export function from(
		string: string,
		encoding?: BufferEncoding,
	): Uint8Array;
	export function includes(
		buffer: Uint8Array,
		value: number,
		byteOffset?: number | BufferEncoding,
	): boolean;
	export function indexOf(
		buffer: Uint8Array,
		value: number,
		byteOffset?: number | BufferEncoding,
	): number;
	export function lastIndexOf(
		buffer: Uint8Array,
		value: number,
		byteOffset?: number | BufferEncoding,
	): number;
	export function swap16(buffer: Uint8Array): Uint8Array;
	export function swap32(buffer: Uint8Array): Uint8Array;
	export function swap64(buffer: Uint8Array): Uint8Array;
	export function toBuffer(buffer: Uint8Array): Uint8Array;
	export function toString(
		buffer: Uint8Array,
		encoding?: BufferEncoding,
		start?: number,
		end?: number,
	): string;
	export function write(
		buffer: Uint8Array,
		string: string,
		offset?: number | BufferEncoding,
		length?: number,
	): Uint8Array;
	export function writeDoubleLE(
		buffer: Uint8Array,
		value: number,
		offset?: number,
	): Uint8Array;
	export function writeFloatLE(
		buffer: Uint8Array,
		value: number,
		offset?: number,
	): Uint8Array;
	export function writeUInt32LE(
		buffer: Uint8Array,
		value: number,
		offset?: number,
	): Uint8Array;
	export function writeInt32LE(
		buffer: Uint8Array,
		value: number,
		offset?: number,
	): Uint8Array;
	export function readDoubleLE(buffer: Uint8Array, offset?: number): number;
	export function readFloatLE(buffer: Uint8Array, offset?: number): number;
	export function readUInt32LE(buffer: Uint8Array, offset?: number): number;
	export function readInt32LE(buffer: Uint8Array, offset?: number): number;
}
