use crate::block;
use crate::tx;
use crate::crypto;

use crypto::key;
use std::collections::HashMap;

static DIFFICULTY: usize = 3;
static GENESIS_PREV_BLOCK_HASH: &str = "000000000000000000000000000000000000000000000000000000000000000";

pub struct Node {
    pub blocks: Vec<block::Block>,
    pub balances: HashMap<key::PublicKey, u32>,
    pub mempool: Vec<tx::SignedTransaction>,
    pub keypair: crypto::KeyPair,
}

impl Node {
    fn get_block_reward (&self, block_number: usize) -> u32 {
        let halving = block_number / 1000;
        if halving >= 10 { return 0 }
        return 512 >> halving;
    }

    fn create_coinbase_tx (&self) -> tx::SignedTransaction {
        let reward = self.get_block_reward(self.blocks.len());
        return tx::create_signed(&self.keypair, self.keypair.public_key, reward)
    }

    fn make_genesis_block (&self) -> block::ProposedBlock {
        return block::ProposedBlock {
            prev_block: String::from(GENESIS_PREV_BLOCK_HASH),
            transactions: vec![self.create_coinbase_tx()]
        };
    }

    fn verify_block(&self, block: &block::Block) -> Result <(), &'static str> {
        if !block.hash.starts_with(&"0".repeat(DIFFICULTY)) { return Err("Block verification: Must contain correct PoW according to difficulty") }

        let block_hash = crypto::sha256(block.serialize());
        if hex::encode(block_hash) != block.hash { return Err("Block verification: Hash must match hash included in block") }

        let prev_block = self.blocks.last();
        let prev_block_hash = prev_block.map_or(GENESIS_PREV_BLOCK_HASH, |b| b.hash.as_str());
        if block.prev_block != prev_block_hash { return Err("Block verification: Must reference previous block's hash") }

        for (i, tx) in block.transactions.iter().enumerate() {
            if i == 0 { self.verify_coinbase_tx(&tx, self.blocks.len())? } else { self.verify_reg_tx(&tx)? };
        }

        // and many more

        return Ok(());
    }

    fn verify_tx(&self, tx: &tx::SignedTransaction) -> Result <(), &'static str> {
        if !tx.is_sig_valid() { return Err("Transaction verification: Invalid signature") }
        return Ok(());
    }

    fn verify_coinbase_tx(&self, tx: &tx::SignedTransaction, block_number: usize) -> Result <(), &'static str> {
        self.verify_tx(&tx)?;
        if tx.transaction.amount != self.get_block_reward(block_number) { return Err("Transaction verification: Coinbase amount not valid") }
        return Ok(());
    }

    fn verify_reg_tx(&self, tx: &tx::SignedTransaction) -> Result <(), &'static str> {
        self.verify_tx(&tx)?;
        let from_balance = self.balances.get(&tx.transaction.from);
        if *from_balance.unwrap_or(&0) < tx.transaction.amount { return Err("Transaction verification: Not enough balance") }
        return Ok(());
    }

    fn process_block_transactions(&mut self, block: &block::Block) {
        for (i, tx) in block.transactions.iter().enumerate() {
            // Coinbase (first tx in block) is allowed to create new supply (by not deducting a balance)
            if i > 0 { *self.balances.get_mut(&tx.transaction.from).unwrap() -= tx.transaction.amount } // Deduct balance
            *self.balances.entry(tx.transaction.to).or_insert(0) += tx.transaction.amount; // Add balance
        }
    }

    fn process_block(&mut self, block: &block::Block) -> Result<(), &'static str> {
        self.verify_block(&block)?;
        self.process_block_transactions(&block);
        self.blocks.push(block.clone());
        return Ok(());
    }

    pub fn send_transaction (&mut self, public_key: key::PublicKey, amount: u32) -> Result<tx::SignedTransaction, &'static str> {
        let tx = tx::create_signed(&self.keypair, public_key, amount);
        self.verify_reg_tx(&tx)?;
        self.mempool.push(tx.clone());
        return Ok(tx);
    }

    pub fn new_pubkey (&mut self) -> key::PublicKey {
        let random_key = crypto::KeyPair::new();
        return random_key.public_key;
    }

    pub fn mine (&mut self) -> Result<block::Block, &'static str> {
        let mut txs = vec![self.create_coinbase_tx()];
        txs.extend(self.mempool.clone());
        let prev_block = self.blocks.last().expect("Previous block does not exist");
        let proposed_block = block::ProposedBlock {
            prev_block: prev_block.hash.clone(),
            transactions: txs,
        };
        let block = proposed_block.mine(DIFFICULTY);
        self.process_block(&block)?;
        self.mempool = Vec::new();
        return Ok(block);
    }

    pub fn start (&mut self) -> Result<block::Block, &'static str> {
        let genesis_block = self.make_genesis_block().mine(DIFFICULTY);
        self.process_block(&genesis_block)?;
        return Ok(genesis_block);
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
