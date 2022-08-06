/// <reference path="../types/hyperswarm__dht/index.d.ts" />
/// <reference path="../types/sodium-universal/index.d.ts" />
/// <reference path="../types/b4a/index.d.ts" />
/// <reference path="../types/collections/lru-set.d.ts" />
import type { Duplex } from "stream";
import HyperDHT, {
	DHTOptions,
	Request,
	Reply,
	KeyPair,
	Node,
} from "@hyperswarm/dht";
import sodium from "sodium-universal";
import b4a from "b4a";
import LruSet from "collections/lru-set";
import { Broadcast } from "./schema";

enum COMMANDS {
	PEER_HANDSHAKE = 0,
	PEER_HOLEPUNCH = 1,
	FIND_PEER = 2,
	LOOKUP = 3,
	ANNOUNCE = 4,
	UNANNOUNCE = 5,
	MUTABLE_PUT = 6,
	MUTABLE_GET = 7,
	IMMUTABLE_PUT = 8,
	IMMUTABLE_GET = 9,
	BROADCAST = 128,
	MESSAGE,
	MESSAGE_FALLBACK,
}

enum ERROR {
	OK = 0,
	UNKNOWN_COMMAND,
	INVALID_TOKEN,
	INVALID_PACKET = 128,
	VERIFICATION_FAILED,
	DECRYPTION_FAILED,
	MISSING_TARGET,
	MESSAGE_FROM_SELF,
	DUPLICATE_MESSAGE,
	WRONG_TARGET,
}

const TTL = 255;
const LRUSIZE = 255;

export class VoidDHT extends HyperDHT {
	protected _seq = 0;
	protected _ttl: number;
	protected _lru: LruSet<string>;

	protected _debugGossip: boolean;

	protected _router!: any;
	protected _persistent!: any;

	constructor(
		options: DHTOptions & {
			ttl?: number;
			lruSize?: number;
			debug?: { gossip?: boolean };
		} = {},
	) {
		super(options);

		this._ttl = options.ttl ?? TTL;
		this._lru = new LruSet([], options.lruSize ?? LRUSIZE);

		this._debugGossip = options.debug?.gossip ?? false;
	}

	private _debug(message: string, ...args: any[]) {
		if (this._debugGossip) {
			console.warn(message, ...args);
		}
	}

	protected onrequest(req: Request) {
		switch (req.command) {
			case COMMANDS.PEER_HANDSHAKE: {
				this._router.onpeerhandshake(req);
				return true;
			}
			case COMMANDS.PEER_HOLEPUNCH: {
				this._router.onpeerholepunch(req);
				return true;
			}
			case COMMANDS.BROADCAST: {
				this.onbroadcast(req);
				return true;
			}
			case COMMANDS.MESSAGE: {
				this.onsend(req);
				return true;
			}
			case COMMANDS.MESSAGE_FALLBACK: {
				this.onsendFallback(req);
				return true;
			}
		}

		if (this._persistent === null) return this.emit("request", req);

		switch (req.command) {
			case COMMANDS.FIND_PEER: {
				this._persistent.onfindpeer(req);
				return true;
			}
			case COMMANDS.LOOKUP: {
				this._persistent.onlookup(req);
				return true;
			}
			case COMMANDS.ANNOUNCE: {
				this._persistent.onannounce(req);
				return true;
			}
			case COMMANDS.UNANNOUNCE: {
				this._persistent.onunannounce(req);
				return true;
			}
			case COMMANDS.MUTABLE_PUT: {
				this._persistent.onmutableput(req);
				return true;
			}
			case COMMANDS.MUTABLE_GET: {
				this._persistent.onmutableget(req);
				return true;
			}
			case COMMANDS.IMMUTABLE_PUT: {
				this._persistent.onimmutableput(req);
				return true;
			}
			case COMMANDS.IMMUTABLE_GET: {
				this._persistent.onimmutableget(req);
				return true;
			}
		}

		return this.emit("request", req);
	}

	protected async onbroadcast(req: Request) {
		let decoded;
		try {
			decoded = Broadcast.decode(req.value);
		} catch (err) {
			req.error(ERROR.INVALID_PACKET);
			return this._debug("Invalid broadcast packet", err);
		}
		const { origin, seq, ttl, data } = decoded;
		if (b4a.equals(origin, this.defaultKeyPair.publicKey)) {
			req.reply(null);
			return this._debug("Broadcast from self", origin, seq);
		}
		const key = b4a.toString(origin, "hex") + seq;
		if (this._lru.has(key)) {
			req.reply(null);
			return this._debug("Duplicate broadcast", origin, seq);
		}
		this._lru.add(key);
		const message = b4a.allocUnsafe(
			data.byteLength - sodium.crypto_sign_BYTES,
		);
		if (sodium.crypto_sign_open(message, data, origin)) {
			this.emit("broadcast", message, origin, { seq, hops: TTL - ttl });
		} else {
			req.error(ERROR.VERIFICATION_FAILED);
			return this._debug("Broadcast verification failed", origin, seq);
		}
		if (ttl <= 0) {
			req.reply(null);
			return this._debug("Broadcast at the end of TTL");
		}
		this._broadcast(data, { origin, ttl: ttl - 1, seq }).then((res) =>
			this._debug("Re-broadcast", origin, seq, res),
		);
		req.reply(null);
	}

	async broadcast(
		message: Uint8Array,
		{ ttl, seq }: { ttl?: number; seq?: number } = {},
	) {
		seq = seq ?? ++this._seq;
		ttl = ttl ?? this._ttl;
		const data = b4a.allocUnsafe(
			message.byteLength + sodium.crypto_sign_BYTES,
		);
		sodium.crypto_sign(data, message, this.defaultKeyPair.secretKey);
		return this._broadcast(data, {
			origin: this.defaultKeyPair.publicKey,
			ttl,
			seq,
		});
	}

	protected async _broadcast(
		data: Uint8Array,
		{ origin, ttl, seq }: { origin: Uint8Array; ttl: number; seq: number },
	) {
		const stream = this.findNode(this.defaultKeyPair.publicKey);
		await stream.finished();
		return Promise.all(
			stream.closestNodes.map((addr) =>
				this.request(
					{
						target: b4a.alloc(32),
						command: COMMANDS.BROADCAST,
						value: Broadcast.encode({ origin, seq, ttl, data }),
					},
					addr,
				),
			),
		)
			.then((replies) => replies.map((r) => r.error))
			.then((errors) => errors.some((err) => err === 0))
			.catch((err) => {
				this._debug("Broadcast Error", err);
				return false;
			});
	}

	protected async onsend(req: Request) {
		let decoded;
		try {
			decoded = Broadcast.decode(req.value);
		} catch (err) {
			req.error(ERROR.INVALID_PACKET);
			return this._debug("Invalid broadcast packet", err);
		}
		const { origin, seq, ttl, nonce, data } = decoded;
		if (!req.target) {
			req.error(ERROR.MISSING_TARGET);
			return this._debug("Missing target for message", origin, seq);
		}
		if (b4a.equals(origin, this.defaultKeyPair.publicKey)) {
			req.reply(null);
			return this._debug("Message from self", origin, seq);
		}
		const key = b4a.toString(origin, "hex") + seq;
		if (this._lru.has(key)) {
			req.reply(null);
			return this._debug("Duplicate message", origin, seq);
		}
		this._lru.add(key);
		if (b4a.equals(req.target, this.defaultKeyPair.publicKey)) {
			const publicKey = b4a.allocUnsafe(
				sodium.crypto_box_PUBLICKEYBYTES,
			);
			sodium.crypto_sign_ed25519_pk_to_curve25519(publicKey, origin);
			const secretKey = b4a.allocUnsafe(
				sodium.crypto_box_SECRETKEYBYTES,
			);
			sodium.crypto_sign_ed25519_sk_to_curve25519(
				secretKey,
				this.defaultKeyPair.secretKey,
			);
			const message = b4a.allocUnsafe(
				data.byteLength - sodium.crypto_box_MACBYTES,
			);
			if (
				sodium.crypto_box_open_easy(
					message,
					data,
					nonce as Uint8Array,
					publicKey,
					secretKey,
				)
			) {
				req.reply(null);
				return this.emit("message", message, origin, {
					seq,
					hops: TTL - ttl,
				});
			} else {
				req.error(ERROR.DECRYPTION_FAILED);
				return this._debug("Message decryption failed", origin, seq);
			}
		}
		if (ttl <= 0) {
			req.reply(null);
			return this._debug("Message at the end of TTL", origin, seq);
		}
		this._send(req.target, data, {
			origin,
			nonce: nonce as Uint8Array,
			ttl: ttl - 1,
			seq,
		}).then((res) => this._debug("Re-send", origin, seq, res));
		req.reply(null);
	}

	async send(
		target: Uint8Array,
		message: Uint8Array,
		{
			nonce,
			ttl,
			seq,
		}: { nonce?: Uint8Array; ttl?: number; seq?: number } = {},
	) {
		if (!nonce) {
			nonce = b4a.allocUnsafe(sodium.crypto_box_NONCEBYTES);
			sodium.randombytes_buf(nonce);
		}
		seq = seq ?? ++this._seq;
		ttl = ttl ?? this._ttl;
		const publicKey = b4a.allocUnsafe(sodium.crypto_box_PUBLICKEYBYTES);
		sodium.crypto_sign_ed25519_pk_to_curve25519(publicKey, target);
		const secretKey = b4a.allocUnsafe(sodium.crypto_box_SECRETKEYBYTES);
		sodium.crypto_sign_ed25519_sk_to_curve25519(
			secretKey,
			this.defaultKeyPair.secretKey,
		);
		const data = b4a.allocUnsafe(
			message.byteLength + sodium.crypto_box_MACBYTES,
		);
		sodium.crypto_box_easy(data, message, nonce, publicKey, secretKey);
		return this._send(target, data, {
			origin: this.defaultKeyPair.publicKey,
			nonce,
			ttl,
			seq,
		});
	}

	protected async _send(
		target: Uint8Array,
		data: Uint8Array,
		{
			origin,
			nonce,
			ttl,
			seq,
		}: { origin: Uint8Array; nonce: Uint8Array; ttl: number; seq: number },
	) {
		const stream = this.findNode(this.defaultKeyPair.publicKey);
		await stream.finished();
		return Promise.all(
			stream.closestNodes.map((addr) =>
				this.request(
					{
						target,
						command: COMMANDS.MESSAGE,
						value: Broadcast.encode({
							origin,
							nonce,
							seq,
							ttl,
							data,
						}),
					},
					addr,
				),
			),
		)
			.then((replies) => replies.map((r) => r.error))
			.then((errors) => errors.some((err) => err === 0))
			.catch((err) => {
				this._debug("Message sending failed", err);
				return false;
			});
	}

	protected async onsendFallback(req: Request) {
		let decoded;
		try {
			decoded = Broadcast.decode(req.value);
		} catch (err) {
			req.error(ERROR.INVALID_PACKET);
			return this._debug("Invalid broadcast packet", err);
		}
		const { origin, seq, ttl, nonce, data } = decoded;
		if (!req.target) {
			req.error(ERROR.MISSING_TARGET);
			return this._debug(
				"Missing target for fallback message",
				origin,
				seq,
			);
		}
		if (b4a.equals(origin, this.defaultKeyPair.publicKey)) {
			req.error(ERROR.MESSAGE_FROM_SELF);
			return this._debug("Fallback message from self", origin, seq);
		}
		const key = b4a.toString(origin, "hex") + seq;
		if (this._lru.has(key)) {
			req.error(ERROR.DUPLICATE_MESSAGE);
			return this._debug("Duplicate fallback message", origin, seq);
		}
		this._lru.add(key);
		if (b4a.equals(req.target, this.defaultKeyPair.publicKey)) {
			const publicKey = b4a.allocUnsafe(
				sodium.crypto_box_PUBLICKEYBYTES,
			);
			sodium.crypto_sign_ed25519_pk_to_curve25519(publicKey, origin);
			const secretKey = b4a.allocUnsafe(
				sodium.crypto_box_SECRETKEYBYTES,
			);
			sodium.crypto_sign_ed25519_sk_to_curve25519(
				secretKey,
				this.defaultKeyPair.secretKey,
			);
			const message = b4a.allocUnsafe(
				data.byteLength - sodium.crypto_box_MACBYTES,
			);
			if (
				sodium.crypto_box_open_easy(
					message,
					data,
					nonce as Uint8Array,
					publicKey,
					secretKey,
				)
			) {
				return this.emit(
					"message-fallback",
					message,
					origin,
					req.reply.bind(req),
					{ seq },
				);
			}
			req.error(ERROR.DECRYPTION_FAILED);
			return this._debug(
				"Fallback message decryption failed",
				origin,
				seq,
			);
		}
		req.error(ERROR.WRONG_TARGET);
	}

	async sendFallback(
		target: Uint8Array,
		message: Uint8Array,
		{
			nonce,
			ttl,
			seq,
		}: { nonce?: Uint8Array; ttl?: number; seq?: number } = {},
		to: Node,
		socket: Duplex,
	) {
		if (!nonce) {
			nonce = b4a.allocUnsafe(sodium.crypto_box_NONCEBYTES);
			sodium.randombytes_buf(nonce);
		}
		seq = seq ?? ++this._seq;
		ttl = ttl ?? 0;
		const publicKey = b4a.allocUnsafe(sodium.crypto_box_PUBLICKEYBYTES);
		sodium.crypto_sign_ed25519_pk_to_curve25519(publicKey, target);
		const secretKey = b4a.allocUnsafe(sodium.crypto_box_SECRETKEYBYTES);
		sodium.crypto_sign_ed25519_sk_to_curve25519(
			secretKey,
			this.defaultKeyPair.secretKey,
		);
		const data = b4a.allocUnsafe(
			message.byteLength + sodium.crypto_box_MACBYTES,
		);
		sodium.crypto_box_easy(data, message, nonce, publicKey, secretKey);
		return this._sendFallback(
			target,
			data,
			{ origin: this.defaultKeyPair.publicKey, nonce, ttl, seq },
			to,
			socket,
		);
	}

	protected async _sendFallback(
		target: Uint8Array,
		data: Uint8Array,
		{
			origin,
			nonce,
			ttl,
			seq,
		}: { origin: Uint8Array; nonce: Uint8Array; ttl: number; seq: number },
		to: Node,
		socket: Duplex,
	) {
		return this.request(
			{
				target,
				command: COMMANDS.MESSAGE_FALLBACK,
				value: Broadcast.encode({
					origin,
					nonce,
					seq,
					ttl,
					data,
				}),
			},
			to,
			{ socket },
		);
	}
}
