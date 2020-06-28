mod transaction;
mod crypto;

use hex;

struct Block {
    hash: String,
    transactions: Vec<transaction::Transaction>
}

fn main() {
    let difficulty = 2;
    let nonce = 0;

    let keypair = crypto::KeyPair::new();
    
    let tx = transaction::Transaction {
        from: keypair.public_key,
        to: keypair.public_key,
        amount: 3423232
    };

    println!("Public Key: {}", keypair.public_key);

    println!("Signing TX");
    println!("TX Raw: {}", tx.to_string());
    println!("TX Hash: {}", hex::encode(tx.hash()));
    
    let sig = keypair.sign(&tx.hash());

    let signed_tx = transaction::SignedTransaction{
        transaction: tx,
        sig: sig.to_string(),
    };
    println!("TX Signed: {}", signed_tx.to_string());
    // assert!(secp.verify(&message, &sig, &public_key).is_ok());
    // println!("TX verified against public key.");
    
}
