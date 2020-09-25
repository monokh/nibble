use crate::node;
use crate::block;
use crate::crypto;

use colored::*;
use std::time;
use std::sync::mpsc;
use std::thread;
use std::sync::{Arc, Mutex};

pub fn start_miner(node_ref: Arc<Mutex<node::Node>>, interrupt_rx: mpsc::Receiver<()>) {
    let (out_tx, out_rx) = mpsc::channel();
    let (in_tx, in_rx) = mpsc::channel();
    thread::spawn(move || {
        loop {
            if let Ok(proposed_block) = out_rx.try_recv() {
                let proposed_block: block::ProposedBlock = proposed_block;

                let mut nonce: u32 = 0;
                let block_string = proposed_block.serialize();
                loop {
                    if let Ok(()) = interrupt_rx.try_recv() {
                        in_tx.send(None).unwrap();
                        break;
                    }
                    let block = format!("{}{}", block_string, nonce);
                    let block_hash = hex::encode(crypto::sha256(block.clone()));
                    if block_hash.starts_with(&"0".repeat(node::DIFFICULTY)) {
                        let mined_block = block::Block {
                            hash: block_hash,
                            nonce,
                            prev_block: proposed_block.prev_block,
                            transactions: proposed_block.transactions
                        };
                        in_tx.send(Some(mined_block)).unwrap();
                        break;
                    }
                    // Artificially limit hash rate to avoid unnecessary cpu usage
                    thread::sleep(time::Duration::from_millis(80));
                    nonce += 1;
                }
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
            if let Some(block) = block {
                println!("{} {}", "Mined Block:".green(), block.hash);
                node.receive_block(block).unwrap();
            }
            let proposed_block = node.get_proposed_block().unwrap();
            out_tx.send(proposed_block).unwrap();
        };
        thread::sleep(time::Duration::from_millis(1000));
    }
}
