declare module "@hyperswarm/dht" {
	import { EventEmitter } from "events";
	import { Duplex, Readable } from "stream";

	export type KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };
	export type Node = { host: string; port: number };
	export type HandshakePayload = {
		error: number;
		firewall: number;
		holepunch: number;
		addresses4: string[];
		addresses6: string[] | null;
		udx: {
			version: number;
			reusableSocket: boolean;
			id: number;
			seq: number;
		};
		secretStream: { version: number };
	};
	export type RawStream = Duplex & {
		id: number;
		remoteId: number;
		remoteHost: string;
		remotePort: number;
		remoteFamily: number;
		socket: Duplex;
	};
	export type EncryptedSocket = Duplex & {
		publicKey: Uint8Array;
		remotePublicKey: Uint8Array;
		rawStream: RawStream;
		on: (event: "open", callback: () => void) => EncryptedSocket;
	};

	export type DHTOptions = {
		keyPair?: KeyPair;
		bootstrap?: (string | Node)[];
		port?: number;
		bind?: number;
		udx?: any;
		nodes?: Node[];
		firewalled?: boolean;
		ephemeral?: boolean;
	};
	export type ServerOptions = {
		firewall?: (
			remotePublicKey: Uint8Array,
			remoteHandshakePayload: HandshakePayload,
			remoteAddress: Node,
		) => boolean;
	};

	class Server extends EventEmitter {
		dht: VoidDHT;
		target: Uint8Array;
		closed: boolean;
		firewall: (
			remotePublicKey: Uint8Array,
			remoteHandshakePayload: HandshakePayload,
			remoteAddress: Node,
		) => boolean;

		constructor(dht: VoidDHT, options?: ServerOptions);

		get publicKey(): Uint8Array;

		address(): ({ publicKey: Uint8Array } & Node) | null;
		close(): Promise<void>;
		listen(keyPair?: KeyPair): Promise<void>;
		refresh(): void;

		on(
			event: "connection",
			callback: (socket: EncryptedSocket) => void,
		): this;
		on(event: "listening", callback: () => void): this;
		on(event: "close", callback: () => void): this;
	}

	type ResponseOptions = {
		socket?: Duplex;
		to?: Node;
		token?: Uint8Array;
		closerNodes?: Node[] | boolean;
	};
	class Request {
		socket: Duplex;
		from: Node;
		to: Node;
		token: Uint8Array;
		command: number;
		target: Uint8Array;
		value: Uint8Array;

		reply(value: Uint8Array | null, options?: ResponseOptions): void;
		error(code: number, options?: ResponseOptions): void;
	}
	type RequestOptions = {
		retry?: boolean;
		socket?: Duplex;
	};
	type CommitCallback = (
		reply: Reply,
		dht: VoidDHT,
		query: any,
	) => Promise<void>;
	export type QueryStream = Readable & {
		finished: () => Promise<void>;
		closestNodes: Node[];
		closestReplies: Reply[];
	};
	type QueryOptions = {
		commit?: boolean | CommitCallback;
		nodes?: Node[];
		replies?: Reply[];
		map?: (reply: Reply) => any;
	};
	export type Reply = {
		tid: number;
		from: Node & { id: Uint8Array | null };
		to: Node & { id: Uint8Array | null };
		token: Uint8Array | null;
		closerNodes: Node[] | null;
		error: number;
		value: Uint8Array | null;
	};

	class VoidDHT extends EventEmitter {
		defaultKeyPair: KeyPair;
		defaultUserData: Uint8Array;
		id: Uint8Array;
		host: string | null;
		port: number;
		firewalled: boolean;
		destroyed: boolean;
		ephemeral: boolean;

		constructor(options?: DHTOptions);

		static keyPair(seed?: Uint8Array): KeyPair;
		static bootstrapper(port: number, options?: DHTOptions): this;

		ready(): Promise<void>;
		destroy(options?: { force?: true }): Promise<void>;
		address(): Node;
		createServer(
			options?: ServerOptions | ((socket: EncryptedSocket) => void),
			onconnection?: (socket: EncryptedSocket) => void,
		): Server;
		connect(
			remotePublicKey: Uint8Array,
			options?: {
				keyPair?: KeyPair;
				nodes?: Node[];
			},
		): EncryptedSocket;
		refresh(): void;
		lookup(topic: Uint8Array, options?: any): Readable;
		announce(
			topic: Uint8Array,
			keyPair: KeyPair,
			relayAddresses?: Node[],
			options?: any,
		): Readable;
		unannounce(
			topic: Uint8Array,
			keyPair: KeyPair,
			options?: any,
		): Promise<void>;
		immutablePut(
			value: Uint8Array,
			options?: any,
		): Promise<{ hash: Uint8Array; closestNodes: Node[] }>;
		immutableGet(
			hash: Uint8Array,
			options?: any,
		): Promise<{ value: Uint8Array; from: Node } | null>;
		mutablePut(
			keyPair: KeyPair,
			value: Uint8Array,
			options?: any,
		): Promise<{
			publicKey: Uint8Array;
			closestNodes: Node[];
			seq: number;
			signature: Uint8Array;
		}>;
		mutableGet(
			publicKey: Uint8Array,
			options?: { seq?: number; latest?: boolean },
		): Promise<{
			value: Uint8Array;
			from: Node;
			seq: number;
			signature: Uint8Array;
		} | null>;
		query(
			{
				target,
				command,
				value,
			}: { target: Uint8Array; command: number; value?: Uint8Array },
			options?: QueryOptions,
		): QueryStream;
		request(
			{
				token,
				target,
				command,
				value,
			}: {
				token?: Uint8Array;
				target?: Uint8Array;
				command: number;
				value?: Uint8Array;
			},
			to: Node,
			options?: RequestOptions,
		): Promise<Reply>;
		ping(
			to: Node,
			options?: RequestOptions & { size?: number },
		): Promise<Reply>;
		findNode(target: Uint8Array, options?: QueryOptions): QueryStream;
		addNode({ host, port }: Node): void;
		toArray(): Node[];

		on(event: "request", callback: (request: Request) => void): this;
		on(event: "bootstrap", callback: () => void): this;
		on(event: "listening", callback: () => void): this;
		on(event: "persistent", callback: () => void): this;
		on(event: "wake-up", callback: () => void): this;
		on(event: "network-change", callback: (interfaces: any) => void): this;
		on(event: string, callback: (...args: any[]) => void): this;
	}

	export default VoidDHT;
	export type { Server, Request };
}
