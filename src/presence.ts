/// <reference path="../types/codecs/index.d.ts" />
/// <reference path="../types/hyperswarm/index.d.ts" />
import { EventEmitter2 } from "eventemitter2";
import Graph from "graphology";
import { bidirectional } from "graphology-shortest-path";
import codecs from "codecs";
import type { Duplex } from "stream";
import type { EncryptedSocket, Node, Reply } from "@hyperswarm/dht";
import type { PeerInfo } from "hyperswarm";
import { GossipPacket, PeerState, PacketType } from "./messages";

type PeerStatus = {
	ephemeral: boolean;
	lookingup: Set<string>;
	announcing: Set<string>;
	connected: Set<string>;
	userData: Record<string, any>;
};
type Broadcast = (message: Buffer) => Promise<boolean>;
type Send = (target: Buffer, message: Buffer) => Promise<boolean>;
type Fallback = (
	target: Buffer,
	message: Buffer,
	to: Node,
	socket: Duplex,
) => Promise<Reply>;

const encoder = codecs<Record<string, any>>("json");
let debug: (message: string, ...args: any[]) => void;

function status2state(status?: Partial<PeerStatus> | null): PeerState {
	const userData: Buffer = encoder.encode(status?.userData ?? {});
	const lookingup = [...(status?.lookingup || [])].map((topic) =>
		Buffer.from(topic, "hex"),
	);
	const announcing = [...(status?.announcing || [])].map((topic) =>
		Buffer.from(topic, "hex"),
	);
	const connected = [...(status?.connected || [])].map((peer) =>
		Buffer.from(peer, "hex"),
	);
	return {
		ephemeral: status?.ephemeral ?? true,
		lookingup,
		announcing,
		connected,
		userData,
	};
}

function state2status(state?: Partial<PeerState> | null): PeerStatus {
	const userData: Record<string, any> = encoder.decode(
		state?.userData || encoder.encode({}),
	);
	const lookingup = new Set(
		state?.lookingup?.map((topic) => topic.toString("hex")) || undefined,
	);
	const announcing = new Set(
		state?.lookingup?.map((topic) => topic.toString("hex")) || undefined,
	);
	const connected = new Set(
		state?.connected?.map((peer) => peer.toString("hex")) || undefined,
	);
	return {
		ephemeral: state?.ephemeral || true,
		lookingup,
		announcing,
		connected,
		userData,
	};
}

function encode(message: GossipPacket): Buffer {
	try {
		return GossipPacket.encode(message);
	} catch (err) {
		debug("Failed to encode packet", message, err);
		return Buffer.allocUnsafe(0);
	}
}

function decode(buffer: Buffer): GossipPacket {
	try {
		return GossipPacket.decode(buffer);
	} catch (err) {
		debug("Failed to decode packet", buffer, err);
		return {
			type: 0,
		};
	}
}

function getNodeAttributes(graph: Graph<PeerStatus>, key: string): PeerStatus {
	try {
		return graph.getNodeAttributes(key);
	} catch (err) {
		debug("Missing node", key, err);
		return state2status();
	}
}

export class VoidPresence extends EventEmitter2 {
	publicKey: Buffer;
	graph: Graph<PeerStatus>;
	bootstrapped = false;
	online: Set<string>;

	protected id: string;
	protected _status: PeerStatus;
	protected _broadcast: Broadcast;
	protected _send: Send;
	protected _fallback: Fallback;
	protected _connections: Map<string, EncryptedSocket> = new Map();
	protected _debug: boolean;

	constructor(
		publicKey: Buffer,
		status: PeerStatus,
		broadcast: Broadcast,
		send: Send,
		fallback: Fallback,
		debug?: boolean,
	) {
		super({ wildcard: true });
		this._debug = debug ?? false;
		(global as any).debug = this.debug.bind(this);

		this.publicKey = publicKey;
		this.id = publicKey.toString("hex");
		this.graph = new Graph({
			type: "undirected",
			multi: false,
		});
		this._status = status;
		this.online = new Set([this.id]);

		this._broadcast = broadcast;
		this._send = send;
		this._fallback = fallback;

		this.graph.on("edgeAdded", ({ source, target }) => {
			this.emit(
				"peer-add-seen",
				Buffer.from(source, "hex"),
				Buffer.from(target, "hex"),
			);
			if (source === this.id || target === this.id) {
				this.emit(
					"peer-add",
					Buffer.from(source, "hex"),
					Buffer.from(target, "hex"),
				);
			}
		});
		this.graph.on("edgeDropped", ({ source, target, attributes }) => {
			this.emit(
				"peer-remove-seen",
				Buffer.from(source, "hex"),
				Buffer.from(target, "hex"),
				attributes,
			);
			if (source === this.id || target === this.id) {
				this.emit(
					"peer-remove",
					Buffer.from(source, "hex"),
					Buffer.from(target, "hex"),
					attributes,
				);
			}
		});
		this.graph.on("nodeAttributesUpdated", ({ key, attributes }) => {
			this.emit("peer-state", Buffer.from(key, "hex"), attributes);
		});
	}

	protected debug(message: string, ...args: any[]) {
		if (this._debug) {
			console.warn(message, ...args);
		}
	}

	protected _recalculate() {
		const status: [string, boolean][] = this.graph.mapNodes((id) => {
			try {
				return [id, !!bidirectional(this.graph, this.id, id)];
			} catch (err) {
				this.debug("Missing node", id, err);
				return [id, false];
			}
		});
		const online = status
			.filter(([id, online]) => online)
			.map(([id]) => id);
		const offline = status
			.filter(([id, online]) => !online)
			.map(([id]) => id);

		for (const id of offline) {
			try {
				this.graph.dropNode(id);
			} catch (err) {
				this.debug("Missing node", id, err);
				continue;
			}
		}

		this.online = new Set(online);
		this.emit("online", online);
	}

	protected _bootstrapper() {
		const bootstrap: Record<string, PeerState> = {};
		for (const { node, attributes } of this.graph.nodeEntries()) {
			bootstrap[node] = status2state(attributes as PeerStatus);
		}
		return bootstrap;
	}

	protected _bootstrap(bootstrap?: Record<string, PeerState>) {
		if (!bootstrap || this.bootstrapped) {
			return;
		}
		for (const [id, state] of Object.entries(bootstrap)) {
			const status = state2status(state);
			if (id === this.id) continue;
			this.graph.mergeNode(id, status);
			for (const publicKey of state.connected) {
				this._addConnection(Buffer.from(id, "hex"), publicKey, false);
			}
		}
		this.emit("bootstrap");
		this._recalculate();
	}

	protected _addConnection(
		a?: Buffer | null,
		b?: Buffer | null,
		recalculate = true,
	): boolean {
		try {
			const from = a?.toString("hex");
			const to = b?.toString("hex");
			this.graph.mergeEdge(from, to);
			if (recalculate) this._recalculate();
			return true;
		} catch (err) {
			this.debug("Failed to add connection", a, b, err);
			return false;
		}
	}

	protected _dropConnection(a?: Buffer | null, b?: Buffer | null): boolean {
		try {
			const from = a?.toString("hex");
			const to = b?.toString("hex");
			this.graph.dropEdge(from, to);
			this._recalculate();
			return true;
		} catch (err) {
			this.debug("Failed to drop connection", a, b, err);
			return false;
		}
	}

	get status(): PeerStatus {
		return this._status;
	}

	set status(status: PeerStatus) {
		this._status = status;
		this.broadcast(
			encode({
				type: PacketType.STATE,
				state: status2state(status),
			}),
		);
	}

	getStatus(publicKey: Buffer): PeerStatus {
		return getNodeAttributes(this.graph, publicKey.toString("hex"));
	}

	encodeBroadcast(message: Buffer): Buffer {
		return encode({
			type: PacketType.BROADCAST,
			userData: message,
		});
	}

	encodeMessage(message: Buffer): Buffer {
		return encode({
			type: PacketType.MESSAGE,
			userData: message,
		});
	}

	async broadcast(message: Buffer): Promise<boolean> {
		const promises = [
			this._broadcast(message).catch((err) => {
				this.debug("Broadcast sending failed", err);
				return false;
			}),
		];
		for (const [id, socket] of this._connections.entries()) {
			const status = getNodeAttributes(this.graph, id);
			if (status.ephemeral) {
				promises.push(
					this._fallback(
						socket.remotePublicKey,
						message,
						{
							host: socket.rawStream.remoteHost,
							port: socket.rawStream.remotePort,
						},
						socket.rawStream.socket,
					)
						.then((reply) => !reply.error)
						.catch((err) => {
							this.debug("Fallback sending failed", err);
							return false;
						}),
				);
			}
		}
		return Promise.all(promises).then((errors) =>
			errors.some((err) => err),
		);
	}

	async send(target: Buffer, message: Buffer): Promise<boolean> {
		const id = target.toString("hex");
		const status = getNodeAttributes(this.graph, id);
		if (status.ephemeral) {
			const socket = this._connections.get(id);
			if (socket && !socket.destroyed) {
				return this._fallback(
					target,
					message,
					{
						host: socket.rawStream.remoteHost,
						port: socket.rawStream.remotePort,
					},
					socket.rawStream.socket,
				)
					.then((reply) => !reply.error)
					.catch((err) => {
						this.debug("Fallback sending failed", err);
						return false;
					});
			}
			return Promise.resolve(false);
		}
		return this._send(target, message)
			.then((success) => {
				if (!success) {
					const socket = this._connections.get(id);
					if (socket && !socket.destroyed) {
						return this._fallback(
							target,
							message,
							{
								host: socket.rawStream.remoteHost,
								port: socket.rawStream.remotePort,
							},
							socket.rawStream.socket,
						).then((reply) => !reply.error);
					}
				}
				return success;
			})
			.catch((err) => {
				this.debug("Message sending failed", err);
				return false;
			});
	}

	protected async fallback(
		socket: EncryptedSocket,
		message: GossipPacket,
	): Promise<GossipPacket> {
		return this._fallback(
			socket.publicKey,
			encode(message),
			{
				host: socket.rawStream.remoteHost,
				port: socket.rawStream.remotePort,
			},
			socket.rawStream.socket,
		).then((reply) => {
			if (reply.error || !reply.value) {
				throw new Error("Fallback error");
			}
			const message = decode(reply.value);
			if (!message.type) {
				throw new Error("Failed to decode reply");
			}
			return message;
		});
	}

	async onpeeradd(socket: EncryptedSocket, info: PeerInfo) {
		const publicKey = info.publicKey;
		const id = publicKey.toString("hex");
		socket.on("close", () => this.onpeerremove(publicKey));
		this.status.connected.add(id);
		this._connections.set(id, socket);
		this._addConnection(this.publicKey, publicKey);

		this.broadcast(
			encode({
				type: PacketType.CONNECTED,
				publicKey,
			}),
		);
		this.broadcast(
			encode({
				type: PacketType.STATE,
				publicKey: this.publicKey,
				state: status2state(this.status),
			}),
		);

		let status = getNodeAttributes(this.graph, id);
		if (status.ephemeral !== false) {
			try {
				const packet = await this.fallback(socket, {
					type: PacketType.STATE,
					state: status2state(this.status),
				});
				if (packet.type !== PacketType.STATE || !packet.state) {
					throw new Error("Invalid fallback response");
				}
				status = state2status(packet.state);
				this.graph.mergeNode(id, status);
			} catch (err) {
				this.debug("Error", err);
				return;
			}
		}

		if (this.bootstrapped || status.ephemeral) return;

		this.send(publicKey, encode({ type: PacketType.BOOTSTRAP_REQUEST }));
	}

	async onpeerremove(publicKey: Buffer) {
		const id = publicKey.toString("hex");
		this.status.connected.delete(id);
		this._connections.delete(id);
		this._dropConnection(this.publicKey, publicKey);
		this.broadcast(encode({ type: PacketType.DISCONNECTED, publicKey }));
	}

	onbroadcast(data: Buffer, publicKey: Buffer) {
		const id = publicKey.toString("hex");
		const message = decode(data);
		if (!message.type) {
			return this.debug("Invalid broadcast", id);
		}
		let toId;
		switch (message.type) {
			case PacketType.STATE: {
				const status = state2status(message.state);
				this.graph.mergeNode(id, status);
				this._recalculate();
				break;
			}
			case PacketType.CONNECTED: {
				this._addConnection(publicKey, message.publicKey);
				break;
			}
			case PacketType.DISCONNECTED: {
				this._dropConnection(publicKey, message.publicKey);
				break;
			}
			case PacketType.BROADCAST: {
				this.emit("broadcast", message.userData, publicKey);
				break;
			}
			default:
				this.debug("Unknown broadcast type", message, id);
		}
	}

	onmessage(data: Buffer, publicKey: Buffer) {
		const id = publicKey.toString("hex");
		const message = decode(data);
		if (!message.type) {
			return this.debug("Invalid message", id);
		}
		switch (message.type) {
			case PacketType.BOOTSTRAP_REQUEST: {
				this.send(
					publicKey,
					encode({
						type: PacketType.BOOTSTRAP_RESPONSE,
						bootstrap: this._bootstrapper(),
					}),
				);
				break;
			}
			case PacketType.BOOTSTRAP_RESPONSE: {
				this._bootstrap(message.bootstrap);
				break;
			}
			case PacketType.MESSAGE: {
				this.emit("message", message.userData, publicKey);
				break;
			}
			default:
				this.debug("Unknown message type", message, id);
		}
	}

	onfallback(
		data: Buffer,
		publicKey: Buffer,
		reply: (reply: Buffer | null) => void,
	) {
		const id = publicKey.toString("hex");
		const message = decode(data);
		if (!message.type) {
			return this.debug("Invalid fallback message", id);
		}
		switch (message.type) {
			case PacketType.STATE: {
				this.onbroadcast(data, publicKey);
				return reply(
					encode({
						type: PacketType.STATE,
						state: status2state(this.status),
					}),
				);
			}
			case PacketType.CONNECTED:
			case PacketType.DISCONNECTED:
			case PacketType.BROADCAST: {
				this.onbroadcast(data, publicKey);
				return reply(null);
			}
			case PacketType.BOOTSTRAP_REQUEST:
			case PacketType.BOOTSTRAP_RESPONSE:
			case PacketType.MESSAGE: {
				this.onmessage(data, publicKey);
				return reply(null);
			}
			default:
				this.debug("Unknown fallback message type", message, id);
				return reply(null);
		}
	}
}
