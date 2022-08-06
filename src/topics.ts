/// <reference path="../types/b4a/index.d.ts" />
/// <reference path="../types/collections/fast-map.d.ts" />
import b4a from "b4a";
import FastMap from "collections/fast-map";

export class Topics implements Map<Uint8Array, string | null> {
	protected store = new FastMap<Uint8Array, string | null>(
		null,
		b4a.equals,
		(k) => b4a.toString(k, "hex"),
	);
	protected counter = new FastMap<Uint8Array, number>(
		null,
		b4a.equals,
		(k) => b4a.toString(k, "hex"),
		() => 0,
	);

	constructor(iterable?: Iterable<[Uint8Array, string]>) {
		this.store.addEach(iterable || []);
		this.counter.addEach([...(iterable || [])].map(([k]) => [k, 1]));
	}

	get named(): FastMap<Uint8Array, string> {
		return this.store.filter((v) => !!v) as FastMap<Uint8Array, string>;
	}

	trending(named = true, limit = 20) {
		return new FastMap(
			[...(named ? this.named : this.store).entries()]
				.sort(([a], [b]) => this.counter.get(b) - this.counter.get(a))
				.slice(0, limit),
			b4a.equals,
			(k) => b4a.toString(k, "hex"),
		);
	}

	count(key: Uint8Array): number {
		return this.counter.get(key);
	}

	addMapChangeListener(
		listener: (
			value: string | null | undefined,
			key: Uint8Array,
			map: this,
		) => void,
		token?: string,
		beforeChange?: boolean,
	) {
		return this.store.addMapChangeListener(
			(value, key) => listener(value, key, this),
			token,
			beforeChange,
		);
	}

	get size(): number {
		return this.store.length;
	}

	clear(): void {
		this.store.clear();
		this.counter.clear();
	}

	delete(key: Uint8Array): boolean {
		const count = this.counter.get(key);
		if (count === 1)
			return this.store.delete(key) && this.counter.delete(key);
		this.counter.set(key, count - 1);
		return this.store.has(key);
	}

	get(key: Uint8Array): string | null | undefined {
		return this.store.get(key);
	}

	has(key: Uint8Array): boolean {
		return this.store.has(key);
	}

	set(key: Uint8Array, value: string | null): this {
		const count = this.counter.get(key);
		if (value && !this.store.get(key)) this.store.set(key, value);
		else if (!this.store.has(key)) this.store.set(key, value);
		this.counter.set(key, count + 1);
		return this;
	}

	[Symbol.iterator]() {
		return this.store.entries();
	}

	keys(): IterableIterator<Uint8Array> {
		return this.store.keys();
	}

	values(): IterableIterator<string | null> {
		return this.store.values();
	}

	entries(): IterableIterator<[Uint8Array, string | null]> {
		return this.store.entries();
	}

	forEach(
		callbackfn: (
			value: string | null,
			key: Uint8Array,
			map: Map<Uint8Array, string | null>,
		) => void,
		thisArg?: any,
	): void {
		this.store.forEach(
			(value, key) => callbackfn(value, key, this),
			thisArg,
		);
	}

	get [Symbol.toStringTag](): string {
		return "[object Topics]";
	}
}
