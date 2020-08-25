use crate::block;
use crate::tx;
use crate::crypto;
use crate::storage;

use crypto::key;
use rocksdb::{DB};
use std::fs;
use std::error::Error;
use std::path::Path;

pub static DIFFICULTY: usize = 3;
pub static GENESIS_PREV_BLOCK_HASH: &str = "000000000000000000000000000000000000000000000000000000000000000";
pub static BLOCKS_DB_PATH: &str = "data/blocks";
pub static BLOCKS_METADATA_DB_PATH: &str = "data/blocksmetadata";
pub static BALANCES_DB_PATH: &str = "data/balances";
pub static WALLET_PATH: &str = "data/wallet.key";
pub static DATA_DIR: &str = "data";

pub struct Node {
    pub mempool: Vec<tx::SignedTransaction>,
    pub keypair: crypto::KeyPair,

    pub db_blocks: DB,
    pub db_blocks_metadata: DB,
    pub db_balances: DB,
}

impl Node {
    fn get_block_reward (&self, block_number: usize) -> u32 {
        let halving = block_number / 1000;
        if halving >= 10 { return 0 }
        return 512 >> halving;
    }

    fn create_coinbase_tx (&self) -> Result<tx::SignedTransaction, String> {
        let latest_block_number = self.get_latest_block_number()?;
        let reward = self.get_block_reward(latest_block_number + 1);
        return Ok(tx::create_signed(&self.keypair, self.keypair.public_key, reward));
    }

    fn make_genesis_block (&self) -> Result<block::ProposedBlock, String> {
        let coinbase_tx = self.create_coinbase_tx()?;
        return Ok(block::ProposedBlock {
            prev_block: String::from(GENESIS_PREV_BLOCK_HASH),
            transactions: vec![coinbase_tx]
        });
    }

    fn get_latest_block(&self) -> Result<Option<block::Block>, String> {
        let block_hash = match storage::get_latest_block_hash(&self.db_blocks_metadata)? {
            Some(block_hash) => block_hash, // TODO: map?
            None => return Ok(None)
        };
        let block = storage::get_block(&self.db_blocks, &block_hash)?;
        return Ok(block);
    }

    pub fn get_latest_block_number(&self) -> Result<usize, String>{ // TODO: why is block number usize?
        let latest_block_hash = match storage::get_latest_block_hash(&self.db_blocks_metadata)? {
            Some(hash) => hash,
            None => return Ok(0)
        };
        let latest_block_number = storage::get_block_height(&self.db_blocks_metadata, &latest_block_hash)?.unwrap();
        return Ok(latest_block_number);
    }

    fn verify_block(&self, block: &block::Block) -> Result <(), String> {
        if !block.hash.starts_with(&"0".repeat(DIFFICULTY)) { return Err(String::from("Block verification: Must contain correct PoW according to difficulty")) }

        let block_hash = crypto::sha256(block.serialize());
        if hex::encode(block_hash) != block.hash { return Err(String::from("Block verification: Hash must match hash included in block")) }

        let prev_block = self.get_latest_block()?;
        let prev_block_hash = prev_block.map_or(String::from(GENESIS_PREV_BLOCK_HASH), |b| b.hash.clone());
        if block.prev_block != prev_block_hash { return Err(String::from("Block verification: Must reference previous block's hash")) }

        let prev_block_number = self.get_latest_block_number()?;

        for (i, tx) in block.transactions.iter().enumerate() {
            if i == 0 { self.verify_coinbase_tx(&tx, prev_block_number + 1)? } else { self.verify_reg_tx(&tx)? };
        }

        // and many more

        return Ok(());
    }

    fn verify_tx(&self, tx: &tx::SignedTransaction) -> Result <(), String> {
        if !tx.is_sig_valid() { return Err(String::from("Transaction verification: Invalid signature")) }
        return Ok(());
    }

    fn verify_coinbase_tx(&self, tx: &tx::SignedTransaction, block_number: usize) -> Result <(), String> {
        self.verify_tx(&tx)?;
        if tx.transaction.amount != self.get_block_reward(block_number) { return Err(String::from("Transaction verification: Coinbase amount not valid")) }
        return Ok(());
    }

    fn verify_reg_tx(&self, tx: &tx::SignedTransaction) -> Result <(), String> {
        self.verify_tx(&tx)?;
        let from_balance = storage::get_balance(&self.db_balances, tx.transaction.from)?.unwrap_or(0);
        if from_balance < tx.transaction.amount { return Err(String::from("Transaction verification: Not enough balance")) }
        return Ok(());
    }

    fn process_block_transactions(&mut self, block: &block::Block) -> Result<(), String> {
        for (i, tx) in block.transactions.iter().enumerate() {
            // Coinbase (first tx in block) is allowed to create new supply (by not deducting a balance)
            if i > 0 {
                let sender_balance = storage::get_balance(&self.db_balances, tx.transaction.from)?.unwrap_or(0);
                let sender_new_balance = sender_balance - tx.transaction.amount;
                storage::set_balance(&self.db_balances, tx.transaction.from, sender_new_balance)?;
            } // Deduct balance
            let receiver_balance = storage::get_balance(&self.db_balances, tx.transaction.to)?.unwrap_or(0);
            let new_receiver_balance = receiver_balance + tx.transaction.amount;
            storage::set_balance(&self.db_balances, tx.transaction.to, new_receiver_balance)?; // Add balance
        }
        return Ok(());
    }

    fn process_block(&mut self, block: &block::Block) -> Result<(), String> {
        self.verify_block(&block)?;
        self.process_block_transactions(&block)?;
        let prev_block_number = self.get_latest_block_number()?;
        storage::add_block(&self.db_blocks, &block)?;
        storage::set_latest_block(&self.db_blocks_metadata, &block.hash, prev_block_number + 1)?;
        return Ok(());
    }

    pub fn send_transaction (&mut self, public_key: key::PublicKey, amount: u32) -> Result<tx::SignedTransaction, String> {
        let tx = tx::create_signed(&self.keypair, public_key, amount);
        self.verify_reg_tx(&tx)?;
        self.mempool.push(tx.clone());
        return Ok(tx);
    }

    pub fn get_keypair () -> Result<crypto::KeyPair, Box<dyn Error>> {
        if Path::new(WALLET_PATH).exists() {
            let key = fs::read_to_string(WALLET_PATH)?;
            return Ok(crypto::KeyPair::from(key)?);
        }

        let keypair = crypto::KeyPair::new();
        fs::write(WALLET_PATH, keypair.private_key.to_string())?;
        return Ok(keypair);
    }

    pub fn start (&mut self) -> Result<block::Block, String> {
        let latest_block = match self.get_latest_block()? {
            Some(latest_block) => latest_block,
            None => {
                let unmined_genesis_block = self.make_genesis_block()?;
                let genesis_block = unmined_genesis_block.mine(DIFFICULTY);
                self.process_block(&genesis_block)?;
                genesis_block
            }
        };
        return Ok(latest_block);
    }

    pub fn get_proposed_block (&mut self) -> Result<block::ProposedBlock, String> {
        let mut txs = vec![self.create_coinbase_tx()?];
        txs.extend(self.mempool.clone());
        self.mempool = Vec::new(); // TODO: mempool should be preserved if block was not found
        let prev_block = self.get_latest_block().expect("Previous block does not exist").unwrap();
        return Ok(block::ProposedBlock {
            prev_block: prev_block.hash.clone(),
            transactions: txs,
        });
    }

    pub fn receive_block (&mut self, block: block::Block) -> Result<(), String> {
        self.process_block(&block)?;
        return Ok(());
    }

    pub fn new () -> Node {
        fs::create_dir_all(DATA_DIR).expect("Could not create data dir");
        return Node {
            keypair: Node::get_keypair().expect("Could not load wallet"),
            mempool: Vec::new(),
            db_blocks: DB::open_default(BLOCKS_DB_PATH).unwrap(),
            db_blocks_metadata: DB::open_default(BLOCKS_METADATA_DB_PATH).unwrap(),
            db_balances: DB::open_default(BALANCES_DB_PATH).unwrap()
        }
    }
}
