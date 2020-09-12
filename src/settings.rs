use config::{ConfigError, Config, File};
use serde::Deserialize;
use std::env;

#[derive(Deserialize)]
pub struct Settings {
    pub rpc_port: String,
    pub tcp_port: String,
    pub data_dir: String,
    pub miner_enabled: bool,
    pub bootstrap_node: Option<String>,
}

impl Settings {
    pub fn new() -> Result<Self, ConfigError> {
        let mut s = Config::new();

        // Start off by merging in the "default" configuration file
        s.merge(File::with_name("config/default"))?;

        // Config in home dir
        s.merge(File::with_name("~/.nibble/config.toml").required(false))?;

        // Config in local dir
        let local_config = env::args().nth(1).unwrap_or("config".to_string());
        s.merge(File::with_name(&local_config).required(false))?;

        // You can deserialize (and thus freeze) the entire configuration as
        s.try_into()
    }
}
