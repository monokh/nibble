use colored::*;
use rouille::Response;

pub fn run_server (port: u32) {
    let path = format!("127.0.0.1:{}", port);
    println!("{} Wallet, Explorer running on {}", "WEB:".green(), path);
    rouille::start_server(path, move |request| {
        let response = rouille::match_assets(&request, "web/public");
        if response.is_success() {
            return response;
        } else if request.url() == "/" {
            return rouille::match_assets(&request, "web/public/index.html");
        } else {
            return Response::text("404").with_status_code(404);
        }
    });
}
