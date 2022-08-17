const _buf: Uint8Array;

type Broadcast = {
	origin: Uint8Array;
	seq: number;
	ttl: number;
	data: Uint8Array;
	nonce?: Uint8Array | null;
};
const _brc: Broadcast;

export const Broadcast = {
	encode: (message: Broadcast) => _buf,
	decode: (buffer: Uint8Array) => _brc,
};

export enum PacketType {
	PERSISTENT = 1,
	BOOTSTRAP_REQUEST,
	BOOTSTRAP_RESPONSE,
	CONNECTED,
	DISCONNECTED,
	TOPIC_JOIN,
	TOPIC_LEAVE,
	USER_DATA,
	BROADCAST,
	MESSAGE,
}

type Persistence = {
	ephemeral: boolean;
};
const _per: Persistence;

export const Persistence = {
	encode: (message: Persistence) => _buf,
	decode: (buffer: Uint8Array) => _per,
};

type Topic = {
	name: string;
	server: boolean;
	client: boolean;
};
const _top: Topic;

export const Topic = {
	encode: (message: Topic) => _buf,
	decode: (buffer: Uint8Array) => _top,
};

type BootstrapPeer = {
	connected: Uint8Array[];
	topics: Record<string, Topic>;
	userData: Uint8Array;
};
const _bpr: BootstrapPeer;

export const BootstrapPeer = {
	encode: (message: BootstrapPeer) => _buf,
	decode: (buffer: Uint8Array) => _bpr,
};

type Bootstrap = {
	bootstrap: Record<string, BootstrapPeer>;
};
const _bts: Bootstrap;

export const Bootstrap = {
	encode: (message: Bootstrap) => _buf,
	decode: (buffer: Uint8Array) => _bts,
};

type Subscription = {
	buffer: Uint8Array;
	topic: Topic;
};
const _sub: Subscription;

export const Subscription = {
	encode: (message: Subscription) => _buf,
	decode: (buffer: Uint8Array) => _sub,
};

type Packet = {
	type: PacketType;
	payload?: Uint8Array | null;
};
const _pac: Packet;

export const Packet = {
	encode: (message: Packet) => _buf,
	decode: (buffer: Uint8Array) => _pac,
};
