const test = require("brittle");
const swarm = require("./helpers/dht");

test("Broadcast message", async function (t) {
	const { nodes } = await swarm(t);

	t.plan(63);

	const data = Buffer.from("Hello, World!");

	const emitter = nodes[0];

	for (const node of nodes) {
		node.on("broadcast", (message, origin) => {
			t.alike(message, data);
			t.alike(origin, emitter.keyPair.publicKey);
		});
	}

	emitter.broadcast(data).then((res) => t.ok(res));
});

test("Send message", async function (t) {
	const [a, b] = await swarm(t, 2);

	t.plan(3);

	const data = Buffer.from("Hej, Verden!");

	a.on("message", (message, origin) => {
		t.alike(message, data);
		t.alike(origin, b.keyPair.publicKey);
	});

	b.send(a.keyPair.publicKey, data).then((res) => t.ok(res));
});

test.skip("Fallback message", async function (t) {
	const { newNode } = await swarm(t, 8);
	const a = newNode();
	const b = newNode();

	t.plan(4);

	const data = Buffer.from("Sveikas, Pasauli!");
	const repl = Buffer.from("Success!");

	a.on("message-fallback", (message, origin, reply) => {
		t.alike(message, data);
		t.alike(origin, b.keyPair.publicKey);
		server.close();
		reply(repl);
	});

	const server = a.createServer();
	await server.listen();

	const conn = b.connect(a.keyPair.publicKey);
	conn.on("open", () =>
		b
			.sendFallback(
				a.keyPair.publicKey,
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
