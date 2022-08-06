declare module "collections/fast-set" {
	type ChangeListener<T> = (plus: T[], minus: T[], index: number) => void;
	type PropertyChangeListener<T> = (
		value: T,
		key: string,
		object: Record<string, T>,
	) => void;

	class FastSet<T> {
		constructor(
			values?: Iterable<T> | null,
			equals?: (a: T, b: T) => boolean,
			hash?: (value: T) => string,
			getDefault?: () => T,
		);
		length: number;
		union(values: Iterable<T>): this;
		intersection(values: Iterable<T>): this;
		difference(values: Iterable<T>): this;
		symmetricDifference(values: Iterable<T>): this;
		has(value: T): boolean;
		get(value: T): T | undefined;
		add(value: T): boolean;
		delete(value: T): boolean;
		remove(value: T): boolean;
		contains(value: T): boolean;
		toggle(value: T): this;
		addEach(values?: Iterable<T>): this;
		deleteEach(values?: Iterable<T>, equals?: (value: T) => boolean): this;
		deleteAll(value: T, equals?: (value: T) => boolean): number;
		clear(): void;
		iterate(): IterableIterator<T>;
		iterator(): IterableIterator<T>;
		forEach(
			callback: (value: T, key: T, set: this) => void,
			thisp?: any,
		): void;
		map(
			callback: (value: T, index: number, set: this) => S,
			thisp?: any,
		): S[];
		filter(
			callback: (value: T, index: number, set: this) => boolean,
			thisp?: any,
		): this;
		reduce(
			callback: (
				accumulator: S,
				value: T,
				index: number,
				set: this,
			) => S,
			basis: S,
		): S;
		reduceRight(
			callback: (
				accumulator: S,
				value: T,
				index: number,
				set: this,
			) => S,
			basis: S,
		): S;
		group(
			callback: (value: T, key: T, set: this) => S,
			thisp?: any,
			equals?: (value: T) => boolean,
		): [S, T[]][];
		some(
			callback: (value: T, index: number, set: this) => boolean,
			thisp?: any,
		): boolean;
		every(
			callback: (value: T, index: number, set: this) => boolean,
			thisp?: any,
		): boolean;
		any(): boolean;
		all(): boolean;
		one(): T | undefined;
		only(): T | undefined;
		sorted(): T[];
		join(delimiter?: string): string;
		sum(zero?: number): number;
		average(): number;
		min(): number;
		max(): number;
		zip(...iterables: Iterable<S>[]): Array<[T, S]>;
		enumerate(start?: number): [number, T][];
		concat(...iterables: Iterable<T>[]): this;
		flatten(): Array<any>;
		toArray(): Array<T>;
		toObject(): Record<string, T>;
		toJSON(): string;
		equals(value: Iterable<T>, equals?: (value: T) => boolean): boolean;
		clone(depth?: number, memo?: boolean): this;
		contentEquals(left: T, right: T): boolean;
		contentHash(value: T): string;
		addRangeChangeListener(
			listener: ChangeListener<T>,
			token?: string,
			beforeChange?: boolean,
		): this;
		removeRangeChangeListener(
			listener: ChangeListener<T>,
			token?: string,
			beforeChange?: boolean,
		): this;
		dispatchRangeChange(
			plus: T[],
			minus: T[],
			index: number,
			beforeChange?: boolean,
		): this;
		addBeforeRangeChangeListener(
			listener: ChangeListener<T>,
			token?: string,
		): this;
		removeBeforeRangeChangeListener(
			listener: ChangeListener<T>,
			token?: string,
		): this;
		dispatchBeforeRangeChange(plus: T[], minus: T[], index: number): this;
		addOwnPropertyChangeListener(
			key: string,
			listener: PropertyChangeListener<T>,
			beforeChange?: boolean,
		): this;
		addBeforeOwnPropertyChangeListener(
			name: string,
			listener: PropertyChangeListener<T>,
		): this;
		removeOwnPropertyChangeListener(
			name: string,
			listener: PropertyChangeListener<T>,
			beforeChange?: boolean,
		): this;
		removeBeforeOwnPropertyChangeListener(
			key: string,
			listener: PropertyChangeListener<T>,
		): this;
		dispatchOwnPropertyChange(
			key: string,
			value: T,
			beforeChange?: boolean,
		): this;
		dispatchBeforeOwnPropertyChange(key: string, value: T): this;
		makePropertyObservable(name: string): this;
		makeObservable(): this;
	}

	export default FastSet;
}
