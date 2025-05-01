mod module_bindings;
mod scene;

use module_bindings::*;
use spacetimedb_sdk::*;

const HOST: &str = "wss://maincloud.spacetimedb.com";
// const HOST: &str = "ws://localhost:3000";
const MODULE_NAME: &str = "vrchatdemo-gerbuuun";
const SCENE_PATH: &str = "/Users/gerbuuun/Development/github.com/Gerbuuun/vrchatdemo/client/public/models/forest_scene/scene.glb";

fn connect_to_db() -> DbConnection {
    DbConnection::builder()
        .with_uri(HOST)
        .with_module_name(MODULE_NAME)
        .on_connect(on_connect)
        .on_connect_error(on_connect_error)
        .on_disconnect(on_disconnect)
        .build()
        .expect("Failed to connect to database")
}

fn on_connect(_ctx: &DbConnection, _identity: Identity, _token: &str) {
    println!("Connected to database");
}

fn on_connect_error(_ctx: &ErrorContext, error: Error) {
    eprintln!("Failed to connect to database: {:?}", error);
    std::process::exit(1);
}

fn on_disconnect(_ctx: &ErrorContext, err: Option<Error>) {
    if let Some(error) = err {
        eprintln!("Disconnected from database: {:?}", error);
        std::process::exit(1);
    } else {
        eprintln!("Disconnected from database");
        std::process::exit(0);
    }
}

pub fn main() {
    let ctx = connect_to_db();
    ctx.reducers
        .on_upload_body(|_ctx, _points, _indices, _name| {
            println!("Uploaded {} with {} points", _name, _points.len());
        });

    ctx.run_threaded();

    let mut count = 0;
    for (point_array, indices, name) in scene::load_scene_mesh(SCENE_PATH) {
        ctx.reducers
            .upload_body(
                point_array
                    .iter()
                    .map(|p| DbVector3 {
                        x: p.x,
                        y: p.y,
                        z: p.z,
                    })
                    .collect(),
                indices
                    .iter()
                    .map(|i| DbVector3 {
                        x: i[0] as f32,
                        y: i[1] as f32,
                        z: i[2] as f32,
                    })
                    .collect(),
                name,
            )
            .expect("Failed to upload body");

        count += 1;
    }

    loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        println!("Uploaded {} bodies", count);
    }
}
