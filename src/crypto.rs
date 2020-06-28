use sha2::{Sha256, Digest};
use secp256k1::{Secp256k1, Message};
use secp256k1::rand;
use secp256k1::All;
use secp256k1::Signature;

pub mod key {
    pub use secp256k1::key::PublicKey;
    pub use secp256k1::key::SecretKey;
}

pub fn sha256 (payload: String) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(payload);
    return hasher.finalize().as_slice().to_vec()
}

pub struct KeyPair {
    secp: Secp256k1<All>, // TODO: how to make this global?
    pub public_key: key::PublicKey,
    private_key: key::SecretKey,
}

impl KeyPair {
    pub fn new() -> KeyPair {
        #[allow(deprecated)]
        let mut rand = rand::OsRng::new().unwrap();
        let secp = Secp256k1::new();
        let (private_key, public_key) = secp.generate_keypair(&mut rand);
        KeyPair {
            secp,
            public_key,
            private_key,
        }
    }

    pub fn sign(&self, message: &[u8]) -> Signature {
        let message = match Message::from_slice(message) {
            Ok(msg) => msg,
            Err(e) => panic!("{}", e)
        };
        
        return self.secp.sign(&message, &self.private_key);
    }
}