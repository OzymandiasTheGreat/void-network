/// <reference path="../types/hyperswarm/index.d.ts" />
/// <reference path="../types/hyperswarm__dht/index.d.ts" />
import type { Duplex } from "stream";
import type { DHTOptions, Node } from "@hyperswarm/dht";
import Hyperswarm, { HyperswarmConstructorOptions } from "hyperswarm";
import { VoidDHT } from "./dht";
import { VoidPresence } from "./presence";

export class VoidSwarm extends Hyperswarm<VoidDHT> {
	presence: VoidPresence;

	constructor(
		options?: HyperswarmConstructorOptions<VoidDHT> &
			DHTOptions & {
				userData?: Record<string, any>;
				debug?: { gossip?: boolean };
			},
	) {
		let dht: VoidDHT;
		if (options?.dht) {
			if (options.dht instanceof VoidDHT) {
				dht = options.dht;
			} else {
				throw new Error("dht must be instance of VoidDHT");
			}
		} else {
			dht = new VoidDHT(options);
		}
		super({ ...options, dht });
		this.presence = new VoidPresence(
			this.keyPair.publicKey,
			{
				ephemeral: dht.ephemeral,
				connected: new Set(),
				announcing: new Set(),
				lookingup: new Set(),
				userData: options?.userData || {},
			},
			(message: Buffer) => dht.broadcast(message),
			(target: Buffer, message: Buffer) => dht.send(target, message),
			(target: Buffer, message: Buffer, to: Node, socket: Duplex) =>
				dht.sendFallback(target, message, {}, to, socket),
			options?.debug?.gossip,
		);
		dht.on("broadcast", (message, origin) =>
			this.presence.onbroadcast(message, origin),
		);
		dht.on("message", (message, origin) =>
			this.presence.onmessage(message, origin),
		);
		dht.on("message-fallback", (message, origin, reply) =>
			this.presence.onfallback(message, origin, reply),
		);
		dht.on("persistent", () => {
			const status = {
				...this.presence.status,
				ephemeral: dht.ephemeral,
			};
			this.presence.status = status;
		});
		dht.on("wake-up", () => {
			const status = {
				...this.presence.status,
				ephemeral: dht.ephemeral,
			};
		});
		this.on("connection", (socket, info) =>
			this.presence.onpeeradd(socket, info),
		);
	}
}
