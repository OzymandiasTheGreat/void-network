const _buf: Buffer;

type Broadcast = {
	origin: Buffer;
	seq: number;
	ttl: number;
	data: Buffer;
	nonce?: Buffer;
};
const _brc: Broadcast;

export const Broadcast = {
	encode: (message: Broadcast) => _buf,
	decode: (buffer: Buffer) => _brc,
};
