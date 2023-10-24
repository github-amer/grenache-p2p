# The BFX challenge

The requirements were very vague ('simplified P2P distributed exchange') and questions were not gauranteed to be answered in time so I made the following assumptions/simplifications.

## Ledger/Blockchain
* Created a ledger that moves funds from one user to another. This can be easily exteneded/modified to create buy/sell order matching engine if that is the intended outcome. However, the core of the assignment is to create a distributed orderbook that does not need to me maintained centrally so I focused on that.
* The ledger can only transfer funds between users and the functionality for loading it with funds/withdrawing funds is not implemented
* The ledger is initialized with a transaction that transfers 1000 from SYSTEM_USER to USER-1. SYSTEM_USER is a special account that is excluded from transaction validation and it is simply a workaround to load USER-1's account as the fund load/withdraw functionaity is not implemented.
* The ledger is implemented in [blockchain.js](blockchain.js) and the commented code simulates a transaction where USER-1 sends 10 to USER-2
* The [hash function](blockchain.js#L16) can be replaced with [Grenache DHT Put](https://github.com/bitfinexcom/grenache-nodejs-link#linkputdata-callback) after converting it to an async promise.
* For simplicity, did not implement rewards or gas when mining
* Did not include any unit test code as this seems out of scope

## P2P

The documenation for Grenache is not that great and some things do not work as expected.
* Used http peer-to-peer for node communication and the assumption is that a request should be sent to all nodes that anounce a service as per this [documentation](https://github.com/bitfinexcom/grenache#grenache-in-action-a-rpc-example). However, when tested only one of the workers received the request. The alternative method is to use Grenache Pub/Sub which can be found in the commented code. However, I did not use it as the documentation says it is experimental and it was bugy when tested.
* The implemenation is in [node.js](node.js) and I only implemented [CREATE_TRANSACTION](node.js#L54) and [REPLACE_BLOCKCHAIN](node.js#L62). Howerver, the code can be extended to allow new nodes to retreive the ledger when the first connect to the network.
* When a transaction is posted to worker, the worker simply adds it to its transaction list. after each request, the worker tries to mine any pending transactions and then asks other workers to update their blockchain accordingly. 
* To avoid race conditions [REQUEST_CHECK](node.js#L133) was implemented to ensure that the worker has the most up-to-date chain before commiting.


### Run

```
npm install
```

Blockchain.js - uncomment code to test it then run
```
node blockchain.js
```

To start the P2P network
```
node node.js
```