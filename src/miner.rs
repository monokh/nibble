use crate::node;
use crate::block;

use std::time;
use std::sync::mpsc;
use std::thread;
use std::sync::{Arc, Mutex};

pub fn start_miner(node_ref: Arc<Mutex<node::Node>>) {
    let (out_tx, out_rx) = mpsc::channel();
    let (in_tx, in_rx) = mpsc::channel();
    thread::spawn(move || {
        loop {
            if let Ok(proposed_block) = out_rx.try_recv() {
                let proposed_block: block::ProposedBlock = proposed_block;
                let block = proposed_block.mine(node::DIFFICULTY);
                in_tx.send(block).unwrap();
            }
            thread::sleep(time::Duration::from_millis(500));
        }
    });
    {
        let mut node = node_ref.lock().unwrap();
        let proposed_block = node.get_proposed_block().unwrap();
        out_tx.send(proposed_block).unwrap();
    }
    loop {
        if let Ok(block) = in_rx.try_recv() {
            let mut node = node_ref.lock().unwrap();
            node.receive_block(block).unwrap();
            let proposed_block = node.get_proposed_block().unwrap();
            out_tx.send(proposed_block).unwrap();
        };
        thread::sleep(time::Duration::from_millis(1000));
    }
}
