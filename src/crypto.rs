use sha2::{Sha256, Digest};
use secp256k1::{Secp256k1, Message};
use secp256k1::rand;
use secp256k1::All;
use secp256k1::Signature;
use std::str::FromStr;

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
    pub private_key: key::SecretKey,
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

    pub fn from(key: String) -> Result<KeyPair, secp256k1::Error> {
        let secp = Secp256k1::new();
        let private_key = key::SecretKey::from_str(&key)?;
        let public_key = key::PublicKey::from_secret_key(&secp, &private_key);
        return Ok(KeyPair {
            secp,
            public_key,
            private_key,
        });
    }

    pub fn sign(&self, message: &[u8]) -> Signature {
        let message = Message::from_slice(message).expect("message from slice");
        return self.secp.sign(&message, &self.private_key);
    }
}
