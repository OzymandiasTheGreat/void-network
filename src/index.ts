/// <reference path="../types/hyperswarm/index.d.ts" />
/// <reference path="../types/hyperswarm__dht/index.d.ts" />
/// <reference path="../types/b4a/index.d.ts" />
import type { Duplex } from "stream";
import type { DHTOptions, Node } from "@hyperswarm/dht";
import Hyperswarm, {
	HyperswarmConstructorOptions,
	PeerDiscovery,
	PeerInfo,
} from "hyperswarm";
import sodium from "sodium-universal";
import b4a from "b4a";
import { VoidDHT } from "./dht";
import { VoidPresence } from "./presence";
import { codec } from "codecs";

export class VoidSwarm extends Hyperswarm<VoidDHT> {
	presence: VoidPresence;

	constructor(
		options?: HyperswarmConstructorOptions<VoidDHT> &
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
}
