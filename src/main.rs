mod node;
mod block;
mod tx;
mod crypto;
mod storage;

use clap::{Arg, App, SubCommand};
use node::Node;
use crypto::key;

use std::io;
use std::io::Write;
use std::str::FromStr;

fn main() -> std::io::Result<()> {
    let mut node = Node::new();
    let latest_block = node.start().expect("Start failed");
    println!("Latest Block: {:#?}", latest_block);
    println!("Your Public Key: {}", node.keypair.public_key);

    let cli = App::new("Nibble")
    .version("1.0")
    .author("monokh")
    .about("Bitcoin")
    .subcommand(SubCommand::with_name("newpubkey")
                .about("Generate a random pubkey"))
    .subcommand(SubCommand::with_name("mempool")
                .about("Returns the transactions in the mempool"))
    .subcommand(SubCommand::with_name("balances")
                .about("Returns balances for each pubkey known by the node"))
    .subcommand(SubCommand::with_name("mine")
                .about("Mine a block"))
    .subcommand(SubCommand::with_name("send")
                .about("Send a transaction")
                .arg(Arg::with_name("pubkey")
                    .required(true)
                    .index(1))
                    .about("Pubkey of receiver")
                .arg(Arg::with_name("amount")
                    .required(true)
                    .index(2))
                    .about("Amount to send"));

    loop {
        print!("> ");
        io::stdout().flush().unwrap();

        let mut input = String::new();
        io::stdin().read_line(&mut input)?;

        let mut args = vec!["nibble"];
        let params = input.trim().split(" ");
        args.extend(params);

        match cli.clone().get_matches_from_safe(args) {
            Ok(matches) => {
                if let Some(_) = matches.subcommand_matches("mine") {
                    match node.mine() {
                        Ok(block) => println!("{:#?}", block),
                        Err(e) => println!("{}", e),
                    };
                }

                if let Some(_) = matches.subcommand_matches("newpubkey") {
                    println!("{}", node.new_pubkey());
                }

                if let Some(_) = matches.subcommand_matches("mempool") {
                    println!("{:#?}", node.mempool);
                }

                if let Some(_) = matches.subcommand_matches("balances") {
                    println!("{{");
                    for (&pubkey, &amount) in &storage::get_balances(&node.db_balances).unwrap() {
                        println!("    {}: {}", pubkey, amount);
                    }
                    println!("}}");
                }

                if let Some(cmd) = matches.subcommand_matches("send") {
                    let pubkey = cmd.value_of("pubkey").unwrap();
                    let amount : u32 = cmd.value_of("amount").unwrap().parse().unwrap();
                    match node.send_transaction(key::PublicKey::from_str(pubkey).unwrap(), amount) {
                        Ok(tx) => println!("{:#?}", tx),
                        Err(e) => println!("{}", e),
                    };
                }
            },
            Err(e) => {
                println!("{}", e);
            }
        }
    }
}
