declare module "collections/fast-map" {
	type ChangeListener<K, V> = (
		value: V | undefined,
		key: K,
		map: Map<K, V>,
	) => void;
	type PropertyChangeListener<T> = (
		value: T,
		key: string,
		object: Record<string, T>,
	) => void;

	class FastMap<K, V> {
		constructor(
			values?: Iterable<[K, V]> | null,
			equals?: (a: K, b: K) => boolean,
			hash?: (key: K) => string,
			getDefault?: (key: K) => V,
		);
		length: number;
		has(key: K): boolean;
		get(key: K | number, deflt?: V): V;
		set(key: K, value: V): this;
		add(value: V, key: K): this;
		delete(key: K): boolean;
		keys(): IterableIterator<K>;
		values(): IterableIterator<V>;
		entries(): IterableIterator<[K, V]>;
		addEach(values: Iterable<[K, V]>): this;
		deleteEach(values: Iterable<K>, equals?: (key: K) => boolean): this;
		clear(): this;
		forEach(
			callback: (value: V, key: K, map: this) => void,
			thisp?: any,
		): void;
		map(callback: (value: V, key: K, map: this) => T, thisp?: any): T[];
		filter(
			callback: (value: V, key: K, map: this) => boolean,
			thisp?: any,
		): this;
		reduce(
			callback: (accumulator: T, value: V, key: K, map: this) => T,
			basis: T,
		): T;
		reduceRight(
			callback: (accumulator: T, value: V, key: K, map: this) => T,
			basis: T,
		): T;
		group(
			callback: (value: V, key: K, map: this) => T,
			thisp?: any,
			equals?: (key: K) => boolean,
		): [T, V[]][];
		some(
			callback: (value: V, key: K, map: this) => boolean,
			thisp?: any,
		): boolean;
		every(callback: (value: V, key: K) => boolean, thisp?: any): boolean;
		any(): boolean;
		all(): boolean;
		sorted(): V[];
		join(delimiter?: string): string;
		sum(zero?: number): number;
		average(): number;
		min(): number;
		max(): number;
		zip(...iterables: Iterable<[K, V]>[]): this;
		enumerate(start?: number): [number, V][];
		concat(...iterables: Iterable<V>[]): V[][];
		toArray(): V[];
		toObject(): Record<string, V>;
		toJSON(): string;
		equals(value: FastMap): boolean;
		clone(depth?: number, memo?: boolean): this;
		contentEquals(left: K, right: K): boolean;
		contentHash(value: K): string;
		addMapChangeListener(
			listener: ChangeListener<K, V>,
			token?: string,
			beforeChange?: boolean,
		): this;
		addBeforeMapChangeListener(
			listener: ChangeListener<K, V>,
			token?: string,
		): this;
		removeMapChangeListener(
			listener: ChangeListener<K, V>,
			token?: string,
			beforeChange?: boolean,
		): this;
		removeBeforeMapChangeListener(
			listener: ChangeListener<K, V>,
			token?: string,
		): this;
		dispatchMapChange(key: K, value: V, beforeChange?: boolean): this;
		dispatchBeforeMapChange(key: K, value: V): this;
		addOwnPropertyChangeListener(
			key: K,
			listener: PropertyChangeListener<V>,
			beforeChange?: boolean,
		): this;
		addBeforeOwnPropertyChangeListener(
			name: K,
			listener: PropertyChangeListener<V>,
		): this;
		removeOwnPropertyChangeListener(
			name: K,
			listener: PropertyChangeListener<V>,
			beforeChange?: boolean,
		): this;
		removeBeforeOwnPropertyChangeListener(
			key: K,
			listener: PropertyChangeListener<V>,
		): this;
		dispatchOwnPropertyChange(
			key: K,
			value: V,
			beforeChange?: boolean,
		): this;
		dispatchBeforeOwnPropertyChange(key: K, value: V): this;
		makePropertyObservable(name: K): this;
	}

	export default FastMap;
}
