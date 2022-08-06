/// <reference path="../types/codecs/index.d.ts" />
/// <reference path="../types/hyperswarm/index.d.ts" />
/// <reference path="../types/hyperswarm__dht/index.d.ts" />
/// <reference path="../types/b4a/index.d.ts" />
/// <reference path="../types/collections/fast-set.d.ts" />
/// <reference path="../types/collections/fast-map.d.ts" />
import type { Duplex } from "stream";
import type { EncryptedSocket, Node } from "@hyperswarm/dht";
import type { PeerInfo } from "hyperswarm";
import { EventEmitter2 } from "eventemitter2";
import Graph from "graphology";
import { bidirectional } from "graphology-shortest-path";
import codecs, { codec, encoder } from "codecs";
import b4a from "b4a";
import FastMap from "collections/fast-map";
import FastSet from "collections/fast-set";
import { encode, decode } from "./messages";
import { BootstrapPeer, PacketType, Subscription } from "./schema";

export type Connection = {
	publicKey: Uint8Array;
	client: boolean;
	server: boolean;
	socket: EncryptedSocket;
	info: PeerInfo;
};
export type State = {
	ephemeral: boolean;
	connected: FastSet<Uint8Array>;
	announcing: FastMap<Uint8Array, string | null>;
	lookingup: FastMap<Uint8Array, string | null>;
	userData: Record<string, any>;
	connection: Connection | null;
};

type Broadcast = (message: Uint8Array) => Promise<boolean>;
type Send = (target: Uint8Array, message: Uint8Array) => Promise<boolean>;
type Fallback = (
	target: Uint8Array,
	message: Uint8Array,
	to: Node,
	socket: Duplex,
) => Promise<boolean>;

function getPeerState(
	graph: Graph<State>,
	publicKey: Uint8Array,
	connection?: Connection | null,
) {
	let state: State;
	try {
		state = graph.getNodeAttributes(b4a.toString(publicKey, "hex"));
	} catch {
		state = {
			ephemeral: true,
			connected: new FastSet<Uint8Array>(null, b4a.equals, (v) =>
				b4a.toString(v, "hex"),
			),
			announcing: new FastMap<Uint8Array, string | null>(
				null,
				b4a.equals,
				(k) => b4a.toString(k, "hex"),
			),
			lookingup: new FastMap<Uint8Array, string | null>(
				null,
				b4a.equals,
				(k) => b4a.toString(k, "hex"),
			),
			userData: {},
			connection: connection ?? null,
		};
		graph.mergeNode(b4a.toString(publicKey, "hex"), state);
	}
	return state;
}
function setPeerState(
	graph: Graph<State>,
	publicKey: Uint8Array,
	state?: Partial<State> | null,
) {
	const old = getPeerState(graph, publicKey);
	old.ephemeral = state?.ephemeral ?? old.ephemeral;
	old.connected.addEach(state?.connected as any);
	const oldAnnounces = new FastSet(old.announcing.keys());
	const newAnnounces = new FastSet(state?.announcing?.keys());
	old.announcing.deleteEach(
		oldAnnounces.difference(newAnnounces as any) as any,
	);
	old.announcing.addEach(state?.announcing as any);
	const oldLookups = new FastSet(old.lookingup.keys());
	const newLookups = new FastSet(state?.lookingup?.keys());
	old.lookingup.deleteEach(oldLookups.difference(newLookups as any) as any);
	old.lookingup.addEach(state?.lookingup as any);
	old.userData = Object.assign(old.userData, state?.userData ?? {});
	old.connection =
		state?.connection === null
			? null
			: state?.connection ?? old.connection;
	graph.mergeNode(b4a.toString(publicKey, "hex"), old);
}

export class VoidPresence extends EventEmitter2 {
	publicKey: Uint8Array;
	graph: Graph<State>;
	bootstrapped = false;
	online = new FastSet<Uint8Array>(null, b4a.equals, (v) =>
		b4a.toString(v, "hex"),
	);
	topics = new FastMap<Uint8Array, string | null>(null, b4a.equals, (k) =>
		b4a.toString(k, "hex"),
	);

	protected id: string;
	protected _state: State;
	protected _codec: encoder<Record<string, any>>;
	protected _broadcast: Broadcast;
	protected _send: Send;
	protected _fallback: Fallback;
	protected _connections = new FastMap<Uint8Array, Connection>(
		null,
		b4a.equals,
		(k) => b4a.toString(k, "hex"),
	);
	protected _debug: boolean;

	constructor(
		publicKey: Uint8Array,
		userData: Record<string, any>,
		encoding: codec,
		broadcast: Broadcast,
		send: Send,
		fallback: Fallback,
		debug?: boolean,
	) {
		super({ wildcard: true });

		this.publicKey = publicKey;
		this.id = b4a.toString(publicKey, "hex");
		this.graph = new Graph({
			allowSelfLoops: false,
			multi: false,
			type: "undirected",
		});
		this._state = getPeerState(this.graph, publicKey);
		this.graph.setNodeAttribute(this.id, "userData", userData);
		this._codec = codecs(encoding ?? "json", "json");
		this._broadcast = broadcast;
		this._send = send;
		this._fallback = fallback;
		this._debug = debug ?? false;

		this.online.add(publicKey);

		this.graph.on("edgeAdded", ({ source, target }) => {
			const from = b4a.from(source, "hex");
			const to = b4a.from(target, "hex");
			this.emit("peer-join-seen", from, to);
		});
		this.graph.on("edgeDropped", ({ source, target }) => {
			const from = b4a.from(source, "hex");
			const to = b4a.from(target, "hex");
			this.emit("peer-leave-seen", from, to);
		});
		this.graph.on("nodeAdded", ({ key }) => {
			const peer = b4a.from(key, "hex");
			this.emit("peer-online", peer);
		});
		this.graph.on("nodeDropped", ({ key }) => {
			const peer = b4a.from(key, "hex");
			this.emit("peer-offline", peer);
		});
		this._connections.addMapChangeListener((conn, peer) => {
			if (typeof conn === "undefined") {
				this.emit("peer-leave", peer);
			} else {
				this.emit("peer-join", peer, conn);
			}
		});
		this.topics.addMapChangeListener((name, topic) => {
			if (typeof name === "undefined") {
				this.emit("topic-leave", topic);
			} else {
				this.emit("topic-join", topic, name);
			}
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
				this.debug("Could not compute path", id, err);
				return [id, false];
			}
		});
		const online = status
			.filter(([id, online]) => online)
			.map(([id]) => b4a.from(id, "hex"));
		const offline = status
			.filter(([id, online]) => !online)
			.map(([id]) => id);

		for (const id of offline) {
			try {
				this.graph.dropNode(id);
			} catch (err) {
				this.debug("Missing node", id, err);
			}
		}
		this.online.addEach(online);
		this.online.deleteEach(offline.map((id) => b4a.from(id, "hex")));
		this.emit("online", this.online);
	}

	protected _bootstrapper() {
		const bootstrap: Record<string, BootstrapPeer> = {};
		for (const { node, attributes } of this.graph.nodeEntries()) {
			const topics: BootstrapPeer["topics"] = {};
			for (const [topic, name] of attributes.announcing.entries()) {
				topics[b4a.toString(topic, "hex")] = {
					name: name || "",
					client: false,
					server: true,
				};
			}
			for (const [topic, name] of attributes.lookingup.entries()) {
				const id = b4a.toString(topic, "hex");
				const prev = topics[id];
				if (prev) {
					prev.client = true;
				} else {
					topics[id] = {
						name: name || "",
						client: true,
						server: false,
					};
				}
			}
			bootstrap[node] = {
				connected: attributes.connected.toArray(),
				topics,
				userData: this._codec.encode(attributes.userData),
			};
		}
		return bootstrap;
	}

	protected _bootstrap(bootstrap?: Record<string, BootstrapPeer> | null) {
		if (!bootstrap || this.bootstrapped) {
			return;
		}
		for (const [id, status] of Object.entries(bootstrap)) {
			if (id === this.id) continue;
			const state = getPeerState(this.graph, b4a.from(id, "hex"));
			for (const [hex, meta] of Object.entries(status.topics)) {
				const topic = b4a.from(hex, "hex");
				if (meta.client) {
					state.lookingup.set(topic, meta.name || null);
				}
				if (meta.server) {
					state.announcing.set(topic, meta.name || null);
				}
				this._maybeJoinTopic({ buffer: topic, topic: meta });
			}
			for (const other of status.connected) {
				this._addConnection(b4a.from(id, "hex"), other, false);
			}
			this.graph.setNodeAttribute(
				id,
				"userData",
				this._codec.decode(status.userData),
			);
		}
		this.bootstrapped = true;
		this.emit("bootstrap");
		this._recalculate();
	}

	protected _maybeJoinTopic(sub?: Subscription | null) {
		if (!sub) return;
		if (sub.topic.name && !this.topics.get(sub.buffer)) {
			this.topics.set(sub.buffer, sub.topic.name);
		} else if (!this.topics.has(sub.buffer)) {
			this.topics.set(sub.buffer, sub.topic.name || null);
		}
	}

	protected _maybeLeaveTopic(sub?: Subscription | null) {
		if (!sub) return;
		let found = false;
		for (const { attributes } of this.graph.nodeEntries()) {
			found =
				attributes.announcing.has(sub.buffer) ||
				attributes.lookingup.has(sub.buffer);
			if (found) break;
		}
		if (!found) this.topics.delete(sub.buffer);
	}

	protected _addConnection(
		a: Uint8Array,
		b: Uint8Array,
		recalculate = true,
	) {
		getPeerState(this.graph, a);
		getPeerState(this.graph, b);
		this.graph.mergeEdge(b4a.toString(a, "hex"), b4a.toString(b, "hex"));
		if (recalculate) this._recalculate();
	}

	protected _dropConnection(a: Uint8Array, b: Uint8Array) {
		try {
			this.graph.dropEdge(
				b4a.toString(a, "hex"),
				b4a.toString(b, "hex"),
			);
			this._recalculate();
		} catch (err) {
			this.debug("Failed to drop connection", a, b, err);
		}
	}

	async broadcast(message: Uint8Array): Promise<boolean> {
		const promises = [
			this._broadcast(message).catch((err) => {
				this.debug("Sending broadcast failed", err);
				return false;
			}),
		];
		for (const [target, connection] of this._connections.entries()) {
			const state = getPeerState(this.graph, target);
			const host = connection.socket.rawStream.remoteHost;
			const port = connection.socket.rawStream.remotePort;
			const socket = connection.socket.rawStream.socket;
			if (state.ephemeral) {
				promises.push(
					this._fallback(
						target,
						message,
						{ host, port },
						socket,
					).catch((err) => {
						this.debug(
							"Sending fallback broadcast failed",
							target,
							err,
						);
						return false;
					}),
				);
			}
		}
		return Promise.all(promises).then((errors) =>
			errors.some((err) => err),
		);
	}

	async send(target: Uint8Array, message: Uint8Array): Promise<boolean> {
		let state = getPeerState(this.graph, target);
		const sendRetry = (socket: EncryptedSocket) =>
			this._fallback(
				target,
				message,
				{
					host: socket.rawStream.remoteHost,
					port: socket.rawStream.remotePort,
				},
				socket.rawStream.socket,
			).catch((err) => {
				this.debug("Sending fallback message failed", target, err);
				return false;
			});
		if (state.ephemeral) {
			if (state.connection) {
				const res = await sendRetry(state.connection.socket);
				if (res) return res;
			}
			let retry = 0;
			return new Promise((resolve) => {
				let interval = setInterval(() => {
					state = getPeerState(this.graph, target);
					if (state.connection) {
						clearInterval(interval);
						sendRetry(state.connection.socket).then((res) => {
							if (res) resolve(res);
						});
					}
					retry++;
					if (retry > 3) {
						clearInterval(interval);
						resolve(false);
					}
				}, 100);
			});
		}
		return this._send(target, message);
	}

	async onpeeradd(socket: EncryptedSocket, info: PeerInfo) {
		const publicKey = info.publicKey;
		socket.on("error", (err) =>
			this.debug("Socket Error", publicKey, err),
		);
		socket.on("close", () => this.onpeerdrop(publicKey));
		const conn: Connection = {
			publicKey,
			client: info.client,
			server: !info.client,
			socket,
			info,
		};
		const state = getPeerState(this.graph, publicKey, conn);
		this._connections.set(publicKey, conn);
		this._addConnection(this.publicKey, publicKey);

		this.broadcast(
			encode({
				type: PacketType.CONNECTED,
				peer: publicKey,
			}),
		);
		this.broadcast(
			encode({
				type: PacketType.PERSISTENT,
				ephemeral: this._state.ephemeral,
			}),
		);
		for (const [buffer, name] of this._state.announcing.entries()) {
			this.broadcast(
				encode({
					type: PacketType.TOPIC_JOIN,
					topic: {
						buffer,
						topic: {
							name: name ?? "",
							client: this._state.lookingup.has(buffer),
							server: true,
						},
					},
				}),
			);
		}
		for (const [buffer, name] of this._state.lookingup.entries()) {
			if (!this._state.announcing.has(buffer)) {
				this.broadcast(
					encode({
						type: PacketType.TOPIC_JOIN,
						topic: {
							buffer,
							topic: {
								name: name ?? "",
								client: true,
								server: false,
							},
						},
					}),
				);
			}
		}
		this.broadcast(
			encode({
				type: PacketType.USER_DATA,
				data: this._codec.encode(this._state.userData),
			}),
		);

		if (this.bootstrapped) return;

		this.send(
			publicKey,
			encode({
				type: PacketType.BOOTSTRAP_REQUEST,
			}),
		);
	}

	async onpeerdrop(publicKey: Uint8Array) {
		this._state.connected.delete(publicKey);
		this._connections.delete(publicKey);
		const state = getPeerState(this.graph, publicKey);
		state.connection = null;
		this._dropConnection(this.publicKey, publicKey);
		this.broadcast(
			encode({
				type: PacketType.DISCONNECTED,
				peer: publicKey,
			}),
		);
	}

	async onbroadcast(data: Uint8Array, publicKey: Uint8Array) {
		const message = decode(data);
		if (!message?.type) {
			return this.debug("Invalid Broadcast", publicKey);
		}
		const state = getPeerState(this.graph, publicKey);
		switch (message.type) {
			case PacketType.PERSISTENT:
				state.ephemeral = message.ephemeral ?? true;
				break;
			case PacketType.CONNECTED:
				this._addConnection(publicKey, message.peer as Uint8Array);
				break;
			case PacketType.DISCONNECTED:
				this._dropConnection(publicKey, message.peer as Uint8Array);
				break;
			case PacketType.TOPIC_JOIN:
				const join = message.topic;
				if (join?.topic.client) {
					state.lookingup.set(join.buffer, join.topic.name || null);
				}
				if (join?.topic.server) {
					state.announcing.set(join.buffer, join.topic.name || null);
				}
				this._maybeJoinTopic(join);
				this.emit(
					"peer-topic-join",
					join?.buffer,
					join?.topic,
					publicKey,
				);
				break;
			case PacketType.TOPIC_LEAVE:
				const leave = message.topic;
				state.lookingup.delete(leave?.buffer as Uint8Array);
				state.announcing.delete(leave?.buffer as Uint8Array);
				this._maybeLeaveTopic(leave);
				this.emit("peer-topic-leave", leave?.buffer, publicKey);
				break;
			case PacketType.USER_DATA:
				const data = this._codec.decode(message.data as Uint8Array);
				state.userData = data;
				break;
			case PacketType.BROADCAST:
				this.emit("broadcast", message.message, publicKey);
				break;
			default:
				this.debug("Unknown Broadcast Type", publicKey, message.type);
		}
	}

	async onmessage(data: Uint8Array, publicKey: Uint8Array) {
		const message = decode(data);
		if (!message?.type) {
			return this.debug("Invalid Message", publicKey);
		}
		switch (message.type) {
			case PacketType.BOOTSTRAP_REQUEST:
				this.send(
					publicKey,
					encode({
						type: PacketType.BOOTSTRAP_RESPONSE,
						bootstrap: this._bootstrapper(),
					}),
				);
				break;
			case PacketType.BOOTSTRAP_RESPONSE:
				this._bootstrap(message.bootstrap as any);
				break;
			case PacketType.MESSAGE:
				this.emit("message", message.message, publicKey);
				break;
			default:
				this.debug("Unknown Message Type", publicKey, message.type);
		}
	}

	async onfallback(data: Uint8Array, publicKey: Uint8Array) {
		const message = decode(data);
		if (!message?.type) {
			return this.debug("Invalid Fallback", publicKey);
		}
		switch (message.type) {
			case PacketType.PERSISTENT:
			case PacketType.CONNECTED:
			case PacketType.DISCONNECTED:
			case PacketType.TOPIC_JOIN:
			case PacketType.TOPIC_LEAVE:
			case PacketType.USER_DATA:
			case PacketType.BROADCAST:
				return this.onbroadcast(data, publicKey);
			case PacketType.BOOTSTRAP_REQUEST:
			case PacketType.BOOTSTRAP_RESPONSE:
			case PacketType.MESSAGE:
				return this.onmessage(data, publicKey);
			default:
				this.debug("Unknown Fallback Type", publicKey, message.type);
		}
	}

	async onstate(ephemeral: boolean) {
		this._state.ephemeral = ephemeral;
		this.broadcast(
			encode({
				type: PacketType.PERSISTENT,
				ephemeral,
			}),
		);
	}

	async onjoin(
		topic: Uint8Array,
		name: string | null,
		{ client = true, server = true } = {},
	) {
		if (client) this._state.lookingup.set(topic, name);
		if (!client) this._state.lookingup.delete(topic);
		if (server) this._state.announcing.set(topic, name);
		if (!server) this._state.announcing.delete(topic);
		this.broadcast(
			encode({
				type: PacketType.TOPIC_JOIN,
				topic: {
					buffer: topic,
					topic: {
						name: name ?? "",
						client,
						server,
					},
				},
			}),
		);
	}

	async onleave(topic: Uint8Array) {
		this._state.lookingup.delete(topic);
		this._state.announcing.delete(topic);
		this.broadcast(
			encode({
				type: PacketType.TOPIC_LEAVE,
				topic: {
					buffer: topic,
					topic: {
						name: "",
						client: false,
						server: false,
					},
				},
			}),
		);
		for (const [publicKey, { socket }] of this._connections.entries()) {
			const state = getPeerState(this.graph, publicKey);
			if (
				!new FastSet(state.announcing.keys(), b4a.equals, (v) =>
					b4a.toString(v, "hex"),
				).intersection(
					new FastSet(
						this._state.lookingup.keys(),
						b4a.equals,
						(v) => b4a.toString(v, "hex"),
					) as any,
				).length &&
				!new FastSet(state.lookingup.keys(), b4a.equals, (v) =>
					b4a.toString(v, "hex"),
				).intersection(
					new FastSet(
						this._state.announcing.keys(),
						b4a.equals,
						(v) => b4a.toString(v, "hex"),
					) as any,
				).length
			) {
				setTimeout(() => {
					socket.destroy();
				}, 100);
			}
		}
	}

	getPeerState(publicKey: Uint8Array): State {
		return getPeerState(this.graph, publicKey);
	}
}
