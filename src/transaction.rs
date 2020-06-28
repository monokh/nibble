use secp256k1::key::PublicKey;

use crate::crypto;

#[derive(Debug)]
#[derive(Copy, Clone)]
pub struct Transaction {
    pub from: PublicKey,
    pub to: PublicKey,
    pub amount: u32
}

impl Transaction{
    pub fn serialize(&self) -> String {
        return format!("{}{}{}", self.from, &self.to, hex::encode(&format!("{}", self.amount)));
    }

    pub fn hash(&self) -> Vec<u8> {
        return crypto::sha256(self.serialize())
    }
}

#[derive(Debug)]
pub struct SignedTransaction {
    pub transaction: Transaction,
    pub sig: String,
}

impl SignedTransaction{
    pub fn to_string(& self) -> String {
        return format!("{}{}", self.transaction.serialize(), self.sig);
    }
}
