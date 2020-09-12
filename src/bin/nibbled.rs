use nibble::node::Node;
use nibble::miner;
use nibble::rpc;
use nibble::p2p;
use nibble::settings;

use std::sync::{Arc, Mutex};
use std::sync::mpsc;
use std::thread;

fn main() -> std::io::Result<()> {
    let config = settings::Settings::new().unwrap();

    let p2p_data = p2p::P2PData::new();
    let p2p_data_ref = Arc::new(Mutex::new(p2p_data));

    // Broadcasting blocks and transactions
    let (block_tx, block_rx) = mpsc::channel();
    let (transaction_tx, transaction_rx) = mpsc::channel();

    // Interrupt the miner when new blocks are received through the network
    let (miner_interrupt_tx, miner_interrupt_rx) = mpsc::channel(); 

    let receiver_p2p_data_ref = p2p_data_ref.clone();
    let receiver_thread = thread::spawn(move || {
        p2p::run_receiver(receiver_p2p_data_ref, block_rx, transaction_rx);
    });

    let node = Node::new(block_tx, transaction_tx);
    let node_ref = Arc::new(Mutex::new(node));
    {
        let mut node_inst = node_ref.lock().unwrap();
        let latest_block = node_inst.start().expect("Start failed");
        println!("Latest Block: {:#?}", latest_block);
        println!("Your Public Key: {}", node_inst.keypair.public_key);
    }

    let rpc_node_ref = node_ref.clone();
    let rpc_port = config.rpc_port.clone();
    let rpc_thread = thread::spawn(move || {
        rpc::run_server(rpc_node_ref, rpc_port)
    });

    let p2p_node_ref = node_ref.clone();
    let tcp_port = config.tcp_port.clone();
    let server_p2p_data_ref = p2p_data_ref.clone();
    let host_addr = format!("127.0.0.1:{}", tcp_port); // TODO: real address
    let run_server_host_addr = host_addr.clone();
    let p2p_thread = thread::spawn(move || {
        p2p::run_server(p2p_node_ref, server_p2p_data_ref, run_server_host_addr, miner_interrupt_tx).unwrap();
    });

    let p2p_node_ref = node_ref.clone();
    let miner_thread = if config.miner_enabled {
        let miner_node_ref = node_ref.clone();
        Some(thread::spawn(move || {
            miner::start_miner(miner_node_ref, miner_interrupt_rx);
        }))
    } else { None };

    let p2p_data_ref = p2p_data_ref.clone();
    let init_host_addr = host_addr.clone();
    p2p::init(p2p_node_ref, p2p_data_ref, init_host_addr, config.bootstrap_node).unwrap();

    rpc_thread.join().unwrap();
    p2p_thread.join().unwrap();
    receiver_thread.join().unwrap();
    match miner_thread {
        Some(thread) => thread.join().unwrap(),
        None => (),
    }

    return Ok(());
}
