# Nibble :cookie:

Nibble is a re creation of Bitcoin as a concept. It is intended to create a simple view of Bitcoin with code. It will be built from simple data structures and processes, eventually becoming ~~a network that anyone can run~~ **FAILED**

![Nibble demo](https://github.com/monokh/nibble/blob/master/demo.gif?raw=true)

## Run

`cargo run --bin nibbled`

RPC interface: `http://localhost:1337`

Explorer and Wallet UI: `http://localhost:1339`

## Guide

Data Structures: https://monokh.com/posts/bitcoin-from-scratch-part-1

The Node: https://monokh.com/posts/bitcoin-from-scratch-part-2

The Network: https://monokh.com/posts/bitcoin-from-scratch-part-3

## CLI

```
USAGE:
    nibble-cli [OPTIONS] [SUBCOMMAND]

FLAGS:
    -h, --help       Prints help information
    -V, --version    Prints version information

OPTIONS:
    -r, --rpc-url <RPC URL>    RPC Url to connect to [default: http://localhost:1337]

SUBCOMMANDS:
    balances       Returns balances for each pubkey known by the node
    blockheight    Get the current block height
    getbalance     Pubkey
    getblock       Block Number
    getpubkey      Get node's public key
    help           Prints this message or the help of the given subcommand(s)
    mempool        Returns the transactions in the mempool
    newpubkey      Generate a random pubkey
    send           Amount to send
```
