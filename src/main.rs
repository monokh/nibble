mod block;
mod transaction;
mod crypto;

use crypto::key;

fn create_signed_tx(keypair: &crypto::KeyPair, to: key::PublicKey, amount: u32) -> transaction::SignedTransaction {
    let tx = transaction::Transaction {
        from: keypair.public_key,
        to,
        amount,
    };
    
    let sig = keypair.sign(&tx.hash());

    return transaction::SignedTransaction{
        transaction: tx,
        sig: sig.to_string(),
    };
}

fn main() {
    let keypair = crypto::KeyPair::new();
    let keypair2 = crypto::KeyPair::new();
    
    let tx1 = create_signed_tx(&keypair, keypair2.public_key, 123);
    let tx2 = create_signed_tx(&keypair2, keypair.public_key, 75);

    let txs = vec![tx1, tx2];

    let proposed_block = block::ProposedBlock {
        transactions: txs,
    };

    println!("Mining block with {} txs.", proposed_block.transactions.len());
    let block = proposed_block.mine(3);
    println!("Mined block: {:#?}", block);
}
