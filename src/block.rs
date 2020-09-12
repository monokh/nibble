use crate::tx;

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub hash: String,
    pub prev_block: String,
    pub nonce: u32,
    pub transactions: Vec<tx::SignedTransaction>,
}

impl Block {
    pub fn serialize(&self) -> String {
        let txs = self.transactions.iter().fold(String::new(), |a, b| a + &b.to_string());
        return format!("{}{}{}", self.prev_block, txs, self.nonce)
    }
}

pub struct ProposedBlock {
    pub prev_block: String,
    pub transactions: Vec<tx::SignedTransaction>
}

impl ProposedBlock {
    pub fn serialize(&self) -> String {
        let txs = self.transactions.iter().fold(String::new(), |a, b| a + &b.to_string());
        return format!("{}{}", self.prev_block, txs)
    }
}