import {
	PacketType,
	Packet,
	Bootstrap,
	Persistence,
	Subscription,
} from "./schema";
import b4a from "b4a";

type PresencePacket = {
	type: PacketType;
	ephemeral?: boolean;
	bootstrap?: Bootstrap["bootstrap"];
	peer?: Uint8Array;
	topic?: Subscription;
	data?: Uint8Array;
	message?: Uint8Array;
};

export function decode(packet: Uint8Array): PresencePacket | null {
	let message: Packet;
	try {
		message = Packet.decode(packet);
	} catch {
		return null;
	}
	const presence: PresencePacket = { type: message.type };
	switch (message.type) {
		case PacketType.PERSISTENT:
			try {
				presence.ephemeral = Persistence.decode(
					message.payload as Uint8Array,
				).ephemeral;
				break;
			} catch {
				return null;
			}
		case PacketType.BOOTSTRAP_REQUEST:
			break;
		case PacketType.BOOTSTRAP_RESPONSE:
			try {
				presence.bootstrap = Bootstrap.decode(
					message.payload as Uint8Array,
				).bootstrap;
				break;
			} catch {
				return null;
			}
		case PacketType.CONNECTED:
		case PacketType.DISCONNECTED:
			presence.peer = message.payload as Uint8Array;
			break;
		case PacketType.TOPIC_JOIN:
		case PacketType.TOPIC_LEAVE:
			try {
				presence.topic = Subscription.decode(
					message.payload as Uint8Array,
				);
				break;
			} catch {
				return null;
			}
		case PacketType.USER_DATA:
			presence.data = message.payload as Uint8Array;
			break;
		case PacketType.BROADCAST:
		case PacketType.MESSAGE:
			presence.message = message.payload as Uint8Array;
			break;
		default:
			return null;
	}
	return presence;
}

export function encode(packet: PresencePacket): Uint8Array {
	let payload: Uint8Array | null;
	if (packet.ephemeral != null) {
		payload = Persistence.encode({ ephemeral: packet.ephemeral });
	} else if (packet.bootstrap != null) {
		payload = Bootstrap.encode({ bootstrap: packet.bootstrap });
	} else if (packet.peer != null) {
		payload = packet.peer;
	} else if (packet.topic != null) {
		payload = Subscription.encode(packet.topic);
	} else if (packet.data != null) {
		payload = packet.data;
	} else if (packet.message != null) {
		payload = packet.message;
	} else {
		payload = null;
	}
	return Packet.encode({ type: packet.type, payload });
}
