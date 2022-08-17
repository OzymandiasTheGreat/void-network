import type { DHTOptions } from "@hyperswarm/dht";
import type { HyperswarmConstructorOptions } from "hyperswarm";
import sodium from "sodium-universal";
import { VoidDHT } from "./dht";
import { VoidSwarm } from "./index";

function randInt(max: number): number {
	return Math.floor(Math.random() * max);
}

class TestnetDHT {
	nodes: VoidDHT[];
	bootstrap: { host: string; port: number }[];

	private bootstrapper: VoidDHT;

	constructor(
		nodes: VoidDHT[],
		bootstrap: { host: string; port: number }[],
		bootstrapper: VoidDHT,
	) {
		this.nodes = nodes;
		this.bootstrap = bootstrap;
		this.bootstrapper = bootstrapper;
	}

	createNode(options?: DHTOptions): VoidDHT {
		const node = new VoidDHT({
			ephemeral: true,
			bootstrap: this.bootstrap,
			...options,
		});
		this.nodes.push(node);
		return node;
	}

	async destroy() {
		for (const node of this.nodes) {
			await node.destroy();
		}
		await this.bootstrapper.destroy();
	}

	[Symbol.iterator]() {
		return this.nodes[Symbol.iterator]();
	}
}

class TestnetSwarm {
	nodes: VoidSwarm[];
	bootstrap: { host: string; port: number }[];
	topics: Buffer[];

	private bootstrapper: VoidDHT;

	constructor(
		nodes: VoidSwarm[],
		bootstrap: { host: string; port: number }[],
		bootstrapper: VoidDHT,
	) {
		this.nodes = nodes;
		this.bootstrapper = bootstrapper;
		this.bootstrap = bootstrap;
		this.topics = [Buffer.allocUnsafe(32), Buffer.allocUnsafe(32)];
		sodium.randombytes_buf(this.topics[0]);
		sodium.randombytes_buf(this.topics[1]);
	}

	async joinTopics() {
		for (let i = 0; i < this.nodes.length; i++) {
			if (i < 1) {
				await this.nodes[i].join(this.topics[0]).flushed();
				await this.nodes[i].join(this.topics[1]).flushed();
			} else if (i < 2) {
				await this.nodes[i].join(this.topics[0]).flushed();
			} else {
				await this.nodes[i].join(this.topics[1]).flushed();
			}
		}
	}

	createNode(options?: HyperswarmConstructorOptions & DHTOptions) {
		const node = new VoidSwarm({
			bootstrap: this.bootstrap,
			...options,
		});
		node.on("connection", (socket) => socket.on("error", () => {}));
		this.nodes.push(node);
		return node;
	}

	async destroy() {
		for (const node of this.nodes) {
			await node.destroy();
		}
		await this.bootstrapper.destroy();
	}

	[Symbol.iterator]() {
		return this.nodes[Symbol.iterator]();
	}
}

type Teardown = (executor: () => void | Promise<void>) => void;
type Options<T> =
	| (T & { teardown?: Teardown; host?: string; port?: number })
	| Teardown;

export async function createDHT(
	size = 16,
	options?: Options<DHTOptions>,
): Promise<TestnetDHT> {
	const swarm: VoidDHT[] = [];
	const teardown =
		typeof options === "function"
			? options
			: options?.teardown
			? options.teardown.bind(options)
			: () => {};
	const host = (options as any)?.host || "127.0.0.1";
	const port = (options as any)?.port || 49737;

	const bootstrapper = VoidDHT.bootstrapper(port, host);
	await bootstrapper.ready();

	const bootstrap = [{ host, port: bootstrapper.address().port }];

	while (swarm.length < size) {
		const node = new VoidDHT({
			bootstrap,
			ephemeral: false,
			firewalled: false,
			...options,
		});
		await node.ready();
		swarm.push(node);
	}

	const testnet = new TestnetDHT(swarm, bootstrap, bootstrapper);

	teardown(async function () {
		await testnet.destroy();
	});

	return testnet;
}

export async function createSwarm(
	size = 3, // My laptop can't handle bigger swarms
	options?: Options<DHTOptions & HyperswarmConstructorOptions>,
): Promise<TestnetSwarm> {
	const swarm: VoidSwarm[] = [];
	const teardown =
		typeof options === "function"
			? options
			: options?.teardown
			? options.teardown.bind(options)
			: () => {};
	const host = (options as any)?.host || "127.0.0.1";
	const port = (options as any)?.port || 49737;

	const bootstrapper = VoidDHT.bootstrapper(port, host);
	await bootstrapper.ready();

	const bootstrap = [{ host, port: bootstrapper.address().port }];

	while (swarm.length < size) {
		const node = new VoidSwarm({
			bootstrap,
			ephemeral: false,
			firewalled: false,
			...options,
		});
		node.on("connection", (socket) => socket.on("error", () => {}));
		await node.dht.ready();
		swarm.push(node);
	}

	const testnet = new TestnetSwarm(swarm, bootstrap, bootstrapper);

	teardown(async function () {
		await testnet.destroy();
	});

	console.time("SWARM");
	await testnet.joinTopics();
	console.timeEnd("SWARM");

	for (let i = 0; i < testnet.topics.length; i++) {
		console.log(`TOPIC #${i + 1}`, testnet.topics[i].toString("hex"));
	}

	return testnet;
}
