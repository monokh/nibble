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
        let mut block_hash: String = String::new();
        let block_string = self.serialize();
        
        while !block_hash.starts_with(&"0".repeat(difficulty)) {
            let block = format!("{}{}", block_string, nonce);
            block_hash = hex::encode(crypto::sha256(block.clone()));
            nonce += 1;
        }

        return Block {
            hash: block_hash,
            nonce,
            transactions: self.transactions
        }
    }
}