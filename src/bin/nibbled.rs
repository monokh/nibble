use nibble::node::Node;
use nibble::crypto::key;
use nibble::miner;
use nibble::rpc;

use std::sync::{Arc, Mutex};
use std::thread;

fn main() -> std::io::Result<()> {
    let node = Node::new();
    let node_ref = Arc::new(Mutex::new(node));
    {
        let mut node_inst = node_ref.lock().unwrap();
        let latest_block = node_inst.start().expect("Start failed");
        println!("Latest Block: {:#?}", latest_block);
        println!("Your Public Key: {}", node_inst.keypair.public_key);
    }

    let rpc_node_ref = node_ref.clone();
    let rpc_thread = thread::spawn(move || {
        rpc::run_server(rpc_node_ref)
    });

    let miner_node_ref = node_ref.clone();
    let miner_thread = thread::spawn(move || {
        miner::start_miner(miner_node_ref);
    });

    rpc_thread.join().unwrap();
    miner_thread.join().unwrap();

    return Ok(());
}
