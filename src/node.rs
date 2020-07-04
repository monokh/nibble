use crate::block;
use crate::transaction;
use crate::crypto;

static MINING_REWARD: u32 = 50;
static DIFFICULTY: usize = 3;

pub struct Node {
    blocks: Vec<block::Block>,
    keypair: crypto::KeyPair,
}

impl Node {
    fn create_coinbase_tx (&self) -> transaction::SignedTransaction {
        return transaction::create_signed(&self.keypair, self.keypair.public_key, MINING_REWARD)
    }

    fn make_genesis_block (&self) -> block::ProposedBlock {
        let genesis_block = block::ProposedBlock {
            prev_block: String::from("000000000000000000000000000000000000000000000000000000000000000"),
            transactions: vec![self.create_coinbase_tx()]
        };

        return genesis_block
    }

    fn verify_block(&self, block: &block::Block) -> Result <(), &'static str> {
        let block_hash = crypto::sha256(block.serialize());
        if hex::encode(block_hash) != block.hash { return Err("Block hash must match hash included in block") }

        let prev_block = self.blocks.last().expect("Previous block does not exist");
        if block.prev_block != prev_block.hash { return Err("Block must reference previous block's hash") }

        if !block.hash.starts_with(&"0".repeat(DIFFICULTY)) { return Err("Block must contain correct PoW according to difficulty") }

        return Ok(());
    }

    fn process_block(&mut self, block: block::Block) {
        match self.verify_block(&block) {
            Ok(()) => {
                println!("Mined block: {}", block.hash);
                self.blocks.push(block);
            },
            Err(e) => println!("Validation Error: {}", e),
        }
    }
    
    fn mine (&mut self) {
        loop {
            let random_key = crypto::KeyPair::new();
            let txs = vec![
                self.create_coinbase_tx(),
                transaction::create_signed(&self.keypair, random_key.public_key, 3)
            ];
            let prev_block = self.blocks.last().expect("Previous block does not exist");
            let proposed_block = block::ProposedBlock {
                prev_block: prev_block.hash.clone(),
                transactions: txs,
            };
            let block = proposed_block.mine(DIFFICULTY);
            self.process_block(block);
        }
    }

    pub fn start (&mut self) {
        let genesis_block = self.make_genesis_block().mine(DIFFICULTY);
        self.blocks.push(genesis_block);
        self.mine();
    }

    pub fn new () -> Node {
        let keypair = crypto::KeyPair::new();
        return Node {
            keypair,
            blocks: Vec::new(),
        }
    }
}
