use nibble::tx;
use nibble::crypto::key;

use clap::{Arg, App, SubCommand};
use tokio;
use std::io;
use std::io::Write;
use std::collections::HashMap;
use std::str::FromStr;
use jsonrpc_client_http::HttpTransport;

#[macro_use] extern crate jsonrpc_client_core;

jsonrpc_client!(pub struct NibbleClient {
    pub fn newpubkey(&mut self) -> RpcRequest<String>;
    pub fn getpubkey(&mut self) -> RpcRequest<String>;
    pub fn send(&mut self, pubkey: key::PublicKey, amount: u32) -> RpcRequest<tx::SignedTransaction>;
    pub fn blockheight(&mut self) -> RpcRequest<u32>;
    pub fn balances(&mut self) -> RpcRequest<HashMap<key::PublicKey, u32>>;
    pub fn getbalance(&mut self, pubkey: key::PublicKey) -> RpcRequest<u32>;
    pub fn mempool(&mut self) -> RpcRequest<Vec<tx::SignedTransaction>>;
});

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = App::new("Nibble")
    .version("1.0")
    .author("monokh")
    .about("Bitcoin")
    .arg(Arg::with_name("rpc-url")
        .help("RPC Url to connect to")
        .short("rpc")
        .long("rpc-url")
        .value_name("RPC PORT")
        .default_value("http://localhost:1337")
        .global(true)
    )
    .subcommand(SubCommand::with_name("getpubkey")
                .about("Get node's public key"))
    .subcommand(SubCommand::with_name("newpubkey")
                .about("Generate a random pubkey"))
    .subcommand(SubCommand::with_name("mempool")
                .about("Returns the transactions in the mempool"))
    .subcommand(SubCommand::with_name("balances")
                .about("Returns balances for each pubkey known by the node"))
    .subcommand(SubCommand::with_name("getbalance")
                .about("Return the balance of a pubkey")
                .arg(Arg::with_name("pubkey")
                    .required(true)
                    .index(1))
                    .about("Pubkey"))
    .subcommand(SubCommand::with_name("blockheight")
                .about("Get the current block height"))
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

    let matches = cli.clone().get_matches();
    let rpc_url = matches.value_of("rpc-url").unwrap();

    let transport = HttpTransport::new().standalone().unwrap();
    let transport_handle = transport.handle(&rpc_url).unwrap();
    let mut client = NibbleClient::new(transport_handle);

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
                if let Some(_) = matches.subcommand_matches("getpubkey") {
                    println!("{}", client.getpubkey().call().unwrap());
                }

                if let Some(_) = matches.subcommand_matches("newpubkey") {
                    println!("{}", client.newpubkey().call().unwrap());
                }

                if let Some(_) = matches.subcommand_matches("mempool") {
                    println!("{:#?}", client.mempool().call().unwrap());
                }

                if let Some(_) = matches.subcommand_matches("balances") {
                    let result = client.balances().call().unwrap();
                    println!("{}", serde_json::to_string_pretty(&result)?);
                }

                if let Some(_) = matches.subcommand_matches("blockheight") {
                    let result = client.blockheight().call().unwrap();
                    println!("{}", result);
                }

                if let Some(cmd) = matches.subcommand_matches("getbalance") {
                    let pubkey = cmd.value_of("pubkey").unwrap();
                    let result = client.getbalance(key::PublicKey::from_str(&pubkey).unwrap()).call().unwrap();
                    println!("{}", serde_json::to_string_pretty(&result)?);
                }

                if let Some(cmd) = matches.subcommand_matches("send") {
                    let pubkey = cmd.value_of("pubkey").unwrap();
                    let amount : u32 = cmd.value_of("amount").unwrap().parse().unwrap();
                    let result = client.send(key::PublicKey::from_str(&pubkey).unwrap(), amount).call().unwrap();
                    println!("{}", serde_json::to_string_pretty(&result)?);
                }
            },
            Err(e) => {
                println!("{}", e);
            }
        }
    }
}
