declare module "@hyperswarm/dht" {
	import { EventEmitter } from "events";
	import { Duplex, Readable } from "stream";

	export type KeyPair = { publicKey: Buffer; secretKey: Buffer };
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
		publicKey: Buffer;
		remotePublicKey: Buffer;
		rawStream: RawStream;
		on: (event: "open", callback: () => void) => EncryptedSocket;
	};

	export type DHTOptions = {
		keyPair?: KeyPair;
		bootstrap?: (string | Node)[];
		port?: number;
		udx?: any;
		nodes?: Node[];
		firewalled?: boolean;
		ephemeral?: boolean;
	};
	export type ServerOptions = {
		firewall?: (
			remotePublicKey: Buffer,
			remoteHandshakePayload: HandshakePayload,
			remoteAddress: Node,
		) => boolean;
	};

	class Server extends EventEmitter {
		dht: VoidDHT;
		target: Buffer;
		closed: boolean;
		firewall: (
			remotePublicKey: Buffer,
			remoteHandshakePayload: HandshakePayload,
			remoteAddress: Node,
		) => boolean;

		constructor(dht: VoidDHT, options?: ServerOptions);

		get publicKey(): Buffer;

		address(): ({ publicKey: Buffer } & Node) | null;
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
		token?: Buffer;
		closerNodes?: Node[] | boolean;
	};
	class Request {
		socket: Duplex;
		from: Node;
		to: Node;
		token: Buffer;
		command: number;
		target: Buffer;
		value: Buffer;

		reply(value: Buffer | null, options?: ResponseOptions): void;
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
		from: Node & { id: Buffer | null };
		to: Node & { id: Buffer | null };
		token: Buffer | null;
		closerNodes: Node[] | null;
		error: number;
		value: Buffer | null;
	};

	class VoidDHT extends EventEmitter {
		defaultKeyPair: KeyPair;
		defaultUserData: Buffer;
		id: Buffer;
		host: string | null;
		port: number;
		firewalled: boolean;
		destroyed: boolean;
		ephemeral: boolean;

		constructor(options?: DHTOptions);

		static keyPair(seed?: Buffer): KeyPair;
		static bootstrapper(port: number, options?: DHTOptions): VoidDHT;

		ready(): Promise<void>;
		destroy(options?: { force?: true }): Promise<void>;
		address(): Node;
		createServer(
			options?: ServerOptions | ((socket: EncryptedSocket) => void),
			onconnection?: (socket: EncryptedSocket) => void,
		): Server;
		connect(
			remotePublicKey: Buffer,
			options?: {
				keyPair?: KeyPair;
				nodes?: Node[];
			},
		): EncryptedSocket;
		refresh(): void;
		lookup(topic: Buffer, options?: any): Readable;
		announce(
			topic: Buffer,
			keyPair: KeyPair,
			relayAddresses?: Node[],
			options?: any,
		): Readable;
		unannounce(
			topic: Buffer,
			keyPair: KeyPair,
			options?: any,
		): Promise<void>;
		immutablePut(
			value: Buffer,
			options?: any,
		): Promise<{ hash: Buffer; closestNodes: Node[] }>;
		immutableGet(
			hash: Buffer,
			options?: any,
		): Promise<{ value: Buffer; from: Node } | null>;
		mutablePut(
			keyPair: KeyPair,
			value: Buffer,
			options?: any,
		): Promise<{
			publicKey: Buffer;
			closestNodes: Node[];
			seq: number;
			signature: Buffer;
		}>;
		mutableGet(
			publicKey: Buffer,
			options?: { seq?: number; latest?: boolean },
		): Promise<{
			value: Buffer;
			from: Node;
			seq: number;
			signature: Buffer;
		} | null>;
		query(
			{
				target,
				command,
				value,
			}: { target: Buffer; command: number; value?: Buffer },
			options?: QueryOptions,
		): QueryStream;
		request(
			{
				token,
				target,
				command,
				value,
			}: {
				token?: Buffer;
				target?: Buffer;
				command: number;
				value?: Buffer;
			},
			to: Node,
			options?: RequestOptions,
		): Promise<Reply>;
		ping(
			to: Node,
			options?: RequestOptions & { size?: number },
		): Promise<Reply>;
		findNode(target: Buffer, options?: QueryOptions): QueryStream;
		addNode({ host, port }: Node): void;
		toArray(): Node[];

		on(event: "request", callback: (request: Request) => void): this;
		on(event: "bootstrap", callback: () => void): this;
		on(event: "listening", callback: () => void): this;
		on(event: "persistent", callback: () => void): this;
		on(event: "wake-up", callback: () => void): this;
		on(event: "network-change", callback: (interfaces: any) => void): this;
	}

	export default VoidDHT;
	export type { Server, Request };
}
