pub mod math;

use math::DbVector2;
use spacetimedb::{ReducerContext, Table};

#[spacetimedb::table(name = player, public)]
#[spacetimedb::table(name = logged_out_player, public)]
#[derive(Clone, Debug)]
pub struct Player{
    #[primary_key]
    identity: spacetimedb::Identity,

    #[unique]
    #[auto_inc]
    player_id: u32,

    username: Option<String>,

    pub position: DbVector2,
    pub rotation_yaw: f32,

}

#[spacetimedb::reducer(client_connected)]
pub fn connect(ctx: &ReducerContext) -> Result<(), String> {
    if let Some(player) = ctx.db.logged_out_player().identity().find(&ctx.sender) {
        ctx.db.player().insert(player.clone());
        ctx.db
            .logged_out_player()
            .identity()
            .delete(&player.identity);
    } else {
        ctx.db.player().try_insert(Player {
            identity: ctx.sender,
            player_id: 0,
            username: None,
            position: DbVector2::new(0.0, 0.0),
            rotation_yaw: 0.0,
        })?;
    }
    Ok(())
}

#[spacetimedb::reducer(client_disconnected)]
pub fn disconnect(ctx: &ReducerContext) -> Result<(), String> {
    let player = ctx
        .db
        .player()
        .identity()
        .find(&ctx.sender)
        .ok_or("Player not found")?;

    let player_id = player.player_id;
    ctx.db.logged_out_player().insert(player);
    ctx.db.player().identity().delete(&ctx.sender);

    Ok(())
}


//Allowing the clients to be authoritative for now (For demonstration purposes only)
#[spacetimedb::reducer]
pub fn update_player_position(ctx: &ReducerContext, position: DbVector2, rotation: f32) {
    
    if let Some(mut player) = ctx.db.player().identity().find(&ctx.sender){
        player.position = position;
        player.rotation_yaw = rotation;
        ctx.db.player().identity().update(player);
        log::info!("Updated player position");
    }
    else{
        log::error!("Player not found");
    }
}
