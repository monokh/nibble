use jsonrpc_http_server::jsonrpc_core::{IoHandler};
use jsonrpc_http_server::{ServerBuilder};

use jsonrpc_core::{Result};
use jsonrpc_derive::rpc;

use crate::crypto;
use crate::node;
use crate::block;
use crate::tx;
use crate::storage;

use crypto::key;
use colored::*;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[rpc(server, client)]
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
	fn blockheight(&self) -> Result<u32>;

	#[rpc(name = "getblock")]
	fn getblock(&self, block_number: u32) -> Result<block::Block>;

	#[rpc(name = "balances")]
	fn balances(&self) -> Result<HashMap<key::PublicKey, u32>>;

	#[rpc(name = "getbalance")]
	fn getbalance(&self, pubkey: key::PublicKey) -> Result<u32>;

	#[rpc(name = "mempool")]
	fn mempool(&self) -> Result<Vec<tx::SignedTransaction>>;
}

struct RpcImpl {
	node_ref: Arc<Mutex<node::Node>>,
}

impl RpcImpl {
	fn new(node_ref: Arc<Mutex<node::Node>>) -> RpcImpl {
		return RpcImpl {
			node_ref
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

	fn blockheight(&self) -> Result<u32> {
		let blockheight = storage::get_latest_block_number(&storage::db::blocks_md(true)).unwrap();
		return Ok(blockheight);
	}

	fn getblock(&self, block_number: u32) -> Result<block::Block> {
		let block_hash = storage::get_block_hash(&storage::db::blocks_md(true), block_number).unwrap().unwrap();
		let block = storage::get_block(&storage::db::blocks(true), &block_hash).unwrap().unwrap();
		return Ok(block)
	}

	fn getbalance(&self, pubkey: key::PublicKey) -> Result<u32> {
		let balance = storage::get_balance(&storage::db::balances(true), pubkey).unwrap();
		return Ok(balance.unwrap_or(0));
	}

	fn balances(&self) -> Result<HashMap<key::PublicKey, u32>> {
		let balances = storage::get_balances(&storage::db::balances(true)).unwrap();
		return Ok(balances);
	}

	fn mempool(&self) -> Result<Vec<tx::SignedTransaction>> {
		let node = self.node_ref.lock().unwrap();
		return Ok(node.mempool.clone());
	}
}

pub fn run_server (node_ref: Arc<Mutex<node::Node>>, port: u32) {
    let mut io = IoHandler::new();
    let rpc = RpcImpl::new(node_ref);
    io.extend_with(rpc.to_delegate());

    let rpc_path = format!("127.0.0.1:{}", port);

	let server = ServerBuilder::new(io)
		.threads(3)
		.start_http(&rpc_path.parse().unwrap())
		.unwrap();

    println!("{} Listening on {}", "RPC:".green(), rpc_path);

	server.wait();
}