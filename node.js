const Link = require("grenache-nodejs-link");
const { PeerRPCServer, PeerRPCClient } = require("grenache-nodejs-http");
const { PeerPub, PeerSub } = require("grenache-nodejs-ws");
const {
  Block,
  Blockchain,
  Transaction,
  Orderbook,
  SYSTEM_USER,
} = require("./blockchain");

// Setup Server
const linkServer = new Link({
  grape: "http://127.0.0.1:30001",
});
linkServer.start();

console.log("Started a link on grape: ", linkServer.conf.grape);

const peerServer = new PeerRPCServer(linkServer, {});
peerServer.init();
console.log("Initialized RPC peerServer on link: ", peerServer.link.conf.grape);

const service = peerServer.transport("server");
service.listen(Math.ceil(Math.random() * 1000) + 1024);
console.log("Server is listening on port: ", service.port);

const nodeName = "Node-" + service.port;
const serviceName = "EXCHANGE";

setInterval(function () {
  linkServer.announce(serviceName, service.port, {});
}, 1000);

// Setup Client
const linkClient = new Link({
  grape: "http://127.0.0.1:30001",
});
linkClient.start();
const peerClient = new PeerRPCClient(linkClient, {});
peerClient.init();
console.log("Initialized RPC peerClient on link: ", peerClient.link.conf.grape);

// Handle requests
let check = [];
let checked = [];
let checking = false;
let tempOrderBook = new Blockchain();
service.on("request", (rid, key, payload, handler) => {
  if (payload.node === nodeName) {
    console.log("Nothing to do!");
  } else {
    switch (payload.action) {
      case "CREATE_TRANSACTION":
        const transaction = new Transaction(
          payload.data.from,
          payload.data.to,
          payload.data.amount
        );
        Orderbook.addTransaction(transaction);
        break;
      case "REPLACE_BLOCKCHAIN":
        const [newBlock, newDiff] = payload.data;

        const ourTx = [
          ...Orderbook.transactions.map((tx) => JSON.stringify(tx)),
        ];
        const theirTx = [
          ...newBlock.data
            .filter((tx) => tx.from !== SYSTEM_USER)
            .map((tx) => JSON.stringify(tx)),
        ];
        const n = theirTx.length;

        if (newBlock.prevHash !== Orderbook.getLastBlock().prevHash) {
          for (let i = 0; i < n; i++) {
            const index = ourTx.indexOf(theirTx[0]);

            if (index === -1) break;

            ourTx.splice(index, 1);
            theirTx.splice(0, 1);
          }

          if (
            theirTx.length === 0 &&
            SHA256(
              Orderbook.getLastBlock().hash +
                newBlock.timestamp +
                JSON.stringify(newBlock.data) +
                newBlock.nonce
            ) === newBlock.hash &&
            newBlock.hash.startsWith(
              "000" +
                Array(
                  Math.round(Math.log(Orderbook.difficulty) / Math.log(16) + 1)
                ).join("0")
            ) &&
            Block.hasValidTransactions(newBlock, Orderbook) &&
            (parseInt(newBlock.timestamp) >
              parseInt(Orderbook.getLastBlock().timestamp) ||
              Orderbook.getLastBlock().timestamp === "") &&
            parseInt(newBlock.timestamp) < Date.now() &&
            Orderbook.getLastBlock().hash === newBlock.prevHash &&
            (newDiff + 1 === Orderbook.difficulty ||
              newDiff - 1 === Orderbook.difficulty)
          ) {
            Orderbook.chain.push(newBlock);
            Orderbook.difficulty = newDiff;
            Orderbook.transactions = [...ourTx.map((tx) => JSON.parse(tx))];
          }
        } else if (
          !checked.includes(
            JSON.stringify([
              newBlock.prevHash,
              Orderbook.chain[Orderbook.chain.length - 2].timestamp || "",
            ])
          )
        ) {
          checked.push(
            JSON.stringify([
              Orderbook.getLastBlock().prevHash,
              Orderbook.chain[Orderbook.chain.length - 2].timestamp || "",
            ])
          );

          const position = Orderbook.chain.length - 1;

          checking = true;
          peerClient.request(
            serviceName,
            {
              action: "REQUEST_CHECK",
              payload: [
                Orderbook.getLastBlock(),
                Orderbook.transactions,
                Orderbook.difficulty,
              ],
            },
            { timeout: 10000 },
            (err, data) => {
              if (err) {
                console.error(err);
              }
              console.log(data);
            }
          );

          setTimeout(() => {
            checking = false;

            let mostAppeared = check[0];

            check.forEach((group) => {
              if (
                check.filter((_group) => _group === group).length >
                check.filter((_group) => _group === mostAppeared).length
              ) {
                mostAppeared = group;
              }
            });

            const group = JSON.parse(mostAppeared);

            Orderbook.chain[position] = group[0];
            Orderbook.transactions = [...group[1]];
            Orderbook.difficulty = group[2];

            check.splice(0, check.length);
          }, 5000);
        }

        break;
      case "REQUEST_CHECK":
        if (checking) check.push(payload.data);
        break;

      default:
        handler.reply(new Error("Invalid Request"));
        break;
    }

    // Mine any pending transactions and notify other nodes to update their chain
    if (Orderbook.transactions.length !== 0) {
      Orderbook.mineTransactions();
      peerClient.request(
        serviceName,
        {
          action: "BLOCK",
          data: [Orderbook.getLastBlock(), Orderbook.difficulty],
        },
        { timeout: 10000 },
        (err, data) => {
          if (err) {
            console.error(err);
          }
          console.log(data);
        }
      );
    }
  }
  handler.reply(null, "Echoing back: " + payload);
});

/*
// Setup Server
const linkPub = new Link({
  grape: "http://127.0.0.1:30001",
});
linkPub.start();

console.log("Started a link on grape: ", linkPub.conf.grape);

const peerPub = new PeerPub(linkPub, {});
peerPub.init();
console.log("Initialized RPC peerPub on link: ", peerPub.link.conf.grape);

const servicePub = peerPub.transport("server");
servicePub.listen(Math.ceil(Math.random() * 1000) + 1024);
console.log("Server is listening on port: ", servicePub.port);

const nodeName = "Node-" + servicePub.port;
setInterval(function () {
  linkPub.announce("exchange-nodes", servicePub.port, {});
  //console.log("Announced exchange on link port:", service.port);
}, 1000);

setInterval(() => {
  servicePub.pub(JSON.stringify({
    node: nodeName,
    message: {
      a: "b",
    },
  }));
}, 1000);
const linkSub = new Link({
  grape: "http://127.0.0.1:30001",
});
linkSub.start();
const peerSub = new PeerSub(linkSub, {});
peerSub.init();
console.log("Initialized RPC peerSub on link: ", peerSub.link.conf.grape);

setInterval(function () {
  peerSub.sub("exchange-nodes", { timeout: 10000 });

  peerSub.on("connected", () => {
    console.log("connected");
  });

  peerSub.on("disconnected", () => {
    console.log("disconnected");
  });

  peerSub.on("message", (msg) => {
    message = JSON.parse(msg)
    if (message.node === nodeName) {
      console.log("nothig to do");
    } else {
      console.log(msg);
    }
  });
}, 3000);
*/