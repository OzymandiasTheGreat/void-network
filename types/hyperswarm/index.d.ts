/// <reference types="node" />
/// <reference path="../hyperswarm__dht/index.d.ts" />
declare module "hyperswarm" {
	import type { EncryptedSocket, KeyPair, Server } from "@hyperswarm/dht";

	export type HyperswarmConstructorOptions<T> = {
		keyPair?: KeyPair;
		seed?: Buffer;
		maxPeers?: number;
		firewall?: (remotePublicKey: Buffer) => boolean;
		dht?: T;
	};

	class PeerDiscovery {
		flushed(): Promise<void>;
		refresh(opts: { client: boolean; server: boolean }): Promise<void>;
		destroy(): Promise<void>;
	}

	class PeerInfo {
		publicKey: Buffer;
		topics: Buffer[];
		prioritized: boolean;
		client: boolean;
		ban(): void;
	}

	class Hyperswarm<T> {
		constructor(options?: HyperswarmConstructorOptions<T>);

		keyPair: KeyPair;
		connections: Set<any>; // TODO Double check type
		peers: Map<string, PeerInfo>;
		dht: T;
		server: Server;
		maxPeers: number;

		protected emit(event: string, ...args: any[]): boolean;

		join(
			topic: Buffer,
			opts: { client: boolean; server: boolean },
		): PeerDiscovery;
		leave(topic: Buffer): Promise<void>;
		joinPeer(noisePublicKey: Buffer): void; // TODO Double check return type
		leavePeer(noisePublicKey: Buffer): void;
		status(topic: Buffer): PeerDiscovery;
		listen(): Promise<void>;
		flush(): Promise<void>;
		destroy(): Promise<void>;

		on(
			event: "connection",
			cb: (socket: EncryptedSocket, info: PeerInfo) => void,
		): void;
	}

	export default Hyperswarm;
	export type { KeyPair, PeerInfo, PeerDiscovery };
}
