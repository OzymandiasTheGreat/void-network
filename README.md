# @screamingvoid/network

Extended network stack for the next version of Void experimental
social network app. Based on [hyperswarm](https://github.com/hyperswarm/hyperswarm) and [@hyperswarm/dht](https://github.com/hyperswarm/dht). Inspired by the excellent work of @RangerMauve ([hyper-flood](https://github.com/RangerMauve/hyper-flood) &
[hyper-presence](https://github.com/RangerMauve/hyper-presence)).

## Differences and changes from Hyperswarm

* Flood based gossiping implemented as [dht-rpc](https://github.com/mafintosh/dht-rpc) messages.
* Send unencrypted broadcasts to the entire network.
* Send encrypted messages to peers without prior connection.
* See who's online at any moment.
* See who's connected to who.
* Full network graph provided.
* Advertise public data to the network.
* Always know which topic peers have joined, even for server connections.
* Autodrop connections when leaving topics.
* Don't reconnect if there are no longer topics in common.
* String topics in the form of hashtags make topics easier to advertise and identify.
* Topics as hashes/random buffers still supported.
* See trending topics.
* Events for new topics on the network, peers joining topics, topics being forgotten, etc.

## API

### VoidSwarm

Main class for interacting with a the network. Extends
Hyperswarm. Only different/additional methods documented here, for full reference see official
Hyperswarm README.

Additional methods make use of custom data structures
from the [collections](http://www.collectionsjs.com/)
module, namely [FastMap](http://www.collectionsjs.com/fast-map) and [FastSet](http://www.collectionsjs.com/fast-set). These allow to index structures by Buffers/
Uint8Arrays and have good performance.

#### `const node = new VoidSwarm([options])`

Create VoidSwarm node. Additional options are:

* `userData`: Data to advertise to the network
* `encoding`: Encoding for the `userData`. Supports any encoding supported by the [codecs](https://github.com/mafintosh/codecs) module.
* `debug`: Includes 2 additional props:
	+ `gossip`: Log low level gossiping info
	+ `presence`: Log high level gossiping info

All options are passed to the VoidDHT instance (different from Hyperswarm). `dht` constructor option
is **NOT** currently supported. `dht` prop on an instance is still exposed.

#### Properties

##### `dht`

Instance of VoidDHT.

##### `userData`

Data advertised on the network. Reassign this prop to rebroadcast data to the network.

##### `graph`

[Graphology](https://graphology.github.io/) Graph of the network.

##### `bootstrapped`

Boolean. Indicates whether we have a picture of the network state.

##### `online`

FastSet of public keys of online peers.

##### `topics`

Map of known topics. Topics are indexed by their buffer form. Values are hashtags of named topics or null.

Includes `trending([named = true], [limit = 20])` method to see
popular topics. You can also get the count of peers for a topic
with `count(topic)` method.

#### Methods

##### `join(topic, [options])`

`join` now accepts `#hashtag` strings. They will be hashed to derive 32 byte buffer and the hashtag will be advertised on network along with the buffer. We call these *named topics*.

Options are same as for Hyperswarm (`{client = true, server = true }`).

##### `leave(topic)`

`leave` also accepts named topics.

##### `getPeerTopics(publicKey)`

Get the topics for peer whose public key is `publicKey` in the form of `{ client: FastMap<Uint8Array, string | null>, server: FastMap<Uint8Array, string | null> }`.

##### `getPeerConnectedTo(publicKey)`

Get the FastSet of peers this peer is currently
connected to.

##### `getPeerUserData(publicKey)`

Get the data this peer is advertising.

##### `updateUserData(data)`

Update this node's advertised data. `data` is merged
with previous data via `Object.assign`.

##### `broadcast(message)`

Broadcast `message` to the entire network. `message`
should be a Buffer/Uint8Array. Broadcasts are unencrypted, so anyone on the network will see them.
They are, however, signed.

##### `send(target, message)`

Send `message` to `target`. Both arguments should be
Buffers/Uint8Arrays. Message may pass more peers before reaching the target, however it is encrypted
and only target can decrypt it.

##### `on("bootstrap")`

Emitted when this node is bootstrapped. After this you should have a pretty good picture of the network
state.

##### `on("peer-join-seen", source, target)`

Emitted when peers connect to other peers.

##### `on("peer-leave-seen", source, target)`

Emitted when peers disconnect.

##### `on("peer-online", peer)`

Emitted when peer becomes reachable.

##### `on("peer-offline", peer)`

Emitted when peer becomes unreachable.

##### `on("peer-join", peer, connection)`

Emitted when connection to peer is established.
Emitted after Hyperswarm's "connection" event.

`connection` has the following structure:

```typescript
{
	publicKey: Uint8Array,
	client: boolean,
	server: boolean,
	socket: EncryptedSocket,
	info: PeerInfo,
}
```

##### `on("peer-leave", peer)`

Emitted when connection to peer drops.

##### `on("peer-topic-join", topic, meta, peer)`

Emitted when `peer` joins `topic`. `meta` includes
`name`, `client`, `server`. If topic name is not known, `name` will be `null`.

##### `on("peer-topic-leave", topic, peer)`

Emitted when peer leaves topic.

##### `on("topic-join", topic, name)`

Emitted when new topic appears in the network or topic name becomes known. `name` may be `null`.

##### `on("topic-leave", topic)`

Emitted when topic disappears from network.

##### `on("online", online)`

Emitted when available peers change.

##### `on("broadcast", message, origin)`

Emitted when broadcast received.

##### `on("message", message, origin)`

Emitted when private message received.
