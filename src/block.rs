use hex;

use crate::transaction;
use crate::crypto;

#[derive(Debug)]
pub struct Block {
    pub hash: String,
    pub nonce: u32,
    pub transactions: Vec<transaction::SignedTransaction>,
}

pub struct ProposedBlock {
    pub transactions: Vec<transaction::SignedTransaction>
}

impl ProposedBlock {
    pub fn serialize(&self) -> String {
        return self.transactions.iter().fold(String::new(), |a, b| a + &b.to_string());
    }

    pub fn mine (self, difficulty: usize) -> Block {
        let mut nonce: u32 = 0;
        let block_string = self.serialize();
        
        loop {
            let block = format!("{}{}", block_string, nonce);
            let block_hash = hex::encode(crypto::sha256(block.clone()));
            if block_hash.starts_with(&"0".repeat(difficulty)) {
                return Block {
                    hash: block_hash,
                    nonce,
                    transactions: self.transactions
                }
            }
            nonce += 1;
        }
    }
}