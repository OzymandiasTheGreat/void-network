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

type PeerState = {
	ephemeral: boolean;
	lookingup: Buffer[];
	announcing: Buffer[];
	connected: Buffer[];
	userData?: Buffer | null;
};
const _pst: PeerState;

export const PeerState = {
	encode: (message: PeerState) => _buf,
	decode: (buffer: Buffer) => _pst,
};

export enum PacketType {
	CONNECTED = 1,
	DISCONNECTED,
	BOOTSTRAP_REQUEST,
	BOOTSTRAP_RESPONSE,
	STATE,
	BROADCAST,
	MESSAGE,
}

type GossipPacket = {
	type: PacketType;
	publicKey?: Buffer | null;
	state?: PeerState | null;
	bootstrap?: Record<string, PeerState>;
	userData?: Buffer | null;
};
const _gpc: GossipPacket;

export const GossipPacket = {
	encode: (message: GossipPacket) => _buf,
	decode: (buffer: Buffer) => _gpc,
};
