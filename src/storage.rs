use crate::block;
use crate::crypto;

use crypto::key;
use rocksdb::{DB};
use serde_json;
use std::collections::HashMap;
use std::str::FromStr;

pub fn add_block(db: &DB, block: &block::Block) -> Result<(), String> {
     let json = serde_json::to_string(block).map_err(|e| e.to_string())?;
     db.put(block.hash.clone(), json).map_err(|e| e.to_string())?;
     return Ok(());
}

pub fn get_block(db: &DB, block_hash: &String) -> Result<Option<block::Block>, String> {
     match db.get(block_hash.clone())? {
          Some(block) => {
               let block_s = String::from_utf8(block).map_err(|e| e.to_string())?;
               return Ok(Some(serde_json::from_str(&block_s).map_err(|e| e.to_string())?));
          },
          None => return Ok(None),
     }
}

pub fn set_latest_block(db: &DB, block_hash: &String, height: usize) -> Result<(), String> {
     db.put(b"latest_block_hash", block_hash.clone()).map_err(|e| e.to_string())?;
     db.put(block_hash.clone(), height.to_string()).map_err(|e| e.to_string())?;
     return Ok(());
}

pub fn get_latest_block_hash(db: &DB) -> Result<Option<String>, String> {
     match db.get(b"latest_block_hash")? {
          Some(hash) => return Ok(Some(String::from_utf8(hash).map_err(|e| e.to_string())?)),
          None => return Ok(None)
     };
}

pub fn get_block_height(db: &DB, block_hash: &String) -> Result <Option<usize>, String> {
     match db.get(block_hash.clone())? {
          Some(height) => {
               let height_s = String::from_utf8(height).map_err(|e| e.to_string())?;
               let height : usize = height_s.parse().unwrap();
               return Ok(Some(height));
          },
          None => return Ok(None),
     }
}

pub fn set_balance(db: &DB, public_key: key::PublicKey, balance: u32) -> Result <(), String> {
     db.put(public_key.to_string(), balance.to_string()).map_err(|e| e.to_string())?;
     return Ok(());
}

pub fn get_balance(db: &DB, public_key: key::PublicKey) -> Result <Option<u32>, String> {
     match db.get(public_key.to_string())? {
          Some(balance) => {
               let balance_s = String::from_utf8(balance).map_err(|e| e.to_string())?;
               let balance : u32 = balance_s.parse().unwrap();
               return Ok(Some(balance));
          },
          None => return Ok(None),
     };
}

pub fn get_balances(db: &DB) -> Result <HashMap<key::PublicKey, u32>, String> {
     let mut balances = HashMap::new();
     let mut iter = db.raw_iterator();
     iter.seek_to_first();
     while iter.valid() {
          let public_key = String::from_utf8(iter.key().unwrap().to_vec()).map_err(|e| e.to_string())?;
          let balance_s = String::from_utf8(iter.value().unwrap().to_vec()).map_err(|e| e.to_string())?;
          let balance : u32 = balance_s.parse().unwrap();
          balances.insert(crypto::key::PublicKey::from_str(&public_key).unwrap(), balance);
          iter.next();
     }
     return Ok(balances);
}