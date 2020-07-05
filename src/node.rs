use crate::block;
use crate::transaction;
use crate::crypto;

use crypto::key;
use std::collections::HashMap;

static MINING_REWARD: u32 = 50;
static DIFFICULTY: usize = 3;
static GENESIS_PREV_BLOCK_HASH: &str = "000000000000000000000000000000000000000000000000000000000000000";

pub struct Node {
    blocks: Vec<block::Block>,
    balances: HashMap<key::PublicKey, u32>,
    mempool: Vec<transaction::SignedTransaction>,
    keypair: crypto::KeyPair,
}

impl Node {
    fn create_coinbase_tx (&self) -> transaction::SignedTransaction {
        return transaction::create_signed(&self.keypair, self.keypair.public_key, MINING_REWARD)
    }

    fn make_genesis_block (&self) -> block::ProposedBlock {
        let genesis_block = block::ProposedBlock {
            prev_block: String::from(GENESIS_PREV_BLOCK_HASH),
            transactions: vec![self.create_coinbase_tx()]
        };

        return genesis_block
    }

    fn verify_block(&self, block: &block::Block) -> Result <(), &'static str> {
        let block_hash = crypto::sha256(block.serialize());
        if hex::encode(block_hash) != block.hash { return Err("Block verification: Hash must match hash included in block") }

        let prev_block = self.blocks.last();
        let prev_block_hash = prev_block.map_or(GENESIS_PREV_BLOCK_HASH, |b| b.hash.as_str());
        if block.prev_block != prev_block_hash { return Err("Block verification: Must reference previous block's hash") }

        if !block.hash.starts_with(&"0".repeat(DIFFICULTY)) { return Err("Block verification: Must contain correct PoW according to difficulty") }

        for (i, tx) in block.transactions.iter().enumerate() {
            self.verify_transaction(&tx, i == 0)?;
        }

        // TODO: more validation required
        return Ok(());
    }

    fn verify_transaction(&self, tx: &transaction::SignedTransaction, is_coinbase: bool) -> Result <(), &'static str> {
        if !tx.is_sig_valid() { return Err("Transaction verification: Invalid signature") }

        let from_balance = self.balances.get(&tx.transaction.from);

        if !is_coinbase { // Coinbase is new issuance - it doesn't need a balance
            if *from_balance.unwrap_or(&0) < tx.transaction.amount { return Err("Transaction verification: Not enough balance") }
        }

        return Ok(());
    }

    fn process_block_transactions(&mut self, block: &block::Block) {
        for (i, tx) in block.transactions.iter().enumerate() {
            // Coinbase (first tx in block) is allowed to create new supply (by not deducting a balance)
            if i > 0 { *self.balances.get_mut(&tx.transaction.from).unwrap() -= tx.transaction.amount } // Deduct balance
            *self.balances.entry(tx.transaction.to).or_insert(0) += tx.transaction.amount; // Add balance
        }
    }

    fn process_block(&mut self, block: block::Block) {
        match self.verify_block(&block) {
            Ok(()) => {
                self.process_block_transactions(&block);
                println!("Mined block: {}", block.hash);
                println!("Balances: {:#?}", self.balances);
                self.blocks.push(block);
            },
            Err(e) => println!("{}", e),
        }
    }

    fn send_transaction (&mut self, tx: transaction::SignedTransaction) {
        match self.verify_transaction(&tx, false) {
            Ok(()) => {
                self.mempool.push(tx);
            },
            Err(e) => println!("{}", e),
        }
    }

    fn mine (&mut self) {
        loop {
            let random_key = crypto::KeyPair::new();
            self.send_transaction(transaction::create_signed(&self.keypair, random_key.public_key, 3));
            let mut txs = vec![self.create_coinbase_tx()];
            txs.extend(self.mempool.clone());
            let prev_block = self.blocks.last().expect("Previous block does not exist");
            let proposed_block = block::ProposedBlock {
                prev_block: prev_block.hash.clone(),
                transactions: txs,
            };
            let block = proposed_block.mine(DIFFICULTY);
            self.process_block(block);
            self.mempool = Vec::new();
        }
    }

    pub fn start (&mut self) {
        let genesis_block = self.make_genesis_block().mine(DIFFICULTY);
        self.process_block(genesis_block);
        self.mine();
    }

    pub fn new () -> Node {
        let keypair = crypto::KeyPair::new();
        return Node {
            keypair,
            blocks: Vec::new(),
            balances: HashMap::new(),
            mempool: Vec::new()
        }
    }
}
