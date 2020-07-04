mod node;
mod block;
mod transaction;
mod crypto;

use node::Node;

fn main() {
    let mut node = Node::new();
    node.start()
}
