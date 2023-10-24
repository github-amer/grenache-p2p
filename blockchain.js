const crypto = require("crypto"),
  SHA256 = (message) =>
    crypto.createHash("sha256").update(message).digest("hex");

const SYSTEM_USER = "SYSTEM_USER";

class Block {
  constructor(timestamp = Date.now().toString(), data = []) {
    this.timestamp = timestamp;
    this.data = data;
    this.prevHash = "";
    this.hash = Block.getHash(this);
    this.nonce = 0;
  }

  static getHash(block) {
    return SHA256(
      block.prevHash +
        block.timestamp +
        JSON.stringify(block.data) +
        block.nonce
    );
  }

  mine(difficulty) {
    while (!this.hash.startsWith(Array(difficulty + 1).join("0"))) {
      this.nonce++;
      this.hash = Block.getHash(this);
    }
  }

  static hasValidTransactions(block, chain) {
    return block.data.every(
      (transaction) =>
        Transaction.isValid(transaction, chain) &&
        block.data.filter(
          (transaction) => transaction.from === SYSTEM_USER
        ).length === 1
    );
  }
}

class Blockchain {
  constructor() {
    // USER-1 is given 1000 from the system
    const setupTransaction = new Transaction(SYSTEM_USER, "USER-1", 1000);
    this.transactions = [];
    this.chain = [new Block(Date.now().toString(), [setupTransaction])];
    this.difficulty = 1;
    this.blockTime = 30000;
  }

  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }

  addBlock(block) {
    block.prevHash = this.getLastBlock().hash;
    block.hash = Block.getHash(block);
    block.mine(this.difficulty);
    this.chain.push(Object.freeze(block));

    this.difficulty +=
      Date.now() - parseInt(this.getLastBlock().timestamp) < this.blockTime
        ? 1
        : -1;
  }

  addTransaction(transaction) {
    if (Transaction.isValid(transaction, this)) {
      this.transactions.push(transaction);
    }
  }

  mineTransactions() {
    this.addBlock(new Block(Date.now().toString(), this.transactions));
    this.transactions = [];
  }

  getBalance(address) {
    let balance = 0;

    this.chain.forEach((block) => {
      block.data.forEach((transaction) => {
        if (transaction.from === address) {
          balance -= transaction.amount;
        }

        if (transaction.to === address) {
          balance += transaction.amount;
        }
      });
    });

    return balance;
  }

  static isValid(blockchain) {
    for (let i = 1; i < blockchain.chain.length; i++) {
      const currentBlock = blockchain.chain[i];
      const prevBlock = blockchain.chain[i - 1];

      if (
        currentBlock.hash !== Block.getHash(currentBlock) ||
        prevBlock.hash !== currentBlock.prevHash ||
        !Block.hasValidTransactions(currentBlock, blockchain)
      ) {
        return false;
      }
    }

    return true;
  }
}

class Transaction {
  constructor(from, to, amount) {
    this.from = from;
    this.to = to;
    this.amount = amount;
  }

  static isValid(tx, chain) {
    return (
      tx.from && tx.to && tx.amount && chain.getBalance(tx.from) >= tx.amount || tx.from === SYSTEM_USER)
    ;
  }
}

const Orderbook = new Blockchain();

module.exports = { Block, Transaction, Blockchain, Orderbook, SYSTEM_USER };


/* Test code

USER-1 transfers 10 to USER-2
const transaction = new Transaction("USER-1", "USER-2", 10);

Orderbook.addTransaction(transaction);

Orderbook.mineTransactions();
console.log(Orderbook.chain[0]);

console.log("USER-1 balance:", Orderbook.getBalance("USER-1")); // 990
console.log("USER-2 balance:", Orderbook.getBalance("USER-2")); // 10

*/
