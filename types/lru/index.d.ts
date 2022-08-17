declare module "lru" {
	class LRU {
		constructor(
			length:
				| number
				| {
						max: number;
						maxAge: number;
				  },
		);
		length: number;
		keys: string[];
		set<T>(key: string, value: T): T;
		get<T>(key: string): T | undefined;
		peek<T>(key: string): T | undefined;
		remove<T>(key: string): T | undefined;
		clear(): void;
		on(
			event: "evict",
			callback: <T>({ key, value }: { key: string; value: T }) => void,
		): void;
	}

	export default LRU;
}
