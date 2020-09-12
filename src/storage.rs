use crate::block;
use crate::crypto;

use crypto::key;
use rocksdb::{DB};
use serde_json;
use std::collections::HashMap;
use std::str::FromStr;

pub mod db {
     use rocksdb::{DB, Options};
     use crate::settings;

     static BLOCKS_DB_PATH: &str = "/blocks";
     static BLOCKS_METADATA_DB_PATH: &str = "/blocksmetadata";
     static BALANCES_DB_PATH: &str = "/balances";

     pub fn open(path: &str, read_only: bool) -> DB {
          let config = settings::Settings::new().unwrap();
          let full_path = format!("{}{}", config.data_dir, path);
          if read_only {
               return DB::open_for_read_only(&Options::default(), full_path, true).unwrap();
          } else {
               return DB::open_default(full_path).unwrap();
          }
     }

     pub fn blocks(read_only: bool) -> DB {
          return open(BLOCKS_DB_PATH, read_only);
     }

     pub fn blocks_md(read_only: bool) -> DB {
          return open(BLOCKS_METADATA_DB_PATH, read_only);
     }

     pub fn balances(read_only: bool) -> DB {
          return open(BALANCES_DB_PATH, read_only);
     }
}

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

pub fn set_latest_block(db: &DB, block_hash: &String, height: u32) -> Result<(), String> {
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

pub fn get_block_height(db: &DB, block_hash: &String) -> Result <Option<u32>, String> { // TODO: can String errors be dyn box?
     match db.get(block_hash.clone())? {
          Some(height) => {
               let height_s = String::from_utf8(height).map_err(|e| e.to_string())?;
               let height : u32 = height_s.parse().unwrap();
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

pub fn get_block_hashes(db: &DB) -> Result <Vec<String>, String> {
     let mut blocks = Vec::new();
     let mut iter = db.raw_iterator();
     iter.seek_to_first();
     while iter.valid() {
          let block_hash = String::from_utf8(iter.key().unwrap().to_vec()).map_err(|e| e.to_string())?;
          if block_hash != "latest_block_hash" {
               let block_number_s = String::from_utf8(iter.value().unwrap().to_vec()).map_err(|e| e.to_string())?;
               let block_number : u32 = block_number_s.parse().unwrap();
               blocks.push((block_number, block_hash));
          }
          iter.next();
     }

     blocks.sort_unstable_by(|a, b| a.0.cmp(&b.0));

     let block_hashes = blocks.iter().map(|x| x.1.clone()).collect();

     return Ok(block_hashes);
}

pub fn get_latest_block_number(db: &DB) -> Result<u32, String>{
     let latest_block_hash = match get_latest_block_hash(&db)? {
         Some(hash) => hash,
         None => return Ok(0)
     };
     let latest_block_number = get_block_height(&db, &latest_block_hash)?.unwrap();
     return Ok(latest_block_number);
}
