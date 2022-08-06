/// <reference types="node" />
/// <reference path="../hyperswarm__dht/index.d.ts" />
declare module "hyperswarm" {
	import type { EncryptedSocket, KeyPair, Server } from "@hyperswarm/dht";

	export type HyperswarmConstructorOptions<T> = {
		keyPair?: KeyPair;
		seed?: Uint8Array;
		maxPeers?: number;
		firewall?: (remotePublicKey: Uint8Array) => boolean;
		dht?: T;
	};

	class PeerDiscovery {
		flushed(): Promise<void>;
		refresh(opts: { client: boolean; server: boolean }): Promise<void>;
		destroy(): Promise<void>;
	}

	class PeerInfo {
		publicKey: Uint8Array;
		topics: Uint8Array[];
		client: boolean;
		explicit: boolean;
		reconnecting: boolean;
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
		destroyed: boolean;

		protected _discovery: Map<string, PeerDiscovery>;
		protected emit(event: string, ...args: any[]): boolean;

		join(
			topic: Uint8Array,
			options?: { client?: boolean; server?: boolean },
		): PeerDiscovery;
		leave(topic: Uint8Array): Promise<void>;
		joinPeer(publicKey: Uint8Array): void; // TODO Double check return type
		leavePeer(publicKey: Uint8Array): void;
		status(topic: Uint8Array): PeerDiscovery;
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
