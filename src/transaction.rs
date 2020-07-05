use secp256k1::key::PublicKey;
use secp256k1::{Secp256k1, Signature, Message};
use std::str::FromStr;

use crate::crypto;

use crypto::key;

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
#[derive(Clone)]
pub struct SignedTransaction {
    pub transaction: Transaction,
    pub sig: String,
}

impl SignedTransaction{
    pub fn to_string(& self) -> String {
        return format!("{}{}", self.transaction.serialize(), self.sig);
    }

    pub fn is_sig_valid(& self) -> bool {
        let secp = Secp256k1::verification_only();
        let unsgined_tx_hash = Message::from_slice(self.transaction.hash().as_slice()).expect("message from slice");
        let sig = Signature::from_str(self.sig.as_str()).expect("signature from string");
        return secp.verify(&unsgined_tx_hash, &sig, &self.transaction.from).is_ok();
    }
}

pub fn create_signed(keypair: &crypto::KeyPair, to: key::PublicKey, amount: u32) -> SignedTransaction {
    let tx = Transaction {
        from: keypair.public_key,
        to,
        amount,
    };

    let sig = keypair.sign(&tx.hash());

    return SignedTransaction{
        transaction: tx,
        sig: sig.to_string(),
    };
}
