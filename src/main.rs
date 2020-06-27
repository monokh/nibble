use hex;
use secp256k1::{Secp256k1, Message};
use secp256k1::key::PublicKey;
use secp256k1::rand;
use sha2::{Sha256, Sha512, Digest};
use generic_array::GenericArray;


struct Transaction {
    from: PublicKey,
    to: PublicKey,
    amount: i32
}

impl Transaction{
    fn to_string(& self) -> String {
        return format!("{}{}{}", self.from, &self.to, hex::encode(&format!("{}", self.amount)));
    }

    fn hash(& self) -> Vec<u8> {
        return sha256(self.to_string())
    }
}

struct Block {
    hash: String,
    transactions: Vec<Transaction>
}

fn sha256 (payload: String) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(payload);
    return hasher.finalize().as_slice().to_vec()
}

fn main() {
    let difficulty = 2;
    let nonce = 0;
    let mut rand = rand::OsRng::new().unwrap();
    let secp = Secp256k1::new();

    let (private_key, public_key) = secp.generate_keypair(&mut rand);   

    let tx = Transaction {
        from: public_key,
        to: public_key,
        amount: 3423232
    };

    println!("Public Key: {}", public_key);

    println!("Signing TX");
    println!("TX Raw: {}", tx.to_string());
    println!("TX Hash: {}", hex::encode(tx.hash()));

    let message = match Message::from_slice(tx.hash().as_slice()) {
        Ok(msg) => msg,
        Err(e) => panic!("{}", e)
    };
    
    let sig = secp.sign(&message, &private_key);
    println!("TX Signed: {}", sig);
    assert!(secp.verify(&message, &sig, &public_key).is_ok());
    println!("TX verified against public key.");
    
}
