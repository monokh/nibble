use crate::storage;
use crate::block;
use crate::tx;
use crate::node;

use colored::*;
use std::error;
use std::io::prelude::*;
use std::net::TcpListener;
use std::net::TcpStream;
use std::sync::{Arc, Mutex};
use std::sync::mpsc;
use std::thread;
use std::time;
use regex::Regex;

const MESSAGE_GET_BLOCK: &str = "GET_BLOCK";
const MESSAGE_GET_BLOCKS: &str = "GET_BLOCKS";
const MESSAGE_NEW_BLOCK: &str = "NEW_BLOCK";
const MESSAGE_NEW_PEER: &str = "NEW_PEER";
const MESSAGE_PING: &str = "PING";
const MESSAGE_NEW_TRANSACTION: &str = "NEW_TRANSACTION";

pub struct P2PData {
    peers: Vec<String>,
}

impl P2PData {
    pub fn new() -> Self {
        return Self {
            peers: vec![],
        }
    }
}

fn handle_get_blocks () -> Result <String, String> {
    let block_hashes = storage::get_block_hashes(&storage::db::blocks_md(true))?;
    return Ok(serde_json::to_string(&block_hashes).map_err(|e| e.to_string())?);
}

fn handle_get_block (block_hash: String) -> Result <String, String> {
    let block = storage::get_block(&storage::db::blocks(true), &block_hash)?;
    return Ok(serde_json::to_string_pretty(&block).unwrap());
}

fn handle_new_block (node_ref: Arc<Mutex<node::Node>>, miner_interrupt_tx: mpsc::Sender<()>, block: String) -> Result <String, String> {
    // TODO: fork resolution (heaviest chain)
    let block: block::Block = serde_json::from_str(&block).unwrap();
    let mut node = node_ref.lock().unwrap();
    let existing_block = storage::get_block(&storage::db::blocks(true), &block.hash)?;
    if let None = existing_block {
        println!("{} {} - TXs: {}", "New Block:".green(), block.hash, block.transactions.len());
        node.process_block(&block)?;
        miner_interrupt_tx.send(()).unwrap();
    }
    return Ok(String::from("OK"));
}

fn handle_new_transaction (node_ref: Arc<Mutex<node::Node>>, tx: String) -> Result <String, String> {
    let tx: tx::SignedTransaction = serde_json::from_str(&tx).unwrap();
    let mut node = node_ref.lock().unwrap();
    // TODO: Check if tx is duplicate
    node.new_transaction(&tx)?;
    return Ok(String::from("OK"));
}

fn handle_new_peer (node_ref: Arc<Mutex<node::Node>>, p2p_data_ref: Arc<Mutex<P2PData>>, peer: String) -> Result <String, Box<dyn error::Error>> {
    add_peer(node_ref, p2p_data_ref.clone(), peer.clone())?;
    let p2p_data = p2p_data_ref.lock().unwrap();
    let resp_peers: Vec<String> = p2p_data.peers.clone().into_iter().filter(|x| *x != peer).collect();
    return Ok(serde_json::to_string(&resp_peers)?);
}

fn handle_connection(node_ref: Arc<Mutex<node::Node>>, p2p_data_ref: Arc<Mutex<P2PData>>, miner_interrupt_tx: mpsc::Sender<()>, mut stream: TcpStream) -> Result<(), Box<dyn error::Error>> {
    let mut buffer = [0; 2048];

    stream.read(&mut buffer)?;

    let msg_raw = String::from_utf8_lossy(&buffer[..]);
    let msg = msg_raw.as_ref();

    let response = if msg.starts_with(MESSAGE_PING) {
        String::from("OK")
    } else if msg.starts_with(MESSAGE_GET_BLOCKS) {
        let block_hashes = handle_get_blocks()?;
        block_hashes
    } else if msg.starts_with(MESSAGE_GET_BLOCK) {
        let re = Regex::new(&format!(r"{}\((?P<hash>.*?)\)", MESSAGE_GET_BLOCK))?;
        let caps = re.captures(msg).unwrap();
        let block_hash = &caps["hash"];
        handle_get_block(block_hash.to_string())?
    } else if msg.starts_with(MESSAGE_NEW_BLOCK) {
        let re = Regex::new(&format!(r"{}\((?P<block>.*?)\)", MESSAGE_NEW_BLOCK))?;
        let caps = re.captures(msg).unwrap();
        let block = &caps["block"];
        handle_new_block(node_ref, miner_interrupt_tx, block.to_string())?
    } else if msg.starts_with(MESSAGE_NEW_PEER) {
        let re = Regex::new(&format!(r"{}\((?P<host>.*?)\)", MESSAGE_NEW_PEER))?;
        let caps = re.captures(msg).unwrap();
        let host = &caps["host"];
        handle_new_peer(node_ref, p2p_data_ref, host.to_string())?
    } else if msg.starts_with(MESSAGE_NEW_TRANSACTION) {
        let re = Regex::new(&format!(r"{}\((?P<tx>.*?)\)", MESSAGE_NEW_TRANSACTION))?;
        let caps = re.captures(msg).unwrap();
        let tx = &caps["tx"];
        handle_new_transaction(node_ref, tx.to_string())?
    } else {
        String::from("UNRECOGNIZED MESSAGE")
    };

    let final_response = format!("{}\r\n", response);

    stream.write(final_response.as_bytes())?;
    stream.flush()?;

    return Ok(());
}

fn send (peer: &String, req: String, data: Option<String>) -> Result<String, Box<dyn error::Error>> {
    let mut stream = TcpStream::connect(peer)?;

    let msg = match data {
        Some(data) => format!("{}({})", req, data),
        None => req
    };

    stream.write(&msg.as_bytes())?;
    let mut buffer = [0; 4096];
    stream.read(&mut buffer)?;

    let response_raw = String::from_utf8_lossy(&buffer[..]);
    let response_parts: Vec<&str> = response_raw.split("\r\n").collect();
    let response = response_parts[0].to_string();

    Ok(response)
}

pub fn publish (p2p_data_ref: Arc<Mutex<P2PData>>, req: String, data: String) -> Result<(), Box<dyn error::Error>>  {
    let p2p_data = p2p_data_ref.lock().unwrap();
    for peer in &p2p_data.peers {
        if let Err(_e) = send(peer, req.clone(), Some(data.clone())) {
            println!("{}", format!("Failed to publish to peer: {}", peer).red());
        }
    }
    Ok(())
}

pub fn publish_block(p2p_data_ref: Arc<Mutex<P2PData>>, block: block::Block) -> Result<(), Box<dyn error::Error>> {
    publish(p2p_data_ref, MESSAGE_NEW_BLOCK.to_string(), serde_json::to_string(&block)?)
}

pub fn publish_tx(p2p_data_ref: Arc<Mutex<P2PData>>, tx: tx::SignedTransaction) -> Result<(), Box<dyn error::Error>> {
    publish(p2p_data_ref, MESSAGE_NEW_TRANSACTION.to_string(), serde_json::to_string(&tx)?)
}

pub fn add_peer(node_ref: Arc<Mutex<node::Node>>, p2p_data_ref: Arc<Mutex<P2PData>>, addr: String) -> Result<(), Box<dyn error::Error>> {
    let mut p2p_data = p2p_data_ref.lock().unwrap();
    if !p2p_data.peers.contains(&addr) {
        println!("{} {}", "New Peer:".green(), addr);
        p2p_data.peers.push(addr.clone());
        check_peer_blocks(node_ref, addr.clone())?; // Doesn't seem right that adding new peer needs to immediately check blocks
    }
    Ok(())
}

pub fn init_node_list(node_ref: Arc<Mutex<node::Node>>, p2p_data_ref: Arc<Mutex<P2PData>>, bootstrap_node: String, self_addr: String) -> Result<(), Box<dyn error::Error>> {
    add_peer(node_ref.clone(), p2p_data_ref.clone(), bootstrap_node.clone())?;
    let resp = send(&bootstrap_node, MESSAGE_NEW_PEER.to_string(), Some(self_addr.clone()))?; // TODO: proper address
    let peers: Vec<String> = serde_json::from_str(&resp)?;
    for peer in peers {
        add_peer(node_ref.clone(), p2p_data_ref.clone(), peer.to_string())?;
        send(&peer, MESSAGE_NEW_PEER.to_string(), Some(self_addr.clone()))?;
    }
    Ok(())
}

pub fn check_peer_blocks(node_ref: Arc<Mutex<node::Node>>, peer: String) -> Result<(), Box<dyn error::Error>> {
    let blocks_resp = send(&peer, MESSAGE_GET_BLOCKS.to_string(), None)?;
    let block_hashes: Vec<String> = serde_json::from_str(&blocks_resp)?;

    let missing_hashes = match storage::get_latest_block_hash(&storage::db::blocks_md(true))? {
        Some(latest_block_hash) => {
            let position = block_hashes.iter().position(|x| *x == latest_block_hash);
            match position {
                Some(position) => block_hashes[(position + 1)..].to_vec(),
                None => vec![]
            }
        },
        None => {
            block_hashes
        }
    };

    for block_hash in missing_hashes {
        let block_raw = send(&peer, MESSAGE_GET_BLOCK.to_string(), Some(block_hash))?;
        let block: block::Block = serde_json::from_str(&block_raw)?;
        let mut node = node_ref.lock().unwrap();
        node.process_block(&block)?;
    }

    Ok(())
}

pub fn init(node_ref: Arc<Mutex<node::Node>>, p2p_data_ref: Arc<Mutex<P2PData>>,  host_addr: String, bootstrap_node: Option<String>) -> Result<(), Box<dyn error::Error>> {
    match bootstrap_node {
        Some(bootstrap_node) => {
            init_node_list(node_ref.clone(), p2p_data_ref.clone(), bootstrap_node, host_addr)?;
        },
        _ => ()
    }

    Ok(())
}

pub fn run_server(node_ref: Arc<Mutex<node::Node>>, p2p_data_ref: Arc<Mutex<P2PData>>, host_addr: String, miner_interrupt_tx: mpsc::Sender<()>) -> Result<(), Box<dyn error::Error>> {
    let listener = TcpListener::bind(&host_addr)?;

    println!("{} Listening on {}", "P2P:".green(), listener.local_addr()?.to_string()); 

    for stream in listener.incoming() {
        handle_connection(node_ref.clone(), p2p_data_ref.clone(), miner_interrupt_tx.clone(), stream?)?;
    }

    Ok(())
}

pub fn check_peers (p2p_data_ref: Arc<Mutex<P2PData>>) {
    let mut p2p_data = p2p_data_ref.lock().unwrap();
    p2p_data.peers.retain(|peer| if let Err(e) = send(peer, MESSAGE_PING.to_string(), None) { println!("Disconnected ({}) - {:?}", peer, e); return false; } else { return true });
}

pub fn run_receiver (p2p_data_ref: Arc<Mutex<P2PData>>, block_rx: mpsc::Receiver<block::Block>, transaction_rx: mpsc::Receiver<tx::SignedTransaction>) {
    let mut now = time::Instant::now();
    loop {
        // TODO: keep trying to reconnect to bootstrap nodes if they go offline
        if now.elapsed().as_secs() > 60 {
            check_peers(p2p_data_ref.clone());
            now = time::Instant::now();
        }

        if let Ok(block) = block_rx.try_recv() {
            publish_block(p2p_data_ref.clone(), block).unwrap();
        }
        if let Ok(tx) = transaction_rx.try_recv() {
            publish_tx(p2p_data_ref.clone(), tx).unwrap();
        }
        thread::sleep(time::Duration::from_millis(100));
    }
}