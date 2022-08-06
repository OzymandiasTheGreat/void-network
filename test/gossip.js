const test = require("brittle");
const { createDHT } = require("../lib/testnet");

test("Broadcast message", async function (t) {
	const { nodes } = await createDHT(16, t, { debug: { gossip: true } });

	t.plan(31);

	const data = Buffer.from("Hello, World!");

	const emitter = nodes[0];

	for (const node of nodes) {
		node.on("broadcast", (message, origin) => {
			t.alike(message, data);
			t.alike(origin, emitter.defaultKeyPair.publicKey);
		});
	}

	emitter.broadcast(data).then((res) => t.ok(res));
});

test("Send message", async function (t) {
	const [a, b] = await createDHT(2, t);

	t.plan(3);

	const data = Buffer.from("Hej, Verden!");

	a.on("message", (message, origin) => {
		t.alike(message, data);
		t.alike(origin, b.defaultKeyPair.publicKey);
	});

	b.send(a.defaultKeyPair.publicKey, data).then((res) => t.ok(res));
});

// This one completes successfully but then hangs the whole process
test.skip("Fallback message", async function (t) {
	const testnet = await createDHT(8, t);
	const a = testnet.createNode();
	const b = testnet.createNode();

	t.plan(4);

	const data = Buffer.from("Sveikas, Pasauli!");
	const repl = Buffer.from("Success!");

	a.on("message-fallback", (message, origin, reply) => {
		t.alike(message, data);
		t.alike(origin, b.defaultKeyPair.publicKey);
		server.close();
		reply(repl);
	});

	const server = a.createServer();
	await server.listen();

	const conn = b.connect(a.defaultKeyPair.publicKey);
	conn.on("open", () =>
		b
			.sendFallback(
				a.defaultKeyPair.publicKey,
				data,
				{},
				{
					host: conn.rawStream.remoteHost,
					port: conn.rawStream.remotePort,
				},
				conn.rawStream.socket,
			)
			.then((reply) => {
				t.absent(reply.error);
				t.alike(reply.value, repl);
				conn.end();
			}),
	);
});
