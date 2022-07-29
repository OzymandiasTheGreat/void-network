const { VoidDHT } = require("../../lib/dht");

module.exports = async function (t, n = 32, bootstrap = []) {
	const nodes = [];
	const b = new VoidDHT({ bootstrap, ephemeral: false });
	await b.ready();
	if (!bootstrap.length) {
		bootstrap = [{ host: "127.0.0.1", port: b.address().port }];
	}
	while (nodes.length < n) {
		const node = new VoidDHT({ bootstrap, ephemeral: false });
		await node.ready();
		nodes.push(node);
	}
	t.teardown(async () => {
		for (const node of nodes) {
			await node.destroy();
		}
		await b.destroy();
	});
	return {
		nodes,
		bootstrap,
		newNode(options = {}) {
			const node = new VoidDHT({
				bootstrap,
				ephemeral: true,
				...options,
			});
			nodes.push(node);
			return node;
		},
		[Symbol.iterator]() {
			return nodes[Symbol.iterator]();
		},
	};
};
