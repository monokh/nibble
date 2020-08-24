use jsonrpc_http_server::jsonrpc_core::{IoHandler, Value, Params};
use jsonrpc_http_server::{ServerBuilder};

use jsonrpc_core::{Error, Result};
use jsonrpc_core::futures::future::{self, FutureResult};
use jsonrpc_derive::rpc;

use crate::crypto;
use crate::node;
use crate::tx;
use crate::key;
use crate::storage;

use std::collections::HashMap;
use rocksdb::{DB, Options};
use std::sync::{Arc, Mutex};

#[rpc(server)]
pub trait Rpc {
	#[rpc(name = "protocolVersion")]
	fn protocol_version(&self) -> Result<String>;

	#[rpc(name = "send")]
	fn send(&self, pubkey: key::PublicKey, amount: u32) -> Result<tx::SignedTransaction>;

	#[rpc(name = "newpubkey")]
	fn newpubkey(&self) -> Result<String>;

	#[rpc(name = "getpubkey")]
	fn getpubkey(&self) -> Result<String>;

	#[rpc(name = "blockheight")]
	fn blockheight(&self) -> Result<usize>;

	#[rpc(name = "balances")]
	fn balances(&self) -> Result<HashMap<key::PublicKey, u32>>;

	#[rpc(name = "mempool")]
	fn mempool(&self) -> Result<Vec<tx::SignedTransaction>>;

	// #[rpc(name = "callAsync")]
	// fn call(&self, a: u64) -> FutureResult<String, Error>;
}

struct RpcImpl {
	node_ref: Arc<Mutex<node::Node>>,
	pub db_blocks: DB,
    pub db_blocks_metadata: DB,
    pub db_balances: DB
}

impl RpcImpl {
	fn new(node_ref: Arc<Mutex<node::Node>>) -> RpcImpl {
		return RpcImpl {
			node_ref,
			db_blocks: DB::open_for_read_only(&Options::default(), node::BLOCKS_DB_PATH, false).unwrap(),
            db_blocks_metadata: DB::open_for_read_only(&Options::default(), node::BLOCKS_METADATA_DB_PATH, false).unwrap(),
            db_balances: DB::open_for_read_only(&Options::default(), node::BALANCES_DB_PATH, false).unwrap()
		}
	}
}

impl Rpc for RpcImpl {
	fn protocol_version(&self) -> Result<String> {
		Ok("1.0".into())
	}

	fn send(&self, pubkey: key::PublicKey, amount: u32) -> Result<tx::SignedTransaction> {
		let mut node = self.node_ref.lock().unwrap();
		let tx = node.send_transaction(pubkey, amount).unwrap();
		return Ok(tx);
	}

	fn newpubkey(&self) -> Result<String> {
		let random_key = crypto::KeyPair::new();
		return Ok(random_key.public_key.to_string());
	}

	fn getpubkey(&self) -> Result<String> {
		let node = self.node_ref.lock().unwrap();
		return Ok(node.keypair.public_key.to_string());
	}

	fn blockheight(&self) -> Result<usize> {
		let node = self.node_ref.lock().unwrap();
		let blockheight = node.get_latest_block_number().unwrap();
		return Ok(blockheight);
	}

	fn balances(&self) -> Result<HashMap<key::PublicKey, u32>> {
		let balances = storage::get_balances(&self.db_balances).unwrap();
		return Ok(balances);
	}

	fn mempool(&self) -> Result<Vec<tx::SignedTransaction>> {
		let node = self.node_ref.lock().unwrap();
		return Ok(node.mempool.clone());
	}


	// fn call(&self, _: u64) -> FutureResult<String, Error> {
	// 	future::ok("OK".to_owned()).into()
	// }
}

pub fn run_server (node_ref: Arc<Mutex<node::Node>>) {
    let mut io = IoHandler::new();
    let rpc = RpcImpl::new(node_ref);
    io.extend_with(rpc.to_delegate());

    let rpc_path = "127.0.0.1:1337";

	let server = ServerBuilder::new(io)
		.threads(3)
		.start_http(&rpc_path.parse().unwrap())
		.unwrap();

    println!("{}", format!("Running RPC Server on {}", rpc_path));

	server.wait();
}