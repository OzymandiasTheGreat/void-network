/// <reference path="../types/hyperswarm/index.d.ts" />
/// <reference path="../types/hyperswarm__dht/index.d.ts" />
/// <reference path="../types/b4a/index.d.ts" />
import type { Duplex } from "stream";
import type { DHTOptions, EncryptedSocket, Node } from "@hyperswarm/dht";
import Hyperswarm, {
	HyperswarmConstructorOptions,
	PeerDiscovery,
	PeerInfo,
} from "hyperswarm";
import sodium from "sodium-universal";
import b4a from "b4a";
import { codec } from "codecs";
import FastMap from "collections/fast-map";
import FastSet from "collections/fast-set";
import Graph from "graphology";
import { VoidDHT } from "./dht";
import { Connection, State, VoidPresence } from "./presence";
import { Topics } from "./topics";

export class VoidSwarm extends Hyperswarm {
	dht!: VoidDHT;
	presence: VoidPresence;

	constructor(
		options?: Omit<HyperswarmConstructorOptions, "dht"> &
			DHTOptions & {
				userData?: Record<string, any>;
				encoding?: codec;
				debug?: { gossip?: boolean; presence?: boolean };
			},
	) {
		const dht = new VoidDHT(options);
		dht.on("broadcast", (message, origin) =>
			this.presence.onbroadcast(message, origin),
		);
		dht.on("message", (message, origin) =>
			this.presence.onmessage(message, origin),
		);
		dht.on("message-fallback", (message, origin, reply) => {
			reply(null);
			this.presence.onfallback(message, origin);
		});
		dht.on("persistent", () => this.presence.onstate(dht.ephemeral));
		dht.on("wake-up", () => this.presence.onstate(dht.ephemeral));

		super({ ...options, dht, keyPair: dht.defaultKeyPair });
		this.presence = new VoidPresence(
			this.keyPair.publicKey,
			options?.userData || {},
			options?.encoding || "json",
			(message: Uint8Array) => dht.broadcast(message),
			(target: Uint8Array, message: Uint8Array) =>
				dht.send(target, message),
			(
				target: Uint8Array,
				message: Uint8Array,
				to: Node,
				socket: Duplex,
			) =>
				dht
					.sendFallback(target, message, {}, to, socket)
					.then((reply) => !reply.error),
			options?.debug?.presence,
		);

		this.on("connection", (socket, info) =>
			this.presence.onpeeradd(socket, info),
		);

		this.presence.onAny((event, ...args) =>
			this.emit(event as string, ...args),
		);
	}

	protected _shouldRequeue(peerInfo: PeerInfo) {
		if (peerInfo.explicit) return true;
		const state = this.presence.getPeerState(peerInfo.publicKey);
		for (const topic of peerInfo.topics) {
			if (
				(state.announcing.has(topic) || state.lookingup.has(topic)) &&
				this._discovery.has(b4a.toString(topic, "hex")) &&
				!this.destroyed
			) {
				return true;
			}
		}
		return false;
	}

	join(
		topic: string | Uint8Array,
		options?: { client?: boolean; server?: boolean } | undefined,
	): PeerDiscovery {
		let name: string | null;
		let buffer: Uint8Array;
		if (b4a.isBuffer(topic)) {
			name = null;
			buffer = topic as Uint8Array;
		} else if ((topic as string).startsWith?.("#")) {
			name = topic as string;
			buffer = b4a.allocUnsafe(32);
			sodium.crypto_generichash(buffer, b4a.from(topic));
		} else {
			throw new Error("Topic must be an Uint8Array or hashtag");
		}
		this.presence.onjoin(buffer, name, options);
		return super.join(buffer, options);
	}

	leave(topic: string | Uint8Array): Promise<void> {
		let buffer: Uint8Array;
		if (b4a.isBuffer(topic)) {
			buffer = topic as Uint8Array;
		} else if ((topic as string).startsWith?.("#")) {
			buffer = b4a.allocUnsafe(32);
			sodium.crypto_generichash(buffer, b4a.from(topic));
		} else {
			throw new Error("Topic must be an Uint8Array or hashtag");
		}
		return super.leave(buffer).then(() => this.presence.onleave(buffer));
	}

	getPeerEphemeral(publicKey: Uint8Array): boolean {
		return this.presence.getPeerState(publicKey).ephemeral;
	}

	getPeerTopics(publicKey: Uint8Array): {
		client: FastMap<Uint8Array, string | null>;
		server: FastMap<Uint8Array, string | null>;
	} {
		const state = this.presence.getPeerState(publicKey);
		return {
			client: state.lookingup.clone(),
			server: state.announcing.clone(),
		};
	}

	getPeerConnectedTo(publicKey: Uint8Array): FastSet<Uint8Array> {
		return this.presence.getPeerState(publicKey).connected.clone();
	}

	getPeerUserData(publicKey: Uint8Array): Record<string, any> {
		return this.presence.getPeerState(publicKey).userData;
	}

	get userData(): Record<string, any> {
		return this.presence.userData;
	}

	set userData(data: Record<string, any>) {
		this.presence.userData = data;
	}

	updateUserData(data: Record<string, any>) {
		return this.presence.updateUserData(data);
	}

	get graph(): Graph<State> {
		return this.presence.graph.copy();
	}

	get bootstrapped(): boolean {
		return this.presence.bootstrapped;
	}

	get online(): FastSet<Uint8Array> {
		return this.presence.online.clone();
	}

	get topics(): Topics {
		return this.presence.topics;
	}

	broadcast(message: Uint8Array): Promise<boolean> {
		return this.presence.broadcast(this.presence.encodeBroadcast(message));
	}

	send(target: Uint8Array, message: Uint8Array): Promise<boolean> {
		return this.presence.send(
			target,
			this.presence.encodeMessage(message),
		);
	}

	on(
		event: "connection",
		listener: (socket: EncryptedSocket, info: PeerInfo) => void,
	): this;
	on(event: "bootstrap", listener: () => void): this;
	on(
		event: "peer-join-seen",
		listener: (source: Uint8Array, target: Uint8Array) => void,
	): this;
	on(
		event: "peer-leave-seen",
		listener: (source: Uint8Array, target: Uint8Array) => void,
	): this;
	on(event: "peer-online", listener: (peer: Uint8Array) => void): this;
	on(event: "peer-offline", listener: (peer: Uint8Array) => void): this;
	on(
		event: "peer-join",
		listener: (peer: Uint8Array, connection: Connection) => void,
	): this;
	on(event: "peer-leave", listener: (peer: Uint8Array) => void): this;
	on(
		event: "peer-topic-join",
		listener: (
			topic: Uint8Array,
			meta: { name: string | null; client: boolean; server: boolean },
			peer: Uint8Array,
		) => void,
	): this;
	on(
		event: "peer-topic-leave",
		listener: (topic: Uint8Array, peer: Uint8Array) => void,
	): this;
	on(
		event: "topic-join",
		listener: (topic: Uint8Array, name: string | null) => void,
	): this;
	on(event: "topic-leave", listener: (topic: Uint8Array) => void): this;
	on(event: "online", listener: (online: FastSet<Uint8Array>) => void): this;
	on(
		event: "broadcast",
		listener: (message: Uint8Array, origin: Uint8Array) => void,
	): this;
	on(
		event: "message",
		listener: (message: Uint8Array, origin: Uint8Array) => void,
	): this;
	on(event: string, listener: (...args: any[]) => void): this {
		return super.on(event as any, listener);
	}
}
