use secp256k1::key::PublicKey;

use crate::crypto;

pub struct Transaction {
    pub from: PublicKey,
    pub to: PublicKey,
    pub amount: i32
}

impl Transaction{
    pub fn to_string(& self) -> String {
        return format!("{}{}{}", self.from, &self.to, hex::encode(&format!("{}", self.amount)));
    }

    pub fn hash(& self) -> Vec<u8> {
        return crypto::sha256(self.to_string())
    }
}

pub struct SignedTransaction {
    pub transaction: Transaction,
    pub sig: String,
}

impl SignedTransaction{
    pub fn to_string(& self) -> String {
        return format!("{}{}", self.transaction.to_string(), self.sig);
    }
}
