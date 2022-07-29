/// <reference path="../types/hyperswarm__dht/index.d.ts" />
/// <reference path="../types/sodium-universal/index.d.ts" />
/// <reference path="../types/lru/index.d.ts" />
import DHT, {
	DHTOptions,
	Request,
	Reply,
	KeyPair,
	Node,
} from "@hyperswarm/dht";
import sodium from "sodium-universal";
import LRU from "lru";
import { Broadcast } from "./messages";
import { Duplex } from "stream";

enum COMMAND {
	BROADCAST = 128,
	MESSAGE,
	MESSAGE_FALLBACK,
}

enum ERROR {
	OK = 0,
	ERROR_UNKNOWN_COMMAND,
	ERROR_INVALID_TOKEN,
	ERROR_VERIFICATION_FAILED = 128,
	ERROR_DECRYPTION_FAILED,
	ERROR_MISSING_TARGET,
	ERROR_MESSAGE_FROM_SELF,
	ERROR_DUPLICATE_MESSAGE,
	ERROR_WRONG_TARGET,
}

const TTL = 255;
const LRUSIZE = 255;

export class VoidDHT extends DHT {
	protected _seq = 0;
	protected _ttl: number;
	protected _lru: LRU;

	protected _debugGossip: boolean;

	constructor(
		options: DHTOptions & {
			ttl?: number;
			lruSize?: number;
			debug?: { gossip?: boolean };
		} = {},
	) {
		super(options);

		this._ttl = options.ttl ?? TTL;
		this._lru = new LRU(options.lruSize ?? LRUSIZE);

		this._debugGossip = options.debug?.gossip ?? false;

		this.on("request", (req) => {
			switch (req.command) {
				case COMMAND.BROADCAST: {
					this.onbroadcast(req);
					break;
				}
				case COMMAND.MESSAGE: {
					this.onmessage(req);
					break;
				}
				case COMMAND.MESSAGE_FALLBACK: {
					this.onmessageFallback(req);
					break;
				}
				default:
					req.error(ERROR.ERROR_UNKNOWN_COMMAND);
			}
		});
	}

	get keyPair(): KeyPair {
		return this.defaultKeyPair;
	}

	private _debug(message: string, ...args: any[]) {
		if (this._debugGossip) {
			console.warn(message, ...args);
		}
	}

	async broadcast(
		message: Buffer,
		{ ttl, seq }: { ttl?: number; seq?: number } = {},
	): Promise<boolean> {
		seq = seq ?? ++this._seq;
		ttl = ttl ?? this._ttl;
		const data = Buffer.allocUnsafe(
			message.byteLength + sodium.crypto_sign_BYTES,
		);
		sodium.crypto_sign(data, message, this.keyPair.secretKey);
		return this._broadcast(data, {
			origin: this.keyPair.publicKey,
			ttl,
			seq,
		});
	}

	private async _broadcast(
		data: Buffer,
		{ origin, ttl, seq }: { origin: Buffer; ttl: number; seq: number },
	): Promise<boolean> {
		const stream = this.findNode(this.keyPair.publicKey);
		await stream.finished();
		return Promise.all(
			stream.closestNodes.map((addr) =>
				this.request(
					{
						command: COMMAND.BROADCAST,
						value: Broadcast.encode({
							origin,
							seq,
							ttl,
							data,
						}),
					},
					addr,
				),
			),
		)
			.then((resp) => resp.map((r) => !r.error))
			.then((errors) => errors.some((err) => err))
			.catch(() => false);
	}

	async send(
		target: Buffer,
		message: Buffer,
		{
			nonce,
			ttl,
			seq,
		}: { nonce?: Buffer; ttl?: number; seq?: number } = {},
	): Promise<boolean> {
		if (!nonce) {
			nonce = Buffer.allocUnsafe(sodium.crypto_box_NONCEBYTES);
			sodium.randombytes_buf(nonce);
		}
		seq = seq ?? ++this._seq;
		ttl = ttl ?? this._ttl;
		const publicKey = Buffer.allocUnsafe(sodium.crypto_box_PUBLICKEYBYTES);
		sodium.crypto_sign_ed25519_pk_to_curve25519(publicKey, target);
		const secretKey = Buffer.allocUnsafe(sodium.crypto_box_SECRETKEYBYTES);
		sodium.crypto_sign_ed25519_sk_to_curve25519(
			secretKey,
			this.keyPair.secretKey,
		);
		const data = Buffer.allocUnsafe(
			message.byteLength + sodium.crypto_box_MACBYTES,
		);
		sodium.crypto_box_easy(data, message, nonce, publicKey, secretKey);
		return this._send(target, data, {
			origin: this.keyPair.publicKey,
			nonce,
			ttl,
			seq,
		});
	}

	private async _send(
		target: Buffer,
		data: Buffer,
		{
			origin,
			nonce,
			ttl,
			seq,
		}: { origin: Buffer; nonce: Buffer; ttl: number; seq: number },
	): Promise<boolean> {
		const stream = this.findNode(this.keyPair.publicKey);
		await stream.finished();
		return Promise.all(
			stream.closestNodes.map((addr) =>
				this.request(
					{
						target,
						command: COMMAND.MESSAGE,
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
			.then((resp) => resp.map((r) => !r.error))
			.then((errors) => errors.some((err) => err))
			.catch(() => false);
	}

	async sendFallback(
		target: Buffer,
		message: Buffer,
		{
			nonce,
			ttl,
			seq,
		}: { nonce?: Buffer; ttl?: number; seq?: number } = {},
		to: Node,
		socket: Duplex,
	): Promise<Reply> {
		if (!nonce) {
			nonce = Buffer.allocUnsafe(sodium.crypto_box_NONCEBYTES);
			sodium.randombytes_buf(nonce);
		}
		seq = seq ?? ++this._seq;
		ttl = ttl ?? 0;
		const publicKey = Buffer.allocUnsafe(sodium.crypto_box_PUBLICKEYBYTES);
		sodium.crypto_sign_ed25519_pk_to_curve25519(publicKey, target);
		const secretKey = Buffer.allocUnsafe(sodium.crypto_box_SECRETKEYBYTES);
		sodium.crypto_sign_ed25519_sk_to_curve25519(
			secretKey,
			this.keyPair.secretKey,
		);
		const data = Buffer.allocUnsafe(
			message.byteLength + sodium.crypto_box_MACBYTES,
		);
		sodium.crypto_box_easy(data, message, nonce, publicKey, secretKey);
		return this._sendFallback(
			target,
			data,
			{ origin: this.keyPair.publicKey, nonce, ttl, seq },
			to,
			socket,
		);
	}

	private async _sendFallback(
		target: Buffer,
		data: Buffer,
		{
			origin,
			nonce,
			ttl,
			seq,
		}: { origin: Buffer; nonce: Buffer; ttl: number; seq: number },
		to: Node,
		socket: Duplex,
	): Promise<Reply> {
		return this.request(
			{
				target,
				command: COMMAND.MESSAGE_FALLBACK,
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

	protected onbroadcast(req: Request) {
		const { origin, seq, ttl, data } = Broadcast.decode(req.value);
		if (origin.equals(this.keyPair.publicKey)) {
			req.reply(null);
			return this._debug("Broadcast from self", origin, seq);
		}
		const key = origin.toString("hex") + seq;
		if (this._lru.get(key)) {
			req.reply(null);
			return this._debug("Duplicate broadcast", origin, seq);
		}
		this._lru.set(key, true);
		const message = Buffer.allocUnsafe(
			data.byteLength - sodium.crypto_sign_BYTES,
		);
		if (sodium.crypto_sign_open(message, data, origin)) {
			this.emit("broadcast", message, origin, { seq, hops: TTL - ttl });
		} else {
			req.error(ERROR.ERROR_VERIFICATION_FAILED);
			return this._debug("Broadcast verification failed", origin, seq);
		}
		if (ttl <= 0) {
			req.reply(null);
			return this._debug(
				"Broadcast at the end of TTL",
				origin,
				seq,
				ttl,
			);
		}
		this._broadcast(data, { origin, ttl, seq }).then((success) =>
			this._debug("Re-broadcast", origin, seq, success),
		);
		req.reply(null);
	}

	protected onmessage(req: Request) {
		const { origin, nonce, seq, ttl, data } = Broadcast.decode(req.value);
		if (!req.target) {
			req.error(ERROR.ERROR_MISSING_TARGET);
			return this._debug("Missing target for message", origin, seq);
		}
		if (origin.equals(this.keyPair.publicKey)) {
			req.reply(null);
			return this._debug("Message from self", origin, seq);
		}
		const key = origin.toString("hex") + seq;
		if (this._lru.get(key)) {
			req.reply(null);
			return this._debug("Duplicate message", origin, seq);
		}
		this._lru.set(key, true);
		if (this.keyPair.publicKey.equals(req.target)) {
			this._debug("Received message", origin, seq);
			const publicKey = Buffer.allocUnsafe(
				sodium.crypto_box_PUBLICKEYBYTES,
			);
			sodium.crypto_sign_ed25519_pk_to_curve25519(publicKey, origin);
			const secretKey = Buffer.allocUnsafe(
				sodium.crypto_box_SECRETKEYBYTES,
			);
			sodium.crypto_sign_ed25519_sk_to_curve25519(
				secretKey,
				this.keyPair.secretKey,
			);
			const message = Buffer.allocUnsafe(
				data.byteLength - sodium.crypto_box_MACBYTES,
			);
			if (
				sodium.crypto_box_open_easy(
					message,
					data,
					nonce as Buffer,
					publicKey,
					secretKey,
				)
			) {
				this.emit("message", message, origin, {
					seq,
					hops: TTL - ttl,
				});
			} else {
				req.error(ERROR.ERROR_DECRYPTION_FAILED);
				return this._debug("Message decryption failed", origin, seq);
			}
		}
		if (ttl <= 0) {
			req.reply(null);
			return this._debug("Message at the end of TTL", origin, seq, ttl);
		}
		this._send(req.target, data, {
			origin,
			nonce: nonce as Buffer,
			ttl,
			seq,
		}).then((success) => this._debug("Re-send message", origin, seq));
		req.reply(null);
	}

	protected onmessageFallback(req: Request) {
		const { origin, nonce, seq, data } = Broadcast.decode(req.value);
		if (!req.target) {
			req.error(ERROR.ERROR_MISSING_TARGET);
			return this._debug(
				"Missing target for fallback message",
				origin,
				seq,
			);
		}
		if (this.keyPair.publicKey.equals(origin)) {
			req.error(ERROR.ERROR_MESSAGE_FROM_SELF);
			return this._debug("Fallback message from self", origin, seq);
		}
		const key = origin.toString("hex") + seq;
		if (this._lru.get(key)) {
			req.error(ERROR.ERROR_DUPLICATE_MESSAGE);
			return this._debug("Duplicate fallback message", origin, seq);
		}
		this._lru.set(key, true);
		if (this.keyPair.publicKey.equals(req.target)) {
			this._debug("Received fallback message", origin, seq);
			const publicKey = Buffer.allocUnsafe(
				sodium.crypto_box_PUBLICKEYBYTES,
			);
			sodium.crypto_sign_ed25519_pk_to_curve25519(publicKey, origin);
			const secretKey = Buffer.allocUnsafe(
				sodium.crypto_box_SECRETKEYBYTES,
			);
			sodium.crypto_sign_ed25519_sk_to_curve25519(
				secretKey,
				this.keyPair.secretKey,
			);
			const message = Buffer.allocUnsafe(
				data.byteLength - sodium.crypto_box_MACBYTES,
			);
			if (
				sodium.crypto_box_open_easy(
					message,
					data,
					nonce as Buffer,
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
			req.error(ERROR.ERROR_DECRYPTION_FAILED);
			return this._debug(
				"Fallback message decryption failed",
				origin,
				seq,
			);
		}
		req.error(ERROR.ERROR_WRONG_TARGET);
	}
}
